'use strict';
// ============================================================
// TEST FAYLLARINI O'QISH (AI'siz, bepul)
// Qo'llab-quvvatlanadi: .doc .docx .txt .pdf .xlsx .xls .csv .tsv
// Formatlar:
//   1) Raqamlangan:  "1. Savol"  +  "A. variant" / "А) variant"  ( * yoki + to'g'ri javob)
//   2) HEMIS:        ++++ savol ==== #to'g'ri ==== xato ...
//   3) Jadval:       Savol | To'g'ri javob | Xato | Xato | Xato | (til)
// Natija: [{ q, options: [...], correct: index | null }]
// ============================================================

const path = require('path');

const MAX_OPTIONS = 6;

// ─── Fayldan matn yoki jadval olish ─────────────────────────
async function extractContent(buffer, fileName) {
    const ext = path.extname(fileName || '').toLowerCase();

    if (['.xlsx', '.xls', '.csv', '.tsv', '.ods'].includes(ext)) {
        // Ba'zi ".xls" lar aslida tab bilan ajratilgan matn (sizning shabloningiz kabi)
        const asText = decodeText(buffer);
        if (ext !== '.xlsx' && ext !== '.ods' && looksLikeDelimitedText(asText)) {
            return { type: 'rows', rows: splitDelimited(asText) };
        }
        const XLSX = require('xlsx');
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const rows = [];
        for (const name of wb.SheetNames) {
            const sheetRows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' });
            rows.push(...sheetRows);
        }
        return { type: 'rows', rows };
    }

    if (ext === '.doc' || ext === '.docx') {
        const WordExtractor = require('word-extractor');
        const doc = await new WordExtractor().extract(buffer);
        return { type: 'text', text: doc.getBody() };
    }

    if (ext === '.pdf') {
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        try {
            const res = await parser.getText();
            return { type: 'text', text: res.text || '' };
        } finally {
            await parser.destroy().catch(() => {});
        }
    }

    // .txt va noma'lum — matn sifatida
    return { type: 'text', text: decodeText(buffer) };
}

// UTF-8 bo'lmasa (eski Windows fayllari) — windows-1251
function decodeText(buffer) {
    const utf8 = buffer.toString('utf8');
    const bad = (utf8.match(/�/g) || []).length;
    if (bad > 5) {
        try { return new TextDecoder('windows-1251').decode(buffer); } catch { /* ignore */ }
    }
    return utf8.replace(/^﻿/, '');
}

function looksLikeDelimitedText(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length || /[\u0000-\u0008]/.test(text.slice(0, 2000))) return false;
    const withTabs = lines.filter((l) => (l.match(/\t/g) || []).length >= 2).length;
    return withTabs / lines.length > 0.6;
}

function splitDelimited(text) {
    return text.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split('\t'));
}

// ─── Yordamchilar ───────────────────────────────────────────
const clean = (s) => String(s ?? '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();

// Variant belgisi: A. / a) / А. / Б) / 1) emas. Lotin A-F, kirill А-Е (Д bilan)
const OPTION_RE = /^\s*([*+#]?)\s*([A-Fa-fА-Еа-еЁё])\s*[.)\-:]\s*(.*)$/u;
const QUESTION_RE = /^\s*(\d{1,4})\s*[.)]\s*(.+)$/u;
const ANSWER_LINE_RE = /^\s*(?:javob|to['‘’`]?g['‘’`]?ri\s+javob|ответ|answer)\s*[:\-]\s*([A-Fa-fА-Еа-е])\b/iu;

const LETTER_INDEX = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, 'а': 0, 'б': 1, 'в': 2, 'г': 3, 'д': 4, 'е': 5 };

// To'g'ri javob belgisi: boshida yoki oxirida * / + / #
function stripMarker(text, prefixMarker) {
    let t = clean(text);
    let marked = !!prefixMarker;
    if (/^[*+#]\s*/.test(t)) { marked = true; t = t.replace(/^[*+#]\s*/, ''); }
    if (/\s*\*+$/.test(t)) { marked = true; t = t.replace(/\s*\*+$/, ''); }
    if (/\s+[+#]$/.test(t)) { marked = true; t = t.replace(/\s+[+#]$/, ''); }
    return { text: clean(t), marked };
}

// ─── 1) Raqamlangan format ─────────────────────────────────
function parseNumbered(text) {
    const lines = text.split(/\r?\n/).map((l) => l.replace(/ /g, ' ')).filter((l) => l.trim());
    const out = [];
    let cur = null;

    const push = () => {
        if (cur && cur.q && cur.options.length >= 2) out.push(cur);
        cur = null;
    };

    for (const raw of lines) {
        const line = raw.trim();
        const optM = line.match(OPTION_RE);
        const qM = line.match(QUESTION_RE);
        const ansM = line.match(ANSWER_LINE_RE);

        if (cur && ansM) {
            const idx = LETTER_INDEX[ansM[1].toLowerCase()];
            if (idx !== undefined && idx < cur.options.length) cur.correct = idx;
            continue;
        }
        // Variant (savol ochilgan bo'lsa). "A" harfi bilan boshlanadigan savol matnini
        // variant deb o'ylab qolmaslik uchun: variantlar ketma-ket bo'lishi kerak
        if (cur && optM) {
            const expected = cur.options.length;
            const idx = LETTER_INDEX[optM[2].toLowerCase()];
            if (idx === expected) {
                const { text: t, marked } = stripMarker(optM[3], optM[1]);
                if (marked && cur.correct === null) cur.correct = idx;
                cur.options.push(t);
                continue;
            }
        }
        if (qM && (!cur || cur.options.length >= 2 || !cur.q)) {
            push();
            cur = { q: clean(qM[2]), options: [], correct: null };
            continue;
        }
        // Davom etayotgan qator: savol yoki oxirgi variantga qo'shiladi
        if (cur) {
            if (cur.options.length === 0) cur.q = clean(`${cur.q} ${line}`);
            else {
                const last = cur.options.length - 1;
                const { text: t, marked } = stripMarker(`${cur.options[last]} ${line}`);
                cur.options[last] = t;
                if (marked && cur.correct === null) cur.correct = last;
            }
        }
    }
    push();
    return out;
}

// ─── 2) HEMIS formati (++++ / ====) ────────────────────────
function parseHemis(text) {
    if (!/\+{4}/.test(text) || !/={4}/.test(text)) return [];
    const out = [];
    for (const block of text.split(/\+{4,}/)) {
        const parts = block.split(/={4,}/).map((p) => clean(p.replace(/\r?\n/g, ' '))).filter(Boolean);
        if (parts.length < 3) continue;
        const q = parts[0].replace(/^\d{1,4}\s*[.)]\s*/, '');
        const options = [];
        let correct = null;
        parts.slice(1).forEach((p) => {
            const marked = p.startsWith('#');
            const t = clean(p.replace(/^#\s*/, ''));
            if (marked && correct === null) correct = options.length;
            options.push(t);
        });
        out.push({ q, options, correct });
    }
    return out;
}

// ─── 3) Jadval (shablon) ───────────────────────────────────
function parseRows(rows) {
    const out = [];
    for (const r of rows) {
        const cells = (r || []).map(clean);
        if (cells.length < 3) continue;
        const [q, correct, ...rest] = cells;
        if (!q || !correct) continue;
        if (/^savol(\s+matni)?/i.test(q) && /javob/i.test(correct)) continue; // sarlavha
        // Oxirgi ustun til kodi bo'lishi mumkin (uz / ru / en / uzb)
        const wrong = rest.filter((c, i) => c && !(i === rest.length - 1 && /^(uz|uzb|ru|rus|en|eng)$/i.test(c)));
        if (!wrong.length) continue;
        out.push({ q, options: [correct, ...wrong], correct: 0 });
    }
    return out;
}

// ─── Umumiy ────────────────────────────────────────────────
function normalizeQuestions(list) {
    const seen = new Set();
    const out = [];
    for (const item of list) {
        const q = clean(item.q);
        let options = item.options.map(clean).filter(Boolean).slice(0, MAX_OPTIONS);
        if (!q || options.length < 2) continue;
        let correct = Number.isInteger(item.correct) && item.correct < options.length ? item.correct : null;
        // Takroriy variantlarni olib tashlash (to'g'ri javob indeksini saqlagan holda)
        const correctText = correct !== null ? options[correct] : null;
        options = options.filter((o, i, a) => a.indexOf(o) === i);
        if (correctText !== null) correct = options.indexOf(correctText);
        const key = `${q}|${options.join('|')}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ q, options, correct });
    }
    return out;
}

function parseContent(content) {
    if (content.type === 'rows') return normalizeQuestions(parseRows(content.rows));
    const text = content.text || '';
    const hemis = parseHemis(text);
    const numbered = parseNumbered(text);
    return normalizeQuestions(hemis.length > numbered.length ? hemis : numbered);
}

// Matn tilini taxminiy aniqlash (kirill ko'p bo'lsa — rus)
function detectLang(questions) {
    const sample = questions.slice(0, 30).map((q) => q.q).join(' ');
    const cyr = (sample.match(/[А-Яа-яЁё]/g) || []).length;
    const lat = (sample.match(/[A-Za-z]/g) || []).length;
    return cyr > lat ? 'ru' : 'uz';
}

module.exports = { extractContent, parseContent, normalizeQuestions, detectLang, MAX_OPTIONS, _raw: { parseNumbered, parseHemis, parseRows } };
