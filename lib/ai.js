'use strict';
// ============================================================
// ANTHROPIC (CLAUDE) — AI funksiyalari
//  • extractQuestions  — parser o'qiy olmagan tartibsiz fayldan savollarni ajratish
//  • solveMissing      — to'g'ri javobi belgilanmagan savollarga javob topish
//  • explainQuestion   — "💡 Nega?" qisqa tushuntirish + yodlash usuli
//
// Sozlash (.env):
//   ANTHROPIC_API_KEY=sk-ant-...           (bo'lmasa AI o'chiq, bot ishlayveradi)
//   AI_MODEL_EXTRACT / AI_MODEL_SOLVE / AI_MODEL_EXPLAIN  (standart: claude-opus-5-5)
// ============================================================

const Anthropic = require('@anthropic-ai/sdk');

const DEFAULT_MODEL = 'claude-opus-5-5';
const MODELS = {
    extract: process.env.AI_MODEL_EXTRACT || DEFAULT_MODEL,
    solve:   process.env.AI_MODEL_SOLVE   || DEFAULT_MODEL,
    explain: process.env.AI_MODEL_EXPLAIN || DEFAULT_MODEL,
};

// $ / 1M token (kirish, chiqish) — xarajatni taxminiy hisoblash uchun
const PRICES = {
    'claude-opus-5-5':   [4, 20],
    'claude-sonnet-5-5': [2, 10],
    'claude-haiku-5-5':  [0.10, 0.50],
};
// Server tomonidagi refusal fallback qo'llab-quvvatlanadigan modellar
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-2', 'claude-fable-5-1', 'claude-opus-5']);

let client = null;
let usageLogger = () => {};
// Admin paneldan boshqariladi: model tanlash va oylik budjet nazorati
let modelResolver = () => null;
let budgetGuard = () => true;

const isEnabled = () => !!process.env.ANTHROPIC_API_KEY;
const getClient = () => (client ||= new Anthropic());
function setUsageLogger(fn) { usageLogger = fn; }
function setModelResolver(fn) { modelResolver = fn; }
function setBudgetGuard(fn) { budgetGuard = fn; }
const modelFor = (task) => modelResolver(task) || MODELS[task];

class AIError extends Error {
    constructor(message, userMessage) { super(message); this.userMessage = userMessage || message; }
}

function estimateCostUsd(model, usage) {
    const [inP, outP] = PRICES[model] || PRICES[DEFAULT_MODEL];
    const input = (usage?.input_tokens || 0) + (usage?.cache_creation_input_tokens || 0) * 1.25 + (usage?.cache_read_input_tokens || 0) * 0.1;
    return (input * inP + (usage?.output_tokens || 0) * outP) / 1e6;
}

// ─── Bitta so'rov (stream + finalMessage: uzun javoblarda timeout bo'lmaydi) ──
async function callClaude({ task, userId, system, content, schema, effort, maxTokens = 32000 }) {
    if (!isEnabled()) throw new AIError('AI disabled', "🤖 AI hozircha o'chirilgan.");
    if (!budgetGuard()) throw new AIError('budget', "⏳ AI'ning oylik limiti tugadi. Keyingi oy yoki admin limitni oshirgach ishlaydi.");
    const model = modelFor(task);
    const params = {
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content }],
        output_config: { effort, ...(schema ? { format: { type: 'json_schema', schema } } : {}) },
    };
    if (FALLBACK_MODELS.has(model)) {
        params.betas = ['server-side-fallback-2026-07-01'];
        params.fallbacks = 'default';
    }

    let msg;
    try {
        msg = await getClient().beta.messages.stream(params).finalMessage();
    } catch (err) {
        if (err instanceof Anthropic.RateLimitError) throw new AIError(err.message, "⏳ AI hozir band. Bir daqiqadan keyin qayta urinib ko'ring.");
        if (err instanceof Anthropic.AuthenticationError) throw new AIError(err.message, "⚠️ AI kaliti noto'g'ri. Admin bilan bog'laning.");
        if (err instanceof Anthropic.APIError) throw new AIError(`${err.status} ${err.message}`, "⚠️ AI xizmatida xatolik. Keyinroq urinib ko'ring.");
        throw new AIError(err.message, "⚠️ AI bilan bog'lanib bo'lmadi.");
    }

    const costUsd = estimateCostUsd(msg.model || model, msg.usage);
    try { usageLogger({ ts: Date.now(), task, model: msg.model || model, userId, usage: msg.usage, costUsd }); } catch { /* ignore */ }

    if (msg.stop_reason === 'refusal') throw new AIError('refusal', "🤖 AI bu so'rovni bajara olmadi.");
    if (msg.stop_reason === 'max_tokens') throw new AIError('max_tokens', '⚠️ Javob juda uzun chiqdi. Faylni kichikroq qismlarga bo\'lib yuboring.');

    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (!schema) return text.trim();
    try { return JSON.parse(text); } catch { throw new AIError('bad json', "⚠️ AI javobini o'qib bo'lmadi. Qayta urinib ko'ring."); }
}

// ─── 1) Tartibsiz fayldan savollarni ajratish ───────────────
const EXTRACT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['questions'],
    properties: {
        questions: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['q', 'options', 'correct'],
                properties: {
                    q: { type: 'string' },
                    options: { type: 'array', items: { type: 'string' } },
                    correct: { type: 'integer', description: "To'g'ri variant indeksi (0 dan). Matnda belgilanmagan bo'lsa -1." },
                },
            },
        },
    },
};

const EXTRACT_SYSTEM = `You convert raw text from a student's test file into structured multiple-choice questions.
Rules:
- Copy question and option text exactly as written (same language, same spelling). Do not translate, fix, or invent content.
- Strip numbering and option labels (e.g. "12.", "A)", "б.") from the text.
- "correct" is the 0-based index of the option the source marks as correct (marks like *, +, #, bold note, "Javob: B", "Ответ: в"). If the source does not mark an answer, use -1 — never guess here.
- Skip fragments that are not complete questions with at least 2 options.`;

function splitIntoChunks(text, maxChars = 24000) {
    const chunks = [];
    let rest = text;
    while (rest.length > maxChars) {
        // Savol boshida kesish (yangi qator + raqam), bo'lmasa oxirgi yangi qatorda
        const windowText = rest.slice(0, maxChars);
        let cut = -1;
        for (const m of windowText.matchAll(/\n\s*\d{1,4}\s*[.)]/g)) cut = m.index;
        if (cut < maxChars * 0.5) cut = windowText.lastIndexOf('\n');
        if (cut < maxChars * 0.5) cut = maxChars;
        chunks.push(rest.slice(0, cut));
        rest = rest.slice(cut);
    }
    if (rest.trim()) chunks.push(rest);
    return chunks;
}

async function extractQuestions(text, { userId, maxChars } = {}) {
    const source = maxChars ? text.slice(0, maxChars) : text;
    const chunks = splitIntoChunks(source);
    const all = [];
    for (const chunk of chunks) {
        const res = await callClaude({
            task: 'extract', userId, effort: 'low', maxTokens: 64000,
            system: EXTRACT_SYSTEM, schema: EXTRACT_SCHEMA,
            content: `<file_text>\n${chunk}\n</file_text>`,
        });
        for (const it of res.questions || []) {
            all.push({ q: it.q, options: it.options, correct: it.correct >= 0 ? it.correct : null });
        }
    }
    return { questions: all, truncated: source.length < text.length };
}

// ─── 2) Javobsiz savollarga javob topish ─────────────────────
const SOLVE_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['answers'],
    properties: {
        answers: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'correct', 'confidence'],
                properties: {
                    id: { type: 'integer' },
                    correct: { type: 'integer', description: "To'g'ri variant indeksi (0 dan)" },
                    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                },
            },
        },
    },
};

async function solveMissing(items, { subject, userId } = {}) {
    // items: [{ id, q, options }]
    const results = [];
    for (let i = 0; i < items.length; i += 25) {
        const batch = items.slice(i, i + 25);
        const listing = batch.map((it) => `#${it.id}\n${it.q}\n${it.options.map((o, j) => `  ${j}) ${o}`).join('\n')}`).join('\n\n');
        const res = await callClaude({
            task: 'solve', userId, effort: 'high', maxTokens: 32000,
            system: `You are an expert university examiner${subject ? ` for the subject "${subject}"` : ''}. For each multiple-choice question pick the single correct option index (0-based). Use "low" confidence when the question is ambiguous or depends on a specific textbook or local law you cannot verify.`,
            schema: SOLVE_SCHEMA,
            content: `Answer every question below. Return one entry per #id.\n\n${listing}`,
        });
        for (const a of res.answers || []) {
            const src = batch.find((b) => b.id === a.id);
            if (src && a.correct >= 0 && a.correct < src.options.length) results.push(a);
        }
    }
    return results;
}

// ─── 3) "Nega?" — qisqa tushuntirish ─────────────────────────
async function explainQuestion({ q, options, answer, subject, userId }) {
    const opts = options.map((o, i) => `${'ABCDEF'[i]}) ${o}`).join('\n');
    return callClaude({
        task: 'explain', userId, effort: 'low', maxTokens: 4000,
        system: `Sen talabalarga test savollarini tushuntiradigan o'qituvchisan. Faqat o'zbek tilida (lotin yozuvi) yoz.
Javob tuzilishi (jami 450 belgidan oshmasin, Markdown ishlatma):
1-2 gapda nega aynan shu javob to'g'ri ekanini tushuntir.
Keyin "🧠 Eslab qolish:" deb boshlanadigan bitta qisqa yodlash usuli (assotsiatsiya, qisqartma yoki qofiya) yoz.`,
        content: `${subject ? `Fan: ${subject}\n` : ''}Savol: ${q}\n${opts}\nTo'g'ri javob: ${answer}`,
    });
}

module.exports = { isEnabled, setUsageLogger, setModelResolver, setBudgetGuard, modelFor, PRICES, extractQuestions, solveMissing, explainQuestion, estimateCostUsd, MODELS, AIError };
