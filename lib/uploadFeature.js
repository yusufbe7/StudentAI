'use strict';
// ============================================================
// 📤 TEST YUKLASH VA YODLASH — bot funksiyasi
//  1. Talaba faylni yuboradi (.doc .docx .pdf .xlsx .xls .csv .txt)
//  2. Parser savollarni ajratadi (bepul); bo'lmasa — AI (Claude)
//  3. Bot fan nomini so'raydi → test "📚 Mening testlarim"ga qo'shiladi
//  4. Blitz / to'liq test / 🧠 yodlash rejimi / ❌ xatolarim / 🤖 javobsizlarni AI topsin / 📥 Excel
//  + "💡 Tushuntirish" tugmasi: tayyor izoh bo'lmasa AI yozadi (keshlanadi)
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Markup } = require('telegraf');
const parser = require('./questionParser');
const ai = require('./ai');
const { createStore } = require('./userTests');

const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== undefined ? Number(v) : d);
const LIMITS = {
    freeUploads: num(process.env.FREE_UPLOADS, 1),                 // VIP bo'lmaganlar uchun bepul fayllar
    freeAiExtractChars: num(process.env.FREE_AI_EXTRACT_CHARS, 30000), // bepul AI o'qishda matn chegarasi (~150 savol)
    freeExplainDaily: num(process.env.FREE_EXPLAIN_DAILY, 3),      // bepul "💡 Tushuntirish" / kun
    vipExplainDaily: num(process.env.VIP_EXPLAIN_DAILY, 100),
    freeSolveMax: num(process.env.FREE_SOLVE_MAX, 60),             // bepul: 1 marta, shuncha javobsiz savolgacha
    maxFileMb: num(process.env.MAX_UPLOAD_MB, 15),
};
const ALLOWED_EXT = ['.doc', '.docx', '.pdf', '.txt', '.xlsx', '.xls', '.csv', '.tsv', '.ods'];
const LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

module.exports = function registerUploadFeature(bot, deps) {
    const { DATA_DIR, getDb, saveDb, isAdmin, isVip, escapeHTML, shuffle, sendQuestion, showSubjectMenu, isValidName, timers, isPaidModeBlocked } = deps;
    const store = createStore(DATA_DIR);
    const esc = escapeHTML;

    // ─── AI xarajatlar logi (admin panel "Moliya va AI" uchun) ──
    const usagePath = path.join(DATA_DIR, 'ai_usage.json');
    ai.setUsageLogger((entry) => {
        let log = [];
        try { log = JSON.parse(fs.readFileSync(usagePath, 'utf8')); } catch { /* yangi */ }
        log.push(entry);
        if (log.length > 5000) log = log.slice(-5000);
        fs.writeFileSync(usagePath, JSON.stringify(log));
        console.log(`[AI] ${entry.task} ${entry.model} in=${entry.usage?.input_tokens} out=${entry.usage?.output_tokens} ≈$${entry.costUsd.toFixed(4)}`);
    });

    // ─── Tayyor fanlar uchun AI izohlar keshi ──────────────────
    const hintsPath = path.join(DATA_DIR, 'ai_hints.json');
    const readHints = () => { try { return JSON.parse(fs.readFileSync(hintsPath, 'utf8')); } catch { return {}; } };
    const hintKey = (q, a) => crypto.createHash('sha1').update(`${q}\u0000${a}`).digest('hex');

    const privileged = (uid) => isAdmin(uid) || isVip(uid);

    function busyKeys(s) {
        // Admin yoki boshqa jarayon kutayotgan bo'lsa — fayl/matnni ularga qoldiramiz
        return !!(s.adminStep || s.waitingForReceipt || Object.keys(s).some((k) => k.startsWith('waitingFor') && s[k]));
    }

    function useDailyQuota(uid, field, limit) {
        const db = getDb();
        const u = db.users[uid] || (db.users[uid] = {});
        const today = new Date().toISOString().slice(0, 10);
        if (!u[field] || u[field].date !== today) u[field] = { date: today, count: 0 };
        if (u[field].count >= limit) return false;
        u[field].count++;
        saveDb(db);
        return true;
    }

    // ─── Matnlar ──────────────────────────────────────────────
    function freeLeft(uid) {
        if (privileged(uid)) return Infinity;
        const u = getDb().users[uid] || {};
        return Math.max(0, LIMITS.freeUploads - (u.uploadsUsed || 0));
    }

    function uploadIntro(uid) {
        const left = freeLeft(uid);
        const quota = left === Infinity ? '💎 VIP: cheksiz yuklash' : left > 0 ? `🎁 Sizda <b>${left} ta bepul</b> yuklash bor` : '🔒 Bepul yuklash tugagan — VIP bilan cheksiz';
        return `📤 <b>Test faylingizni yuboring</b>\n\n` +
            `Bot savollarni avtomatik ajratib, sizga shaxsiy test qilib beradi.\n\n` +
            `📄 Formatlar: <b>.doc, .docx, .pdf, .xlsx, .xls, .csv, .txt</b>\n\n` +
            `✍️ To'g'ri javobni belgilash:\n` +
            `<code>1. Savol matni\nA. variant\nB. to'g'ri variant*\nC. variant</code>\n` +
            `yoki Excel shablon: <i>Savol | To'g'ri javob | Xato | Xato | Xato</i>\n\n` +
            `${quota}`;
    }

    const FEATURE_INTRO =
        `🎓 <b>StudentAI nimalar qila oladi?</b>\n\n` +
        `📤 <b>Test yuklash</b> — savollar faylini tashlang, bot uni testga aylantiradi\n` +
        `🧠 <b>Yodlash rejimi</b> — savol va to'g'ri javobni ketma-ket ko'rsatadi\n` +
        `❌ <b>Xatolarim</b> — faqat xato qilgan savollaringizni qayta ishlash\n` +
        `💡 <b>AI tushuntirish</b> — nega aynan shu javob to'g'ri + eslab qolish usuli\n` +
        `📚 Fanlar bo'yicha tayyor testlar va 🏆 haftalik musobaqalar\n\n` +
        `🎁 Birinchi faylingiz — <b>BEPUL!</b> Boshlash uchun <b>📤 Test yuklash</b> tugmasini bosing.`;

    function testSummary(t) {
        const answered = t.questions.filter((q) => q.correct !== null).length;
        const missing = t.questions.length - answered;
        const aiCount = t.questions.filter((q) => q.aiGuess).length;
        const optCounts = [...new Set(t.questions.map((q) => q.options.length))].sort().join('/');
        let s = `📚 <b>${esc(t.subject || 'Nomsiz test')}</b>\n\n` +
            `📝 Savollar: <b>${t.questions.length} ta</b> (${optCounts} variantli)\n` +
            `✅ Testga tayyor: <b>${answered} ta</b>\n`;
        if (missing) s += `⚠️ Javobi belgilanmagan: <b>${missing} ta</b> (testga kirmaydi)\n`;
        if (aiCount) s += `🤖 AI topgan javoblar: <b>${aiCount} ta</b> — tekshirib ko'ring\n`;
        if (t.wrongIdx?.length) s += `❌ Xatolaringiz: <b>${t.wrongIdx.length} ta</b>\n`;
        if (t.stats?.best !== null && t.stats?.best !== undefined) s += `🏆 Eng yaxshi natija: <b>${t.stats.best}%</b>\n`;
        s += `🌐 Til: ${t.lang === 'ru' ? 'rus' : "o'zbek"} · 📄 ${esc(t.fileName || '')}`;
        return s;
    }

    function testKeyboard(t) {
        const missing = t.questions.filter((q) => q.correct === null).length;
        const rows = [
            [Markup.button.callback('⚡ Blitz (25)', `ut:blitz:${t.id}`), Markup.button.callback("📝 To'liq test", `ut:full:${t.id}`)],
            [Markup.button.callback('🧠 Yodlash rejimi', `ut:learn:${t.id}`), Markup.button.callback(`❌ Xatolarim (${t.wrongIdx?.length || 0})`, `ut:wrongs:${t.id}`)],
        ];
        if (missing && ai.isEnabled()) rows.push([Markup.button.callback(`🤖 Javobsiz ${missing} ta savolga AI javob topsin`, `ut:solve:${t.id}`)]);
        rows.push([Markup.button.callback('📥 Excel', `ut:xlsx:${t.id}`), Markup.button.callback("🗑 O'chirish", `ut:del:${t.id}`)]);
        rows.push([Markup.button.callback('📚 Mening testlarim', 'ut:list:0')]);
        return Markup.inlineKeyboard(rows);
    }

    const ownTest = (ctx, id) => {
        const t = store.get(id);
        return t && (t.ownerId === String(ctx.from.id) || isAdmin(ctx.from.id)) ? t : null;
    };

    async function showList(ctx, edit = false) {
        const tests = store.listByOwner(ctx.from.id).slice(0, 30);
        const text = tests.length
            ? `📚 <b>Mening testlarim</b> (${tests.length} ta)\n\nTestni tanlang:`
            : `📚 <b>Mening testlarim</b>\n\nHali test yuklamagansiz.\n\n${uploadIntro(ctx.from.id)}`;
        const kb = Markup.inlineKeyboard(tests.map((t) => [Markup.button.callback(`📚 ${t.subject} · ${t.questions.length} savol`, `ut:open:${t.id}`)]));
        if (edit) return ctx.editMessageText(text, { parse_mode: 'HTML', ...kb }).catch(() => ctx.replyWithHTML(text, kb));
        return ctx.replyWithHTML(text, kb);
    }

    // Savolni test mexanizmi formatiga o'tkazish: { q, options, a, hint, _ut }
    const toEngine = (t, i) => {
        const q = t.questions[i];
        return { q: q.aiGuess ? `🤖 ${q.q}` : q.q, options: q.options, a: q.options[q.correct], hint: q.hint || '', _ut: i };
    };

    async function startRun(ctx, t, mode) {
        const uid = ctx.from.id;
        if (isPaidModeBlocked(uid)) {
            return ctx.reply('⚠️ Bot hozirda pullik rejimda.', Markup.inlineKeyboard([[Markup.button.callback('💎 VIP sotib olish ✨', 'buy_vip')]]));
        }
        let idx = t.questions.map((q, i) => (q.correct !== null ? i : -1)).filter((i) => i >= 0);
        if (mode === 'wrongs') {
            idx = (t.wrongIdx || []).filter((i) => t.questions[i]?.correct !== null);
            if (!idx.length) return ctx.reply("🎉 Bu testda xatolaringiz yo'q! Avval test ishlang.");
        }
        if (!idx.length) return ctx.reply("⚠️ Bu testda javobi belgilangan savol yo'q.");
        let list = shuffle(idx);
        if (mode === 'blitz') list = list.slice(0, 25);

        const s = ctx.session;
        if (timers[uid]) clearTimeout(timers[uid]);
        const user = getDb().users[uid];
        s.userName = user?.name && isValidName(user.name) ? user.name : ctx.from.first_name || 'Talaba';
        s.personalTestId = t.id;
        s.currentSubject = `ut_${t.id}`;
        s.isTurbo = mode === 'learn';
        s.activeList = list.map((i) => toEngine(t, i));
        s.index = 0; s.score = 0; s.wrongs = [];
        const title = { blitz: '⚡ Blitz', full: "📝 To'liq test", learn: '🧠 Yodlash rejimi', wrongs: '❌ Xatolar ustida ishlash' }[mode];
        await ctx.replyWithHTML(`${title}: <b>${esc(t.subject)}</b>\n📝 ${s.activeList.length} ta savol`);
        return sendQuestion(ctx, true);
    }

    // sendQuestion oxirida chaqiriladi (index.js) — shaxsiy test natijasi
    async function finishPersonalTest(ctx, s) {
        const t = store.get(s.personalTestId);
        const wasLearn = s.isTurbo;
        s.isTurbo = false;
        const wrongs = [...(s.wrongs || [])];
        s.lastWrongs = wrongs;
        if (!t) return ctx.reply('🏁 Test yakunlandi.');
        if (wasLearn) {
            return ctx.replyWithHTML(`🏁 <b>Yodlash yakunlandi!</b>\n\nEndi bilimingizni test bilan tekshiring 👇`, testKeyboard(t));
        }
        // Xatolar ro'yxatini yangilash: to'g'ri topilganlar chiqadi, xatolar qo'shiladi
        const wrongSet = new Set(wrongs.map((w) => w._ut));
        const asked = (s.activeList || []).map((x) => x._ut);
        const current = new Set(t.wrongIdx || []);
        asked.forEach((i) => (wrongSet.has(i) ? current.add(i) : current.delete(i)));
        t.wrongIdx = [...current];
        const total = asked.length || 1;
        const percent = Math.round((s.score / total) * 100);
        t.stats = { runs: (t.stats?.runs || 0) + 1, best: Math.max(t.stats?.best ?? 0, percent) };
        store.save(t);

        let msg = `🏁 <b>Test yakunlandi!</b> — ${esc(t.subject)}\n\n✅ To'g'ri: <b>${s.score} ta</b>\n❌ Xato: <b>${wrongs.length} ta</b>\n📊 Natija: <b>${percent}%</b>\n`;
        if (wrongs.length) {
            msg += `\n⚠️ <b>Xatolar tahlili:</b>\n\n`;
            for (let i = 0; i < wrongs.length; i++) {
                const x = wrongs[i];
                const block = `<b>${i + 1}.</b> ${esc(x.q)}\n❌ Siz: <s>${esc(x.userAnswer || 'Vaqt tugadi')}</s>\n✅ To'g'ri: <u>${esc(x.a)}</u>\n\n`;
                if ((msg + block).length > 3800) { msg += "...(qolgan xatolar sig'madi — ❌ Xatolarim tugmasi orqali ishlang)"; break; }
                msg += block;
            }
        } else msg += `\n🌟 <b>Ajoyib! Hech qanday xato qilmadingiz!</b>`;
        await ctx.replyWithHTML(msg).catch(() => ctx.reply(`Test yakunlandi! To'g'ri: ${s.score}, Xato: ${wrongs.length}`));
        return ctx.replyWithHTML(testSummary(t), testKeyboard(t));
    }

    // ─── "💡 Tushuntirish" (show_explanation) ───────────────────
    async function handleExplanation(ctx) {
        const s = ctx.session;
        const uid = ctx.from.id;
        const qData = s.activeList?.[s.index];
        if (!qData) return ctx.answerCbQuery('Xatolik: savol topilmadi.');

        let hint = qData.hint?.trim();
        const personal = s.personalTestId && s.currentSubject === `ut_${s.personalTestId}`;
        if (!hint && !personal) hint = readHints()[hintKey(qData.q, qData.a)];

        if (!hint && !ai.isEnabled()) return ctx.answerCbQuery("⚠️ Bu savolga tushuntirish qo'shilmagan.", { show_alert: true });

        const limit = privileged(uid) ? LIMITS.vipExplainDaily : LIMITS.freeExplainDaily;
        if (!useDailyQuota(uid, 'explainDaily', limit)) {
            await ctx.answerCbQuery(privileged(uid) ? '⏳ Bugungi limit tugadi.' : `🔒 Bugungi ${limit} ta bepul tushuntirish tugadi.`, { show_alert: true });
            if (!privileged(uid)) return ctx.replyWithHTML("💎 <b>VIP a'zolar</b> kuniga 100 tagacha AI tushuntirish oladi.", Markup.inlineKeyboard([[Markup.button.callback('💎 VIP sotib olish ✨', 'buy_vip')]]));
            return;
        }

        if (!hint) {
            if (timers[uid]) clearTimeout(timers[uid]); // o'qish vaqtida savol vaqti tugab qolmasin
            await ctx.answerCbQuery('🤖 AI tushuntirish yozmoqda...');
            const subject = personal ? store.get(s.personalTestId)?.subject : s.currentSubject;
            try {
                hint = await ai.explainQuestion({ q: qData.q.replace(/^🤖 /, ''), options: qData.options, answer: qData.a, subject, userId: uid });
            } catch (err) {
                console.error('[AI explain]', err.message);
                return ctx.reply(err.userMessage || '⚠️ AI xatolik.');
            }
            // Keshlash: keyingi safar AI chaqirilmaydi
            qData.hint = hint;
            if (personal) {
                const t = store.get(s.personalTestId);
                if (t?.questions[qData._ut]) { t.questions[qData._ut].hint = hint; store.save(t); }
            } else {
                const all = readHints();
                all[hintKey(qData.q, qData.a)] = hint;
                fs.writeFileSync(hintsPath, JSON.stringify(all));
            }
        } else {
            await ctx.answerCbQuery('🔍 Tushuntirish');
        }

        const progress = `${s.index + 1}/${s.activeList.length}`;
        let text = `🔢 <b>${progress}</b>\n\n❓ <b>${esc(qData.q)}</b>\n\n━━━━━━━━━━\n💡 <b>TUSHUNTIRISH:</b>\n${esc(hint)}\n━━━━━━━━━━\n\n`;
        if (!s.isTurbo) (s.currentOptions || []).forEach((opt, i) => { text += `<b>${LABELS[i]})</b> ${esc(opt)}\n\n`; });
        else text += `✅ <b>TO'G'RI JAVOB:</b>\n<code>${esc(qData.a)}</code>`;
        const keyboard = ctx.callbackQuery.message.reply_markup;
        try {
            if (ctx.callbackQuery.message.photo) await ctx.editMessageCaption(text.slice(0, 1024), { parse_mode: 'HTML', reply_markup: keyboard });
            else await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
        } catch {
            await ctx.replyWithHTML(`💡 <b>TUSHUNTIRISH:</b>\n${esc(hint)}`);
        }
    }

    // ─── Menyu tugmalari ──────────────────────────────────────
    bot.hears('📤 Test yuklash', (ctx) => ctx.replyWithHTML(uploadIntro(ctx.from.id)));
    bot.hears('📚 Mening testlarim', (ctx) => showList(ctx));
    bot.command('testlarim', (ctx) => showList(ctx));
    bot.command('yuklash', (ctx) => ctx.replyWithHTML(uploadIntro(ctx.from.id)));

    // ─── Fayl qabul qilish ────────────────────────────────────
    bot.on('document', async (ctx, next) => {
        const s = ctx.session || {};
        const uid = ctx.from.id;
        if (busyKeys(s)) return next();

        const doc = ctx.message.document;
        const fileName = doc.file_name || 'fayl';
        const ext = path.extname(fileName).toLowerCase();
        if (!ALLOWED_EXT.includes(ext)) return next();

        const user = getDb().users[uid];
        if (!user?.isRegistered) return ctx.reply("⚠️ Avval /start bosib ro'yxatdan o'ting.");
        if (doc.file_size > LIMITS.maxFileMb * 1024 * 1024) return ctx.reply(`⚠️ Fayl juda katta. Maksimal hajm: ${LIMITS.maxFileMb} MB.`);
        if (freeLeft(uid) <= 0) {
            return ctx.replyWithHTML("🔒 <b>Bepul yuklash tugadi.</b>\n\n💎 VIP a'zolar cheksiz test yuklay oladi.", Markup.inlineKeyboard([[Markup.button.callback('💎 VIP sotib olish ✨', 'buy_vip')]]));
        }
        if (s.uploadBusyUntil && s.uploadBusyUntil > Date.now()) return ctx.reply('⏳ Oldingi fayl hali o\'qilmoqda, biroz kuting.');
        s.uploadBusyUntil = Date.now() + 5 * 60 * 1000;

        const status = await ctx.replyWithHTML(`⏳ <b>${esc(fileName)}</b> o'qilmoqda...`);
        const setStatus = (text) => ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, text, { parse_mode: 'HTML' }).catch(() => {});

        try {
            const link = await ctx.telegram.getFileLink(doc.file_id);
            const res = await fetch(link.href);
            if (!res.ok) throw new Error(`download ${res.status}`);
            const buffer = Buffer.from(await res.arrayBuffer());

            const content = await parser.extractContent(buffer, fileName);
            let questions = parser.parseContent(content);
            let source = 'parser';
            let truncated = false;

            if (questions.length < 3) {
                const rawText = content.type === 'rows' ? content.rows.map((r) => r.join('\t')).join('\n') : content.text;
                if (!rawText || rawText.trim().length < 30) {
                    await setStatus("❌ Fayldan matn o'qib bo'lmadi. Fayl rasm (skan) bo'lishi mumkin — matnli fayl yuboring.");
                    return;
                }
                if (!ai.isEnabled()) {
                    await setStatus(`❌ Savollarni topa olmadim.\n\n${uploadIntro(uid)}`);
                    return;
                }
                await setStatus('🤖 Fayl tartibsiz ekan — <b>AI</b> savollarni ajratmoqda...\n<i>Bu 1-2 daqiqa olishi mumkin.</i>');
                const r = await ai.extractQuestions(rawText, { userId: uid, maxChars: privileged(uid) ? undefined : LIMITS.freeAiExtractChars });
                questions = parser.normalizeQuestions(r.questions);
                truncated = r.truncated;
                source = 'ai';
            }

            if (!questions.length) {
                await setStatus(`❌ Fayldan test savollari topilmadi.\n\n${uploadIntro(uid)}`);
                return;
            }

            const t = store.create({ ownerId: uid, fileName, questions, lang: parser.detectLang(questions), source });
            s.awaitingTestName = t.id;

            const missing = questions.filter((q) => q.correct === null).length;
            let msg = `✅ <b>${questions.length} ta savol topildi!</b>${source === 'ai' ? ' 🤖' : ''}\n`;
            if (missing) msg += `⚠️ ${missing} tasida to'g'ri javob belgilanmagan — keyin AI bilan topish mumkin.\n`;
            if (truncated) msg += `✂️ Bepul rejimda faylning bir qismi o'qildi. To'liq o'qish — VIP uchun.\n`;
            msg += `\n📚 <b>Bu qaysi fan?</b> Nomini yozing (masalan: <i>Sud tibbiyoti</i>):`;
            await setStatus(msg);
            await ctx.reply('Fan nomini kiriting 👇', Markup.keyboard([['🚫 Bekor qilish']]).resize());
        } catch (err) {
            console.error('[Upload]', err);
            await setStatus(err.userMessage || "❌ Faylni o'qishda xatolik. Boshqa formatda (.docx yoki .xlsx) yuborib ko'ring.");
        } finally {
            s.uploadBusyUntil = 0;
        }
    });

    // ─── Fan nomini qabul qilish ───────────────────────────────
    bot.on('text', async (ctx, next) => {
        const s = ctx.session || {};
        if (!s.awaitingTestName) return next();
        const text = (ctx.message.text || '').trim();
        if (text.startsWith('/')) return next();
        const t = store.get(s.awaitingTestName);
        if (text === '🚫 Bekor qilish' || !t) {
            if (t && t.status === 'draft') store.remove(t.id);
            s.awaitingTestName = null;
            return next();
        }
        if (text.length < 2 || text.length > 60) return ctx.reply("⚠️ Fan nomi 2–60 belgidan iborat bo'lsin. Qaytadan yozing:");

        t.subject = text;
        const firstTime = t.status === 'draft';
        t.status = 'ready';
        store.save(t);
        s.awaitingTestName = null;

        if (firstTime && !privileged(ctx.from.id)) {
            const db = getDb();
            const u = db.users[ctx.from.id] || (db.users[ctx.from.id] = {});
            u.uploadsUsed = (u.uploadsUsed || 0) + 1;
            saveDb(db);
        }
        await ctx.replyWithHTML(`🎉 <b>"${esc(text)}"</b> testlaringizga qo'shildi!`);
        await showSubjectMenu(ctx);
        return ctx.replyWithHTML(testSummary(t), testKeyboard(t));
    });

    // ─── Inline tugmalar: ut:<amal>:<id> ───────────────────────
    bot.action(/^ut:(\w+):(\w+)$/, async (ctx) => {
        const [, action, id] = ctx.match;
        if (action === 'list') { await ctx.answerCbQuery(); return showList(ctx, true); }

        const t = ownTest(ctx, id);
        if (!t) return ctx.answerCbQuery('⚠️ Test topilmadi.', { show_alert: true });

        switch (action) {
            case 'open':
                await ctx.answerCbQuery();
                return ctx.editMessageText(testSummary(t), { parse_mode: 'HTML', ...testKeyboard(t) }).catch(() => ctx.replyWithHTML(testSummary(t), testKeyboard(t)));
            case 'blitz':
            case 'full':
            case 'learn':
            case 'wrongs':
                await ctx.answerCbQuery();
                return startRun(ctx, t, action);
            case 'xlsx': {
                await ctx.answerCbQuery('📥 Tayyorlanmoqda...');
                const XLSX = require('xlsx');
                const maxOpts = Math.max(...t.questions.map((q) => q.options.length));
                const header = ['Savol', "To'g'ri javob", ...Array.from({ length: maxOpts - 1 }, () => 'Xato javob'), 'Til'];
                const rows = t.questions.filter((q) => q.correct !== null).map((q) => [q.q, q.options[q.correct], ...q.options.filter((_, i) => i !== q.correct), t.lang === 'ru' ? 'ru' : 'uz']);
                const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
                ws['!cols'] = [{ wch: 70 }, { wch: 30 }, ...Array.from({ length: maxOpts }, () => ({ wch: 25 }))];
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Savollar');
                const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
                const safeName = (t.subject || 'test').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 40) || 'test';
                return ctx.replyWithDocument({ source: buf, filename: `${safeName}.xlsx` }, { caption: `📥 ${t.subject}: ${rows.length} ta savol (shablon formatida)` });
            }
            case 'del':
                await ctx.answerCbQuery();
                return ctx.editMessageText(`🗑 <b>${esc(t.subject)}</b> testini o'chirasizmi?`, {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([[Markup.button.callback("Ha, o'chirish", `ut:delok:${t.id}`), Markup.button.callback("Yo'q", `ut:open:${t.id}`)]]),
                });
            case 'delok':
                store.remove(t.id);
                await ctx.answerCbQuery("🗑 O'chirildi");
                return showList(ctx, true);
            case 'solve':
                return solveMissingForTest(ctx, t);
            default:
                return ctx.answerCbQuery();
        }
    });

    async function solveMissingForTest(ctx, t) {
        const uid = ctx.from.id;
        if (!ai.isEnabled()) return ctx.answerCbQuery("🤖 AI hozircha o'chirilgan.", { show_alert: true });
        const items = t.questions.map((q, i) => ({ id: i, q: q.q, options: q.options })).filter((it) => t.questions[it.id].correct === null);
        if (!items.length) return ctx.answerCbQuery("✅ Barcha savollarda javob bor.", { show_alert: true });
        if (!privileged(uid)) {
            if (t.solveUsed) return ctx.answerCbQuery('🔒 Bepul rejimda bir marta. VIP bilan cheksiz.', { show_alert: true });
            if (items.length > LIMITS.freeSolveMax) return ctx.answerCbQuery(`🔒 Bepul rejimda ${LIMITS.freeSolveMax} tagacha savol. VIP bilan cheksiz.`, { show_alert: true });
        }
        if (ctx.session.solveBusy && ctx.session.solveBusy > Date.now()) return ctx.answerCbQuery('⏳ AI ishlayapti...');
        ctx.session.solveBusy = Date.now() + 10 * 60 * 1000;
        await ctx.answerCbQuery('🤖 AI ishlayapti...');
        const status = await ctx.replyWithHTML(`🤖 AI <b>${items.length} ta</b> savolga javob topmoqda...\n<i>Bu 1-3 daqiqa olishi mumkin.</i>`);
        try {
            const answers = await ai.solveMissing(items, { subject: t.subject, userId: uid });
            const fresh = store.get(t.id) || t;
            let low = 0;
            for (const a of answers) {
                const q = fresh.questions[a.id];
                if (!q || q.correct !== null) continue;
                q.correct = a.correct; q.aiGuess = true; q.confidence = a.confidence;
                if (a.confidence === 'low') low++;
            }
            fresh.solveUsed = true;
            store.save(fresh);
            await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined,
                `✅ AI <b>${answers.length} ta</b> savolga javob topdi.\n` +
                (low ? `⚠️ ${low} tasida AI ishonchi past.\n` : '') +
                `🤖 belgisi bor savollarni darslik bilan tekshirib ko'ring.`, { parse_mode: 'HTML' }).catch(() => {});
            return ctx.replyWithHTML(testSummary(fresh), testKeyboard(fresh));
        } catch (err) {
            console.error('[AI solve]', err.message);
            return ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, err.userMessage || '⚠️ AI xatolik.').catch(() => {});
        } finally {
            ctx.session.solveBusy = 0;
        }
    }

    return { finishPersonalTest, handleExplanation, FEATURE_INTRO, store, LIMITS };
};
