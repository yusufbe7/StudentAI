'use strict';

const { Telegraf, Markup } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const fs   = require('fs');
const path = require('path');
const express = require('express');
const cron    = require('node-cron');

// ============================================================
// SOZLAMALAR
// ============================================================
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID  = parseInt(process.env.ADMIN_ID);
const PORT      = process.env.PORT || 3000;

const REQUIRED_CHANNELS = [
    { id: '@yusufbe_dev',   name: 'Yusufbe Dev',        link: 'https://t.me/yusufbe_dev'   },
    { id: '@student_aitex', name: 'AI Simulyator News', link: 'https://t.me/student_aitex' },
];

if (!BOT_TOKEN) throw new Error("BOT_TOKEN env o'zgaruvchisi topilmadi!");
if (!ADMIN_ID)  throw new Error("ADMIN_ID env o'zgaruvchisi topilmadi!");

// ============================================================
// FAYL YO'LLARI
// ============================================================
const DATA_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const PATHS = {
    db:       path.join(DATA_DIR, 'ranking_db.json'),
    settings: path.join(DATA_DIR, 'settings.json'),
    vip:      path.join(DATA_DIR, 'vip_users.json'),
    session:  path.join(DATA_DIR, 'session.json'),
    subjects: path.join(__dirname, 'subjects.json'),
    customQ:  path.join(DATA_DIR, 'custom_questions.json'),
    photos:   path.join(DATA_DIR, 'user_photos.json'),
    sessions: path.join(DATA_DIR, 'test_sessions.json'),
    follows:  path.join(DATA_DIR, 'follows.json'),
    blocked: path.join(DATA_DIR, 'blocked_users.json'),
};

const CHAT_MSGS_PATH  = path.join(DATA_DIR, 'chat_messages.json');
const WEB_SCORES_PATH = path.join(DATA_DIR, 'web_scores.json');
const WEB_USERS_PATH  = path.join(DATA_DIR, 'web_users.json');

// ============================================================
// BOT VA APP
// ============================================================
const bot = new Telegraf(BOT_TOKEN);
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET','POST'] },
    transports: ['websocket','polling'],
});
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));

// ─── Online foydalanuvchilar: name → socket.id ─────────────
const onlineUsers = new Map(); // name.toLowerCase() → { socketId, name }

// ============================================================
// MA'LUMOTLAR BAZASI — yagona funksiyalar
// ============================================================
function readJSON(filePath, defaultValue) {
    try {
        if (!fs.existsSync(filePath)) { fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2)); return defaultValue; }
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) { console.error(`[DB] ${filePath}:`, err.message); return defaultValue; }
}
function writeJSON(filePath, data) {
    try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8'); }
    catch (err) { console.error(`[DB] write ${filePath}:`, err.message); }
}

const getDb        = () => readJSON(PATHS.db, { users: {}, settings: {} });
const saveDb       = (d) => writeJSON(PATHS.db, d);
const getSettings  = () => readJSON(PATHS.settings, { timeLimit: 30 });
const saveSettings = (s) => writeJSON(PATHS.settings, s);
const getPhotos    = () => readJSON(PATHS.photos, {});
const savePhotos   = (d) => writeJSON(PATHS.photos, d);
const getSessions  = () => readJSON(PATHS.sessions, []);
const saveSessions = (d) => writeJSON(PATHS.sessions, d);
const getFollows   = () => readJSON(PATHS.follows, {});
const getBlocked  = () => readJSON(PATHS.blocked, []);
const saveBlocked = (d) => writeJSON(PATHS.blocked, d);
const saveFollows  = (d) => writeJSON(PATHS.follows, d);
const getChatMsgs  = () => readJSON(CHAT_MSGS_PATH, {});
const saveChatMsgs = (d) => writeJSON(CHAT_MSGS_PATH, d);
const getWebScores = () => readJSON(WEB_SCORES_PATH, {});
const saveWebScores = (d) => writeJSON(WEB_SCORES_PATH, d);
const getWebUsers  = () => readJSON(WEB_USERS_PATH, {});
const saveWebUsers = (d) => writeJSON(WEB_USERS_PATH, d);

// ============================================================
// XOTIRA
// ============================================================
let SUBJECTS    = readJSON(PATHS.subjects, {});
const customQ   = readJSON(PATHS.customQ, null);
if (customQ) Object.assign(SUBJECTS, customQ);

let vipUsers    = readJSON(PATHS.vip, []);
let botSettings = getSettings();
let isBotPaidMode = false;
const timers    = {};

console.log(`✅ Savollar bazasi: ${Object.keys(SUBJECTS).length} ta fan`);

// ============================================================
// YORDAMCHI FUNKSIYALAR
// ============================================================
const isAdmin = (id) => id === ADMIN_ID;

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m =>
        ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m])
    );
}

function getProgressBar(current, total) {
    const filled = Math.min(Math.round((current / total) * 10), 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
function saveVip() { writeJSON(PATHS.vip, vipUsers); }

// ✅ Yagona chatId funksiyasi
function chatId(n1, n2) {
    return [n1.toLowerCase().trim(), n2.toLowerCase().trim()].sort().join('__CHAT__');
}

const FAKE_NAMES = [
    'ismsiz','ismsz','ism yoq',"ism yo'q",'ism kiritilmagan','nomalum',"noma'lum",
    'нет имени','без имени','noname','no name','anonymous','anonimus','anonim',
    'name','ism','ismi','фамилия','имя','ismi yoq','unknown','test','testt',
];

function isValidName(name) {
    if (!name || name.trim().length < 3) return false;
    const lower = name.trim().toLowerCase();
    if (/^\d+$/.test(lower)) return false;
    if (/^[^a-zA-Zа-яА-ЯёЁÀ-ÿ]+$/.test(lower)) return false;
    if (FAKE_NAMES.some(fake => lower.includes(fake))) return false;
    return true;
}

function getLeaderboard(requesterId = null) {
    const db  = getDb();
    const wu  = getWebUsers();
    const ws  = getWebScores();

    // 1. Bot (Telegram) foydalanuvchilari — score > 0
    const botUsers = Object.values(db.users)
        .filter(u => u && u.name && isValidName(u.name) && (u.score||0) > 0)
        .map(u => ({ name: u.name, score: u.score||0, username: u.username||'' }));

    const seenNames = new Set(botUsers.map(u => (u.name||'').toLowerCase().trim()));

    // 2. web_users.json — score > 0 YOKI web-only (Mercury kabi)
    const webUsers = Object.values(wu)
        .filter(u => {
            if (!u || !u.name) return false;
            if (seenNames.has((u.name||'').toLowerCase().trim())) return false;
            // Web-only har doim ko'rinadi (score = 0 bo'lsa ham)
            if (u.isWebOnly) return true;
            // Odatiy web user — faqat score > 0 bo'lsa
            return (u.score||0) > 0;
        })
        .map(u => {
            seenNames.add((u.name||'').toLowerCase().trim());
            return { name: u.name, score: u.score||0, username: u.nickname||u.username||'' };
        });

    // 3. web_scores.json — admin qo'shgan, boshqa joyda yo'qlar
    const webScores = Object.values(ws)
        .filter(u => u && u.name && (u.score||0) > 0 && !seenNames.has((u.name||'').toLowerCase().trim()))
        .map(u => ({ name: u.name, score: u.score||0, username: u.nickname||u.username||'' }));

    const all = [...botUsers, ...webUsers, ...webScores]
        .sort((a, b) => (b.score||0) - (a.score||0))
        .slice(0, 10);

    if (!all.length) return '🏆 Hozircha reytingda hech kim yoq.';

    const isReqAdmin = requesterId === ADMIN_ID;
    let res = '🏆 <b>TOP 10 REYTING</b>\n\n';
    const medals = ['🥇','🥈','🥉'];
    all.forEach((u, i) => {
        const medal = medals[i] || '🔹';
        const link = (isReqAdmin && u.username && u.username !== 'Lichka yopiq')
            ? ` (<code>${escapeHTML(u.username)}</code>)` : '';
        res += `${medal} <b>${escapeHTML((u.name||'').trim())}</b>${link} — <b>${parseFloat(u.score||0).toFixed(1)}</b> ball\n`;
    });
    return res;
}

async function checkSubscription(ctx) {
    for (const ch of REQUIRED_CHANNELS) {
        try {
            const m = await ctx.telegram.getChatMember(ch.id, ctx.from.id);
            if (['left','kicked'].includes(m.status)) return false;
        } catch { return false; }
    }
    return true;
}

async function getSubKeyboard(ctx) {
    const buttons = [];
    for (const ch of REQUIRED_CHANNELS) {
        try {
            const m = await ctx.telegram.getChatMember(ch.id, ctx.from.id);
            if (['left','kicked'].includes(m.status)) buttons.push([Markup.button.url(`📢 ${ch.name}`, ch.link)]);
        } catch { buttons.push([Markup.button.url(`📢 ${ch.name}`, ch.link)]); }
    }
    buttons.push([Markup.button.callback('✅ Tekshirish','check_sub')]);
    return Markup.inlineKeyboard(buttons);
}

// ✅ TO'G'RI: user.score ga yozadi (user.scores emas!)
function updateGlobalScore(userId, name, username, score, totalInTest, wrongCount, subjectKey) {
    try {
        const db = getDb();
        if (!db.users[userId]) {
            db.users[userId] = { name: name||'Foydalanuvchi', username: username||'Lichka yopiq', score:0, totalTests:0, totalCorrect:0, totalWrong:0, subjects:{} };
        }
        const u = db.users[userId];
        u.totalTests   = (u.totalTests   || 0) + 1;
        u.score        = (u.score        || 0) + score;
        u.totalCorrect = (u.totalCorrect || 0) + score;
        u.totalWrong   = (u.totalWrong   || 0) + (wrongCount || 0);
        if (name && isValidName(name)) u.name = name;
        if (username) u.username = username;
        if (subjectKey) {
            if (!u.subjects) u.subjects = {};
            if (!u.subjects[subjectKey]) u.subjects[subjectKey] = { tests:0, correct:0, wrong:0 };
            u.subjects[subjectKey].tests++;
            u.subjects[subjectKey].correct += score;
            u.subjects[subjectKey].wrong   += (wrongCount || 0);
        }
        saveDb(db);
    } catch (err) { console.error('[Score]', err.message); }
}

function prepareTournamentQuestions(count) {
    let all = [];
    Object.values(SUBJECTS).forEach(sub => { if (sub.questions) all = all.concat(sub.questions); });
    return shuffle(all).slice(0, count);
}

// ============================================================
// MENYU
// ============================================================
function adminMainKeyboard(db) {
    const s = db.settings || {};
    const statusBtn = s.isMaintenance ? '🟢 Botni Yoqish' : "🛑 Botni To'xtatish";
    const turboBtn  = s.turboMode ? "🚀 Turbo (O'chirish)" : '🚀 Turbo (Yoqish)';
    const tl = botSettings?.timeLimit || 30;
    return Markup.keyboard([
        ['💰 Pullik versiya','🆓 Bepul versiya'],
        ['🏆 Haftalik musobaqa','🚀 Musobaqani start berish'],
        ['📢 Musobaqa natijalari','👥 Musobaqani boshqarish'],
        ['📊 Statistika', statusBtn],
        [turboBtn, `⏱ Vaqt: ${tl}s`],
        ['➕ Yangi fan qoshish',"🗑 Botni Restart qilish"],
        ['🧹 Reytingni tozalash','📣 Xabar tarqatish'],
        ["🎭 Sohta ball qo'shish",'⬅️ Orqaga (Fanlar)'],
    ]).resize();
}

function showSubjectMenu(ctx) {
    try {
        const db = getDb();
        const userId = ctx.from.id;
        const user   = db.users[userId];
        const tour   = db.tournament;
        if (!user || !user.isRegistered) return ctx.reply("⚠️ Iltimos, avval /start bosing va ro'yxatdan o'ting.");
        const yonalish = user.yonalish || '';
        let keyboard = [];
        if (yonalish === 'Dasturiy Injiniring') {
            keyboard = [['📝 Akademik yozuv','📜 Tarix'],['➕ Matematika','🧲 Fizika'],['💻 Dasturlash 1','🇬🇧 Perfect English']];
        } else if (['Kiberxavfsizlik',"Sun'iy intelekt"].includes(yonalish)) {
            keyboard = [['🧲 Fizika','📜 Tarix'],['📝 Akademik yozuv','➕ Matematika'],['🇬🇧 Perfect English','💻 Dasturlash 1']];
        } else {
            keyboard = [['📝 Akademik yozuv','📜 Tarix'],['➕ Matematika','🧲 Fizika']];
        }
        if (tour?.isActive && !user.tourFinished) keyboard.unshift(['🏆 Xalqaro test musobaqa']);
        if (db.settings?.turboMode) keyboard.push(['🚀 TURBO YODLASH']);
        keyboard.push(['📊 Reyting','👤 Profil']);
        keyboard.push(['⚙️ Sozlamalar']);
        return ctx.replyWithHTML(
            `👤 <b>Foydalanuvchi:</b> ${escapeHTML(user.name||'Talaba')}\n🎓 <b>Yo'nalish:</b> ${escapeHTML(yonalish||"Noma'lum")}\n\nFanni tanlang:`,
            Markup.keyboard(keyboard).resize()
        );
    } catch (err) {
        console.error('[Menu]', err.message);
        return ctx.reply('❌ Menyuni yuklashda xatolik. Qaytadan /start bosing.');
    }
}

async function showProfile(ctx) {
    const db = getDb();
    const userId = ctx.from.id;
    const user = db.users[userId];
    if (!user) return ctx.reply('Avval test yechib ko\'ring!');
    const usersArr = Object.values(db.users).sort((a,b) => (b.score||0) - (a.score||0));
    const rank = usersArr.findIndex(u => String(u.id) === String(userId)) + 1;
    const vipStatus = (user.isVip || vipUsers.includes(userId)) ? '💎 VIP' : '🆓 Oddiy';
    let msg = `👤 <b>SIZNING PROFILINGIZ</b>\n\n🆔 <b>ID:</b> <code>${userId}</code>\n👤 <b>Ism:</b> ${escapeHTML(user.name||'Kiritilmagan')}\n🎓 <b>OTM:</b> ${escapeHTML(user.univ||'—')}\n📚 <b>Kurs:</b> ${escapeHTML(user.kurs||'—')}\n🏆 <b>Umumiy ball:</b> ${parseFloat(user.score||0).toFixed(1)}\n📈 <b>Reyting o'rni:</b> ${rank>0?rank+'-o\'rin':'—'} (${usersArr.length} tadan)\n⭐ <b>Status:</b> ${vipStatus}\n\n`;
    msg += rank<=3 ? '🌟 Siz TOP-3 talaba siz! Zo\'r!' : rank<=10 ? '🚀 TOP-10 dasiiz! Davom eting!' : '💪 TOP-10 ga kirish uchun ko\'proq mashq qiling!';
    return ctx.replyWithHTML(msg);
}

// ============================================================
// TEST YUBORISH
// ============================================================
async function sendQuestion(ctx, isNew = false) {
    const s = ctx.session;
    const userId = ctx.from.id;
    if (timers[userId]) clearTimeout(timers[userId]);

    if (!s.activeList || s.index >= s.activeList.length) {
        const wrongCount = (s.wrongs || []).length;
        if (!s.isTurbo) updateGlobalScore(userId, s.userName, ctx.from.username||'Lichka yopiq', s.score, s.activeList?.length||0, wrongCount, s.currentSubject||null);
        const total = s.activeList?.length || 1;
        const percent = ((s.score / total) * 100).toFixed(1);
        let resultMsg = s.isTurbo
            ? '🏁 <b>Turbo yodlash yakunlandi!</b>'
            : `🏁 <b>Test yakunlandi, ${escapeHTML(s.userName)}!</b>\n\n✅ To'g'ri: <b>${s.score} ta</b>\n❌ Xato: <b>${(s.wrongs||[]).length} ta</b>\n📊 Natija: <b>${percent}%</b>\n_________________________\n\n`;
        if (!s.isTurbo && s.wrongs?.length > 0) {
            resultMsg += `⚠️ <b>Xatolar tahlili:</b>\n\n`;
            for (let i = 0; i < s.wrongs.length; i++) {
                const x = s.wrongs[i];
                const block = `<b>${i+1}.</b> ${escapeHTML(x.q)}\n❌ Siz: <s>${escapeHTML(x.userAnswer||'Vaqt tugadi')}</s>\n✅ To'g'ri: <u>${escapeHTML(x.a)}</u>\n_________________________\n\n`;
                if ((resultMsg+block).length > 3900) { resultMsg += '...(qolgan xatolar sig\'madi)'; break; }
                resultMsg += block;
            }
        } else if (!s.isTurbo) resultMsg += '🌟 <b>Ajoyib! Hech qanday xato qilmadingiz!</b>';
        s.isTurbo = false;
        try { await ctx.replyWithHTML(resultMsg, Markup.keyboard([["⚡️ Blitz (25)","📝 To'liq test"],['⬅️ Orqaga (Fanlar)']]).resize()); }
        catch { await ctx.reply(`Test yakunlandi! To'g'ri: ${s.score}, Xato: ${(s.wrongs||[]).length}`); }
        return;
    }

    const qData = s.activeList[s.index];
    if (!qData?.q) { s.index++; return sendQuestion(ctx, true); }

    const safe = escapeHTML(qData.q);
    const progress = getProgressBar(s.index+1, s.activeList.length);
    const imagePath = qData.image ? path.join(__dirname,'images',qData.image) : null;
    const hasImage  = imagePath && fs.existsSync(imagePath);

    if (s.isTurbo) {
        const turboText = `🚀 <b>TURBO YODLASH</b>\n📊 [${progress}]\n🔢 Savol: <b>${s.index+1}/${s.activeList.length}</b>\n_________________________\n\n❓ <b>${safe}</b>\n\n✅ <b>TO'G'RI JAVOB:</b>\n<code>${escapeHTML(qData.a)}</code>\n_________________________\n👇 Keyingi savol:`;
        const turboBtn = Markup.inlineKeyboard([[Markup.button.callback('Keyingi savol ➡️','next_turbo_q')],[Markup.button.callback("🛑 To'xtatish",'stop_test')]]);
        if (hasImage) return ctx.replyWithPhoto({source:imagePath},{caption:turboText,parse_mode:'HTML',...turboBtn});
        try { return isNew ? ctx.replyWithHTML(turboText,turboBtn) : ctx.editMessageText(turboText,{parse_mode:'HTML',...turboBtn}); }
        catch { return ctx.replyWithHTML(turboText,turboBtn); }
    }

    const timeLimit = s.userTimeLimit || botSettings.timeLimit || 30;
    s.currentOptions = shuffle([...qData.options]);
    const labels = ['A','B','C','D'];
    let text = `📊 Progress: [${progress}]\n🔢 Savol: <b>${s.index+1}/${s.activeList.length}</b>\n⏱ <b>VAQT: ${timeLimit}s</b>\n\n❓ <b>${safe}</b>\n\n`;
    s.currentOptions.forEach((opt, i) => { text += `<b>${labels[i]})</b> ${escapeHTML(opt)}\n\n`; });
    const inlineBtn = Markup.inlineKeyboard([
        s.currentOptions.map((_,i) => Markup.button.callback(labels[i],`ans_${i}`)),
        [Markup.button.callback('💡 Tushuntirish','show_explanation')],
        [Markup.button.callback("🛑 Testni to'xtatish",'stop_test')],
    ]);
    if (hasImage) { await ctx.replyWithPhoto({source:imagePath},{caption:text,parse_mode:'HTML',...inlineBtn}); }
    else {
        try { isNew ? await ctx.replyWithHTML(text,inlineBtn) : await ctx.editMessageText(text,{parse_mode:'HTML',...inlineBtn}); }
        catch { await ctx.replyWithHTML(text,inlineBtn); }
    }
    timers[userId] = setTimeout(async () => {
        if (ctx.session?.index === s.index && !ctx.session?.isTurbo) {
            ctx.session.wrongs.push({...qData, userAnswer:'Vaqt tugadi ⏰'});
            ctx.session.index++;
            await ctx.replyWithHTML('⏰ <b>VAQT TUGADI!</b>').catch(()=>{});
            sendQuestion(ctx, true);
        }
    }, timeLimit * 1000);
}

// ============================================================
// MUSOBAQA
// ============================================================
const tourGlobalTimers = {};

function clearTourTimers(userId) {
    if (timers[userId])           { clearTimeout(timers[userId]);           delete timers[userId]; }
    if (tourGlobalTimers[userId]) { clearTimeout(tourGlobalTimers[userId]); delete tourGlobalTimers[userId]; }
}

async function endTourByTimeout(userId, telegram) {
    clearTourTimers(userId);
    const db = getDb();
    if (!db.users[userId]) return;
    const score = db.users[userId].tourScore || 0;
    db.users[userId].tourFinished = true;
    saveDb(db);
    try {
        await telegram.sendMessage(userId,
            `⏰ <b>MUSOBAQA VAQTI TUGADI!</b>\n\n👤 Ishtirokchi: <b>${escapeHTML(db.users[userId].name||'Foydalanuvchi')}</b>\n✅ To'g'ri javoblar: <b>${score} ta</b>\n\n🏆 Natijangiz saqlandi.`,
            { parse_mode:'HTML' }
        );
    } catch {}
}

async function sendTourQuestion(ctx, isNew = false) {
    const s = ctx.session;
    const userId = ctx.from.id;
    const db = getDb();
    const tour = db.tournament;
    if (timers[userId]) { clearTimeout(timers[userId]); delete timers[userId]; }
    const isTimeOut = s.tourEndTime && Date.now() >= s.tourEndTime;
    if (!tour || s.tourIndex >= tour.count || isTimeOut) {
        clearTourTimers(userId);
        const finalScore = s.tourScore || 0;
        if (db.users[userId]) { db.users[userId].tourScore = finalScore; db.users[userId].tourFinished = true; saveDb(db); }
        const title = isTimeOut ? '⏰ <b>Vaqtingiz tugadi!</b>' : '🏁 <b>Musobaqa yakunlandi!</b>';
        const totalQ = tour?.count || s.tourIndex || 0;
        const percent = totalQ > 0 ? ((finalScore/totalQ)*100).toFixed(1) : '0.0';
        const resultMsg = `${title}\n\n${isTimeOut?'Ajratilgan umumiy vaqt yakunlandi.':'Barcha savollarga javob berdingiz.'}\n\n👤 Ishtirokchi: <b>${escapeHTML(s.userName||'Foydalanuvchi')}</b>\n✅ To'g'ri: <b>${finalScore} ta</b>\n📊 Natija: <b>${percent}%</b> (${finalScore}/${totalQ})\n\n🏆 Natijangiz saqlandi.`;
        try { await ctx.deleteMessage(); } catch {}
        await ctx.replyWithHTML(resultMsg);
        return showSubjectMenu(ctx);
    }
    const remaining = Math.max(0, s.tourEndTime - Date.now());
    const remMin = Math.floor(remaining/60000);
    const remSec = Math.floor((remaining%60000)/1000);
    const qData = tour.questions[s.tourIndex];
    if (!qData) { s.tourIndex++; return sendTourQuestion(ctx, false); }
    const progress = getProgressBar(s.tourIndex+1, tour.count);
    s.currentOptions = shuffle([...qData.options]);
    const labels = ['A','B','C','D'];
    const perQSec = Math.min(30, Math.max(1, Math.ceil(remaining/1000)));
    let text = `🏆 <b>MUSOBAQA REJIMI</b>\n⏱ <b>Umumiy vaqt: ${String(remMin).padStart(2,'0')}:${String(remSec).padStart(2,'0')} qoldi</b>\n📊 Progress: [${progress}]\n🔢 Savol: <b>${s.tourIndex+1}/${tour.count}</b>\n⌛️ Bu savol uchun: <b>${perQSec<30?perQSec+'s (!)':'30s'}</b>\n_________________________\n\n❓ <b>${escapeHTML(qData.q)}</b>\n\n`;
    s.currentOptions.forEach((opt, i) => { text += `<b>${labels[i]})</b> ${escapeHTML(opt)}\n\n`; });
    const inlineBtn = Markup.inlineKeyboard([
        s.currentOptions.map((_,i) => Markup.button.callback(labels[i],`tourans_${i}`)),
        [Markup.button.callback('🛑 Chiqish','stop_tour')],
    ]);
    try { isNew ? await ctx.replyWithHTML(text,inlineBtn) : await ctx.editMessageText(text,{parse_mode:'HTML',...inlineBtn}); }
    catch { await ctx.replyWithHTML(text,inlineBtn); }
    const questionTimeout = Math.min(30000, remaining);
    if (questionTimeout <= 0) { s.tourIndex = tour.count; return sendTourQuestion(ctx, false); }
    timers[userId] = setTimeout(async () => {
        if (ctx.session?.tourIndex === s.tourIndex) {
            if (ctx.session.tourEndTime && Date.now() >= ctx.session.tourEndTime) ctx.session.tourIndex = tour.count;
            else ctx.session.tourIndex++;
            sendTourQuestion(ctx, false);
        }
    }, questionTimeout);
}

async function finalizeTournament(ctx) {
    const db = getDb();
    const tour = db.tournament;
    if (!tour?.participants?.length) return ctx.reply("❌ Ishtirokchilar ro'yxati bo'sh.");
    const leaderboard = tour.participants
        .map(id => { const u = db.users[id]; return u ? {id, name:u.name||'Foydalanuvchi', score:u.tourScore||0} : null; })
        .filter(Boolean).sort((a,b) => b.score - a.score);
    if (!leaderboard.length) return ctx.reply('❌ Natijalar hisoblanmadi.');
    const medals = ['🥇','🥈','🥉'];
    let rankingMsg = `🏆 <b>MUSOBAQA NATIJALARI</b>\n📅 Sana: ${tour.date||'---'}\n_________________________\n\n`;
    leaderboard.slice(0,10).forEach((u,i) => { rankingMsg += `${medals[i]||`${i+1}.`} <b>${escapeHTML(u.name)}</b> — ${u.score} ball\n`; });
    const winner = leaderboard[0];
    if (winner?.score > 0) await ctx.telegram.sendMessage(winner.id,"🥳 <b>TABRIKLAYMIZ!</b>\n\nSiz 1-o'rinni egalladingiz! 🏆",{parse_mode:'HTML'}).catch(()=>{});
    const chunkSize = 20;
    for (let i = 0; i < tour.participants.length; i += chunkSize) {
        const chunk = tour.participants.slice(i, i+chunkSize);
        await Promise.allSettled(chunk.map(async uid => {
            try {
                await ctx.telegram.sendMessage(uid, rankingMsg, {parse_mode:'HTML'});
                await ctx.telegram.sendMessage(uid,"🏁 Musobaqa yakunlandi. Asosiy menyudasiz:",{...Markup.keyboard([['📝 Akademik yozuv','📜 Tarix'],['➕ Matematika','📊 Reyting'],['👤 Profil']]).resize()});
            } catch {}
        }));
        if (i+chunkSize < tour.participants.length) await new Promise(r => setTimeout(r,1000));
    }
    db.tournament.isActive = false;
    saveDb(db);
    return ctx.replyWithHTML(`✅ Natijalar ${tour.participants.length} ta foydalanuvchiga yuborildi!\n\n${rankingMsg}`);
}

// ============================================================
// MIDDLEWARLAR
// ============================================================
bot.use((new LocalSession({ database: PATHS.session })).middleware());
bot.use(async (ctx, next) => {
    const db = getDb();
    if (db.settings?.isMaintenance && ctx.from?.id !== ADMIN_ID)
        return ctx.reply('🛠 Botda texnik ishlar olib borilmoqda. Tez orada qaytamiz!');
    if (ctx.from?.id && ctx.from.id !== ADMIN_ID) {
        const blocked = getBlocked();
        if (blocked.includes(ctx.from.id)) {
            return ctx.reply('🚫 Siz botdan bloklangansiz. Admin bilan bog\'laning.').catch(() => {});
        }
    }
    return next();
});
bot.use(async (ctx, next) => {
    if (ctx.message?.text === '/start') return next();
    if (ctx.callbackQuery) return next();
    try {
        const subscribed = await checkSubscription(ctx);
        if (!subscribed) {
            const keyboard = await getSubKeyboard(ctx);
            return ctx.reply('⚠️ Botdan foydalanish uchun quyidagi kanallarga obuna bo\'ling!', keyboard).catch(()=>{});
        }
    } catch (err) { console.error('[Sub check]', err.message); }
    return next();
});

// ============================================================
// /start
// ============================================================
bot.start(async (ctx) => {
    const db = getDb();
    const userId = ctx.from.id;
    const user = db.users[userId];
    if (user?.isRegistered) { await ctx.reply(`Xush kelibsiz, ${escapeHTML(user.name)}! 😊`); return showSubjectMenu(ctx); }
    if (!db.users[userId]) {
        db.users[userId] = { id:userId, username:ctx.from.username||"Noma'lum", name:'', univ:'', kurs:'', yonalish:'', score:0, totalTests:0, step:'wait_name', isRegistered:false };
    } else { db.users[userId].step = 'wait_name'; db.users[userId].isRegistered = false; }
    saveDb(db);
    const existingName = db.users[userId].name;
    if (existingName && isValidName(existingName)) {
        return ctx.replyWithHTML(`✨ <b>Assalomu alaykum!</b>\n\nAvvalgi ismingiz: <b>${escapeHTML(existingName)}</b>\n\nIsm va familiyangizni qayta kiriting:`, Markup.removeKeyboard());
    }
    return ctx.replyWithHTML(`✨ <b>Assalomu alaykum! Botga xush kelibsiz.</b>\n\nRo'yxatdan o'tish uchun ism va familiyangizni kiriting:`, Markup.removeKeyboard());
});

bot.command('admin', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("❌ Ruxsat yo'q!");
    return ctx.reply('🛠 <b>Admin Panel</b>', {parse_mode:'HTML', ...adminMainKeyboard(getDb())});
});

// ============================================================
// CALLBACK QUERY HANDLERLARI
// ============================================================
bot.action('check_sub', async (ctx) => {
    const subscribed = await checkSubscription(ctx);
    if (subscribed) { await ctx.answerCbQuery('✅ Rahmat!'); await ctx.deleteMessage().catch(()=>{}); return showSubjectMenu(ctx); }
    const keyboard = await getSubKeyboard(ctx);
    await ctx.answerCbQuery("❌ Hali ham obuna bo'lmadingiz!", {show_alert:true});
    return ctx.editMessageReplyMarkup(keyboard.reply_markup).catch(()=>{});
});

bot.action(/^ans_(\d+)$/, async (ctx) => {
    const s = ctx.session;
    const userId = ctx.from.id;
    if (!s?.activeList || s.index === undefined || !s.activeList[s.index]) {
        if (timers[userId]) clearTimeout(timers[userId]);
        await ctx.answerCbQuery('⚠️ Sessiya tugagan.').catch(()=>{});
        return ctx.reply('⚠️ Sessiya tugagan. /start bosing.');
    }
    if (timers[userId]) clearTimeout(timers[userId]);
    const selIdx = parseInt(ctx.match[1]);
    const currentQ = s.activeList[s.index];
    const labels = ['A','B','C','D'];
    try {
        const userAnswer = s.currentOptions[selIdx];
        if (userAnswer === currentQ.a) { s.score++; await ctx.answerCbQuery("✅ To'g'ri!"); }
        else {
            s.wrongs.push({...currentQ, userAnswer});
            const ci = s.currentOptions.indexOf(currentQ.a);
            await ctx.answerCbQuery(`❌ Noto'g'ri!\nTo'g'ri: ${labels[ci]||'?'}) ${currentQ.a}`, {show_alert:true});
        }
        s.index++;
        return sendQuestion(ctx, false);
    } catch (err) { console.error('[ans]', err.message); await ctx.answerCbQuery('Xatolik.').catch(()=>{}); }
});

bot.action('next_turbo_q', async (ctx) => { if (ctx.session?.isTurbo) { ctx.session.index++; return sendQuestion(ctx, true); } await ctx.answerCbQuery(); });
bot.action('stop_test', (ctx) => { if (timers[ctx.from.id]) clearTimeout(timers[ctx.from.id]); ctx.session.index = 999; return showSubjectMenu(ctx); });

bot.action('show_explanation', async (ctx) => {
    const s = ctx.session;
    const userId = ctx.from.id;
    const db = getDb();
    const user = db.users[userId] || {};
    if (!user.isVip && !vipUsers.includes(userId) && !isAdmin(userId)) {
        await ctx.answerCbQuery("🔒 Faqat VIP a'zolar uchun!", {show_alert:true});
        return ctx.replyWithHTML("⭐ <b>Tushuntirishlar faqat VIP a'zolar uchun!</b>", Markup.inlineKeyboard([[Markup.button.callback('💎 VIP sotib olish','buy_vip')]]));
    }
    const qData = s.activeList?.[s.index];
    if (!qData) return ctx.answerCbQuery('Xatolik: savol topilmadi.');
    if (!qData.hint?.trim()) return ctx.answerCbQuery("⚠️ Bu savolga tushuntirish qo'shilmagan.", {show_alert:true});
    await ctx.answerCbQuery('🔍 Tushuntirish');
    const progress = getProgressBar(s.index+1, s.activeList.length);
    const labels = ['A','B','C','D'];
    let updText = `📊 [${progress}]\n🔢 <b>${s.index+1}/${s.activeList.length}</b>\n\n❓ <b>${escapeHTML(qData.q)}</b>\n\n━━━━━━━━━━\n💡 <b>TUSHUNTIRISH:</b>\n${escapeHTML(qData.hint)}\n━━━━━━━━━━\n\n`;
    if (!s.isTurbo) (s.currentOptions||[]).forEach((opt,i) => { updText += `<b>${labels[i]})</b> ${escapeHTML(opt)}\n\n`; });
    else updText += `✅ <b>TO'G'RI JAVOB:</b>\n<code>${escapeHTML(qData.a)}</code>`;
    const keyboard = ctx.callbackQuery.message.reply_markup;
    try {
        ctx.callbackQuery.message.photo
            ? await ctx.editMessageCaption(updText,{parse_mode:'HTML',reply_markup:keyboard})
            : await ctx.editMessageText(updText,{parse_mode:'HTML',reply_markup:keyboard});
    } catch {}
});

bot.action('buy_vip', (ctx) => { ctx.session.waitingForReceipt = true; return ctx.replyWithHTML(`💎 <b>VIP STATUS SOTIB OLISH</b>\n\n💳 Karta: <code>4073420058363577</code>\n👤 Egasi: M.M\n💰 Summa: 6,000 so'm\n\n📸 To'lovni amalga oshirgach, <b>chekni (rasm)</b> yuboring.`); });

bot.action(/^approve_(\d+)$/, async (ctx) => {
    const targetId = parseInt(ctx.match[1]);
    const db = getDb();
    const now = Date.now();
    const vipEnd = now + 30*24*60*60*1000;
    if (db.users[targetId]) { db.users[targetId].isVip = true; db.users[targetId].vipStart = now; db.users[targetId].vipEnd = vipEnd; saveDb(db); }
    if (!vipUsers.includes(targetId)) { vipUsers.push(targetId); saveVip(); }
    const fmt = ts => new Date(ts).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'});
    await ctx.telegram.sendMessage(targetId,`🎉 <b>VIP a'zolik tasdiqlandi!</b>\n\n📅 To'lov: <b>${fmt(now)}</b>\n⏳ Tugaydi: <b>${fmt(vipEnd)}</b>`,{parse_mode:'HTML'}).catch(()=>{});
    return ctx.editMessageCaption(`✅ <b>Tasdiqlandi:</b> ${fmt(now)} dan ${fmt(vipEnd)} gacha.`,{parse_mode:'HTML'});
});
bot.action(/^reject_vip_(\d+)$/, async (ctx) => { await ctx.telegram.sendMessage(parseInt(ctx.match[1]),"❌ Chek tasdiqlanmadi.").catch(()=>{}); return ctx.editMessageCaption("❌ To'lov rad etildi."); });

bot.action('confirm_tour', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("Ruxsat yo'q!");
    const db = getDb();
    const s = ctx.session;
    if (tourDeadlineTimer) { clearTimeout(tourDeadlineTimer); tourDeadlineTimer = null; }
    Object.keys(db.users).forEach(id => { db.users[id].tourScore = 0; db.users[id].tourFinished = false; });
    db.tournament = { isActive:true, started:false, startedAt:null, deadlineTime:null, date:s.tourDate, time:s.tourTime, count:parseInt(s.tourCount), participants:[], questions:prepareTournamentQuestions(parseInt(s.tourCount)) };
    saveDb(db);
    await ctx.answerCbQuery("✅ Musobaqa e'lon qilindi!");
    await ctx.editMessageText(`✅ <b>Musobaqa e'lon qilindi!</b>\n\n📅 ${s.tourDate}\n🕒 ${s.tourTime}\n📝 ${s.tourCount} ta savol\n\nFoydalanuvchilarga xabar yuborilmoqda...`,{parse_mode:'HTML'});
    for (const uid of Object.keys(db.users)) {
        await ctx.telegram.sendMessage(uid,`📣 <b>YANGI MUSOBAQA!</b>\n\n📅 Sana: <b>${s.tourDate}</b>\n🕒 Vaqt: <b>${s.tourTime}</b>\n📝 Savollar: <b>${s.tourCount} ta</b>\n\nQatnashish uchun tugmani bosing:`,{parse_mode:'HTML',...Markup.keyboard([["🏆 Musobaqaga o'tish"]]).resize()}).catch(()=>{});
    }
    s.adminStep = null;
    await ctx.reply('🛠 Admin Panel', adminMainKeyboard(getDb()));
});
bot.action('reject_tour', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("Ruxsat yo'q!");
    const db = getDb();
    if (db.tournament) { db.tournament.isActive = false; db.tournament.participants = []; saveDb(db); }
    ctx.session.adminStep = null;
    await ctx.answerCbQuery('Musobaqa bekor qilindi');
    await ctx.editMessageText("❌ <b>Musobaqa yaratish bekor qilindi.</b>",{parse_mode:'HTML'});
    return ctx.reply('🛠 Admin Panel', adminMainKeyboard(getDb()));
});
bot.action('join_tour', async (ctx) => {
    const db = getDb();
    const userId = ctx.from.id;
    const tour = db.tournament;
    if (!tour?.isActive) return ctx.answerCbQuery('❌ Musobaqa yakunlangan yoki faol emas.');
    if (tour.participants.includes(userId)) return ctx.answerCbQuery("✅ Siz allaqachon ro'yxatdan o'tgansiz!");
    db.tournament.participants.push(userId);
    saveDb(db);
    return ctx.editMessageText(`🎉 <b>Muvaffaqiyatli ro'yxatdan o'tdingiz!</b>\n\nMusobaqa boshlanish vaqti: <b>${tour.time}</b>.\n🚀 Tayyor turing!`,{parse_mode:'HTML'});
});
bot.action('cancel_join', async (ctx) => ctx.editMessageText("❌ Musobaqada qatnashish rad etildi."));
bot.action('back_to_main', async (ctx) => { try { await ctx.deleteMessage(); } catch {} return showSubjectMenu(ctx); });

bot.action(/^tourans_(\d+)$/, async (ctx) => {
    const s = ctx.session;
    const db = getDb();
    const tour = db.tournament;
    const userId = ctx.from.id;
    if (!s || s.tourIndex === undefined || !tour) return ctx.answerCbQuery('❌ Sessiya topilmadi.');
    if (s.tourEndTime && Date.now() >= s.tourEndTime) {
        clearTourTimers(userId);
        await ctx.answerCbQuery('⏰ Musobaqa vaqti tugadi!', {show_alert:true});
        s.tourIndex = tour.count;
        return sendTourQuestion(ctx, false);
    }
    if (db.users[userId]?.tourFinished) return ctx.answerCbQuery('✅ Musobaqa yakunlangan.');
    if (timers[userId]) { clearTimeout(timers[userId]); delete timers[userId]; }
    const choiceIdx = parseInt(ctx.match[1]);
    const currentQ = tour.questions[s.tourIndex];
    if (!currentQ || !s.currentOptions) return ctx.answerCbQuery();
    const userAnswer = s.currentOptions[choiceIdx];
    if (userAnswer === currentQ.a) { s.tourScore = (s.tourScore||0)+1; await ctx.answerCbQuery("✅ To'g'ri!"); }
    else await ctx.answerCbQuery("❌ Noto'g'ri!");
    s.tourIndex++;
    if (db.users[userId]) { db.users[userId].tourScore = s.tourScore; if (s.tourIndex >= tour.count) db.users[userId].tourFinished = true; saveDb(db); }
    return sendTourQuestion(ctx, false);
});

bot.action('start_actual_tour', async (ctx) => {
    const s = ctx.session;
    const db = getDb();
    const tour = db.tournament;
    const userId = ctx.from.id;
    if (!tour?.isActive) return ctx.answerCbQuery('❌ Musobaqa yakunlangan.',{show_alert:true});
    if (!tour.participants.includes(userId)) return ctx.answerCbQuery("❌ Siz ro'yxatdan o'tmagansiz!",{show_alert:true});
    if (db.users[userId]?.tourFinished) return ctx.answerCbQuery("✅ Siz bu musobaqani yechib bo'lgansiz!",{show_alert:true});
    const deadlineTime = tour.deadlineTime || (Date.now() + tour.count * 30 * 1000);
    const remaining = deadlineTime - Date.now();
    if (remaining <= 2000) return ctx.answerCbQuery('⏰ Musobaqa vaqti tugab ketdi!',{show_alert:true});
    s.tourIndex = 0; s.tourScore = 0;
    s.userName = db.users[userId]?.name || ctx.from.first_name;
    s.tourEndTime = deadlineTime;
    clearTourTimers(userId);
    tourGlobalTimers[userId] = setTimeout(async () => {
        if (!db.users[userId]?.tourFinished) { ctx.session.tourIndex = tour.count; await endTourByTimeout(userId, ctx.telegram); }
    }, remaining + 1000);
    await ctx.answerCbQuery('🚀 Musobaqa boshlandi! Omad!');
    try { await ctx.deleteMessage(); } catch {}
    const remMin = Math.floor(remaining/60000);
    const remSec = Math.floor((remaining%60000)/1000);
    const timeStr = remMin > 0 ? (remSec > 0 ? `${remMin} daqiqa ${remSec} soniya` : `${remMin} daqiqa`) : `${remSec} soniya`;
    await ctx.replyWithHTML(`🚀 <b>Musobaqa boshlandi!</b>\n\n📝 Jami savollar: <b>${tour.count} ta</b>\n⏱ Qolgan vaqt: <b>${timeStr}</b>\n⌛️ Har bir savol uchun: <b>30 soniya</b>\n\n💡 Vaqt tugaganda musobaqa avtomatik yakunlanadi!`);
    return sendTourQuestion(ctx, true);
});
bot.action('stop_tour', async (ctx) => { clearTourTimers(ctx.from.id); try { await ctx.deleteMessage(); } catch {} return showSubjectMenu(ctx); });
bot.action('confirm_clear_rank', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("Ruxsat yoq!");
    try {
        // 1. Bot foydalanuvchilari (db.users)
        const db = getDb();
        Object.keys(db.users).forEach(id => {
            db.users[id].score = 0;
            db.users[id].totalTests = 0;
            db.users[id].totalCorrect = 0;
            db.users[id].totalWrong = 0;
            db.users[id].subjects = {};
        });
        saveDb(db);

        // 2. Web foydalanuvchilari (web_users.json)
        const wu = getWebUsers();
        Object.keys(wu).forEach(k => {
            wu[k].score = 0;
            wu[k].totalTests = 0;
            wu[k].totalCorrect = 0;
            wu[k].totalWrong = 0;
            wu[k].subjects = {};
        });
        saveWebUsers(wu);

        // 3. Web scores (web_scores.json)
        const ws = getWebScores();
        Object.keys(ws).forEach(k => {
            ws[k].score = 0;
            ws[k].totalTests = 0;
            ws[k].totalCorrect = 0;
            ws[k].totalWrong = 0;
        });
        saveWebScores(ws);

        const total = Object.keys(db.users).length + Object.keys(wu).length;
        await ctx.editMessageText(`Reyting tozalandi! ${total} ta foydalanuvchi.`);
        ctx.answerCbQuery();
    } catch(err) {
        console.error('[clear_rank]', err.message);
        await ctx.editMessageText('Xatolik: ' + err.message);
        ctx.answerCbQuery();
    }
});
bot.action('cancel_clear', (ctx) => ctx.deleteMessage().catch(()=>{}));
bot.action('confirm_full_restart', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("Ruxsat yo'q!");
    try {
        const db = getDb();
        Object.keys(db.users).forEach(id => { db.users[id].score = 0; db.users[id].totalTests = 0; db.users[id].tourScore = 0; db.users[id].tourFinished = false; });
        if (!db.settings) db.settings = {};
        db.settings.isMaintenance = false; db.settings.turboMode = false;
        saveDb(db);
        await ctx.editMessageText('✅ Ballar va statistika tozalandi!');
        await ctx.reply('✅ Tizim yangilandi.', adminMainKeyboard(getDb()));
    } catch (err) { console.error('[Restart]', err.message); await ctx.reply('❌ Xatolik yuz berdi.'); }
});
bot.action('cancel_restart', (ctx) => { ctx.deleteMessage().catch(()=>{}); ctx.reply('Bekor qilindi.'); });
bot.action('announce_results', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("Ruxsat yo'q!");
    try { await ctx.editMessageText('🔄 Natijalar hisoblanmoqda...'); await finalizeTournament(ctx); await ctx.answerCbQuery('✅ Jarayon yakunlandi!'); }
    catch (err) { console.error('[Results]', err.message); await ctx.reply('❌ Natijalarni yuborishda xatolik.'); }
});
bot.action('cancel_action', (ctx) => ctx.deleteMessage().catch(()=>{}));
bot.action('fake_score_self', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("Ruxsat yo'q!");
    ctx.session.adminStep = 'wait_fake_score_amount_self';
    await ctx.answerCbQuery();
    await ctx.editMessageText(`🎭 <b>O'ZINGIZGA BALL QO'SHISH</b>\n\nQo'shmoqchi bo'lgan ball miqdorini kiriting:`,{parse_mode:'HTML'});
});
bot.action('fake_score_other', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("Ruxsat yo'q!");
    ctx.session.adminStep = 'wait_fake_score_tgid';
    await ctx.answerCbQuery();
    await ctx.editMessageText(`🎭 <b>BOSHQA FOYDALANUVCHIGA BALL QO'SHISH</b>\n\nFoydalanuvchining Telegram ID sini kiriting:`,{parse_mode:'HTML'});
});
bot.action('cancel_fake_score', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("Ruxsat yo'q!");
    ctx.session.adminStep = null; ctx.session.fakeScoreTarget = null; ctx.session.fakeScoreUserId = null;
    await ctx.answerCbQuery('Bekor qilindi');
    await ctx.editMessageText("❌ Sohta ball qo'shish bekor qilindi.");
    return ctx.reply('🛠 Admin Panel', adminMainKeyboard(getDb()));
});
bot.action('tour_add_all', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("Ruxsat yo'q!");
    const db = getDb();
    const tour = db.tournament;
    if (!tour?.isActive) return ctx.answerCbQuery('❌ Musobaqa faol emas!', {show_alert:true});
    await ctx.answerCbQuery('⏳ Qo\'shilmoqda...');
    const allIds = Object.keys(db.users).map(id => parseInt(id)).filter(id => !isNaN(id));
    let added = 0, notified = 0;
    for (const uid of allIds) {
        if (!tour.participants.includes(uid)) { tour.participants.push(uid); added++; }
        try { await bot.telegram.sendMessage(uid,`🏆 <b>MUSOBAQAGA QO'SHILDINGIZ!</b>\n\n📅 ${tour.date||'—'}\n🕒 ${tour.time||'—'}\n📝 ${tour.count||'—'} ta savol\n\n✅ Boshlanish vaqtida xabar keladi!`,{parse_mode:'HTML'}); notified++; } catch {}
    }
    db.tournament = tour; saveDb(db);
    await ctx.editMessageText(`✅ <b>Muvaffaqiyatli!</b>\n\n👥 Jami: ${allIds.length} ta\n➕ Yangi qo'shildi: ${added} ta\n📨 Xabar oldi: ${notified} ta`,{parse_mode:'HTML'});
    return ctx.reply('🛠 Admin Panel', adminMainKeyboard(getDb()));
});
bot.action('tour_add_vip', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("Ruxsat yo'q!");
    const db = getDb();
    const tour = db.tournament;
    if (!tour?.isActive) return ctx.answerCbQuery('❌ Musobaqa faol emas!', {show_alert:true});
    await ctx.answerCbQuery('⏳ VIP foydalanuvchilar qo\'shilmoqda...');
    const vipIds = Object.entries(db.users).filter(([id,u]) => u.isVip||vipUsers.includes(parseInt(id))).map(([id]) => parseInt(id));
    if (!vipIds.length) return ctx.editMessageText('❌ VIP foydalanuvchilar topilmadi.',{parse_mode:'HTML'});
    let added = 0, notified = 0;
    for (const uid of vipIds) {
        if (!tour.participants.includes(uid)) { tour.participants.push(uid); added++; }
        try { await bot.telegram.sendMessage(uid,`💎 <b>VIP SIFATIDA MUSOBAQAGA QO'SHILDINGIZ!</b>\n\n📅 ${tour.date||'—'} · 🕒 ${tour.time||'—'}\n📝 ${tour.count||'—'} ta savol`,{parse_mode:'HTML'}); notified++; } catch {}
    }
    db.tournament = tour; saveDb(db);
    await ctx.editMessageText(`✅ <b>VIP foydalanuvchilar qo'shildi!</b>\n\n💎 VIP soni: ${vipIds.length}\n➕ Yangi: ${added}\n📨 Xabar: ${notified}`,{parse_mode:'HTML'});
    return ctx.reply('🛠 Admin Panel', adminMainKeyboard(getDb()));
});
bot.action('tour_add_one', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("Ruxsat yo'q!");
    ctx.session.adminStep = 'wait_tour_add_id';
    await ctx.answerCbQuery();
    await ctx.editMessageText("🔍 Musobaqaga qo'shmoqchi bo'lgan foydalanuvchining Telegram ID sini kiriting:",{parse_mode:'HTML'});
});

// ============================================================
// BOT.HEARS — FAN VA TEST
// ============================================================
bot.hears(['📝 Akademik yozuv','📜 Tarix','➕ Matematika','💻 Dasturlash 1','🧲 Fizika','🇬🇧 Perfect English'], async (ctx) => {
    const text = ctx.message.text;
    const s = ctx.session;
    const db = getDb();
    const user = db.users[ctx.from.id];
    if (!user?.isRegistered) return ctx.reply("⚠️ Avval ro'yxatdan o'ting.");
    const yonalishKey = user.yonalish.toLowerCase().trim().replace(/'/g,'').replace(/ /g,'_');
    const subjectMap = {'Akademik':'academic','Tarix':'history','Matematika':'math','Dasturlash':'dasturlash','Fizika':'physics','English':'english'};
    const subjectPart = Object.entries(subjectMap).find(([k]) => text.includes(k))?.[1];
    const finalKey = `${yonalishKey}_${subjectPart}`;
    if (SUBJECTS[finalKey]?.questions) {
        s.currentSubject = finalKey;
        const userU = getDb().users[ctx.from.id];
        s.userName = (userU?.name && isValidName(userU.name)) ? userU.name : (ctx.from.first_name || 'Talaba');
        if (s.isTurbo) {
            const questions = SUBJECTS[finalKey].questions;
            if (!questions.length) return ctx.reply("Bu fanda savollar yo'q.");
            s.activeList = shuffle([...questions]); s.index = 0; s.score = 0; s.wrongs = [];
            return sendQuestion(ctx, true);
        }
        return ctx.reply(`Tayyormisiz? (${text})`, Markup.keyboard([["⚡️ Blitz (25)","📝 To'liq test"],['⬅️ Orqaga (Fanlar)']]).resize());
    } else return ctx.reply(`⚠️ ${user.yonalish} uchun "${text}" savollari hali yuklanmagan.`);
});

bot.hears(["⚡️ Blitz (25)","📝 To'liq test"], async (ctx) => {
    const s = ctx.session;
    const userId = ctx.from.id;
    s.isTurbo = false;
    if (isBotPaidMode && !vipUsers.includes(userId) && !isAdmin(userId)) return ctx.reply("⚠️ Bot hozirda pullik rejimda.", Markup.inlineKeyboard([[Markup.button.callback('💎 VIP sotib olish','buy_vip')]]));
    if (!s.currentSubject || !SUBJECTS[s.currentSubject]) return showSubjectMenu(ctx);
    const questions = SUBJECTS[s.currentSubject].questions;
    if (!questions?.length) return ctx.reply("Bu fanda savollar yo'q.");
    const user = getDb().users[userId];
    s.userName = (user?.name && isValidName(user.name)) ? user.name : (ctx.from.first_name || 'Talaba');
    s.activeList = ctx.message.text.includes('25') ? shuffle(questions).slice(0,25) : shuffle(questions);
    s.index = 0; s.score = 0; s.wrongs = [];
    return sendQuestion(ctx, true);
});

bot.hears('📊 Reyting', async (ctx) => ctx.replyWithHTML(getLeaderboard(ctx.from.id)));
bot.hears(['👤 Profil','👤 Profilim'], async (ctx) => showProfile(ctx));
bot.hears(['⬅️ Orqaga (Fanlar)'], (ctx) => showSubjectMenu(ctx));
bot.hears('⚙️ Sozlamalar', (ctx) => ctx.reply('Sozlamalar:', Markup.keyboard([["📝 Ismni o'zgartirish"],["🎓 Yo'nalishni qayta tanlash"],['⬅️ Orqaga (Fanlar)']]).resize()));
bot.hears("📝 Ismni o'zgartirish", (ctx) => { const db=getDb(); if(!db.users[ctx.from.id])return; db.users[ctx.from.id].step='edit_name'; saveDb(db); return ctx.reply('Yangi ismingizni kiriting:'); });
bot.hears("🎓 Yo'nalishni qayta tanlash", (ctx) => {
    const db=getDb(); const user=db.users[ctx.from.id]; if(!user)return;
    user.isRegistered=false; user.step='wait_univ'; saveDb(db);
    return ctx.reply("OTMni qayta tanlang:", Markup.keyboard([['Alfraganus Universiteti','Perfect Universiteti'],['TATU','TDPU']]).oneTime().resize());
});

// ─── ADMIN HANDLERLARI ─────────────────────────────────────
bot.hears('📊 Statistika', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const db = getDb();
    const entries = Object.entries(db.users||{});
    await ctx.replyWithHTML(`📊 <b>BOT STATISTIKASI</b>\n\n👥 Jami foydalanuvchilar: <b>${entries.length} ta</b>`);
    let report = '🆔 <b>Foydalanuvchilar:</b>\n';
    for (let i = 0; i < entries.length; i++) {
        const [id, data] = entries[i];
        const displayName = (data.name && isValidName(data.name)) ? escapeHTML(data.name) : '❓ Ismsiz';
        const line = `${i+1}. 👤 ${displayName} | ID: <code>${id}</code>\n`;
        if ((report+line).length > 4000) { await ctx.replyWithHTML(report); report = ''; }
        report += line;
    }
    if (report) await ctx.replyWithHTML(report, Markup.keyboard([["🗑 Foydalanuvchini o'chirish"],['⬅️ Orqaga']]).resize());
});
bot.hears('💰 Pullik versiya', (ctx) => { if(!isAdmin(ctx.from.id))return; isBotPaidMode=true; return ctx.reply("✅ Bot PULLIK REJIMGA o'tkazildi."); });
bot.hears('🆓 Bepul versiya',   (ctx) => { if(!isAdmin(ctx.from.id))return; isBotPaidMode=false; return ctx.reply("✅ Bot BEPUL REJIMGA o'tkazildi."); });
bot.hears(["🛑 Botni To'xtatish",'🟢 Botni Yoqish'], async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const db = getDb(); if(!db.settings) db.settings={};
    db.settings.isMaintenance = ctx.message.text.includes("To'xtatish"); saveDb(db);
    return ctx.reply(db.settings.isMaintenance ? "🔴 Bot hamma uchun to'xtatildi!" : '🟢 Bot qayta yoqildi!', adminMainKeyboard(db));
});
bot.hears(['🚀 Turbo (Yoqish)',"🚀 Turbo (O'chirish)"], async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const db = getDb(); if(!db.settings) db.settings={};
    db.settings.turboMode = ctx.message.text.includes('Yoqish'); saveDb(db);
    await ctx.reply(db.settings.turboMode ? '🚀 TURBO REJIM YOQILDI!' : "🚀 Turbo rejim o'chirildi.");
    return ctx.reply('🛠 Admin Panel', adminMainKeyboard(db));
});
bot.hears("🎭 Sohta ball qo'shish", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    return ctx.replyWithHTML(`🎭 <b>SOHTA BALL QO'SHISH</b>\n\nKimga ball qo'shmoqchisiz?`, Markup.inlineKeyboard([
        [Markup.button.callback("👤 O'zimga",'fake_score_self')],
        [Markup.button.callback("👥 Boshqa foydalanuvchiga",'fake_score_other')],
        [Markup.button.callback("❌ Bekor qilish",'cancel_fake_score')],
    ]));
});
bot.hears('👥 Musobaqani boshqarish', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const db = getDb();
    const tour = db.tournament;
    if (!tour?.isActive) return ctx.replyWithHTML(`👥 <b>MUSOBAQANI BOSHQARISH</b>\n\n❌ Hozircha faol musobaqa yo'q.`, adminMainKeyboard(db));
    const totalUsers = Object.keys(db.users).length;
    const joined = tour.participants?.length || 0;
    const vipCount = Object.values(db.users).filter(u => u.isVip || vipUsers.includes(parseInt(u.id||0))).length;
    return ctx.replyWithHTML(`👥 <b>MUSOBAQANI BOSHQARISH</b>\n\n📅 ${tour.date||'—'}\n🕒 ${tour.time||'—'}\n📝 ${tour.count||'—'} ta savol\n_________________________\n\n👥 Jami: <b>${totalUsers} ta</b>\n✅ Qo'shilganlar: <b>${joined} ta</b>\n💎 VIP: <b>${vipCount} ta</b>\n\nKimni qo'shmoqchisiz?`,
        Markup.inlineKeyboard([
            [Markup.button.callback(`👥 Barcha foydalanuvchilar (${totalUsers} ta)`,'tour_add_all')],
            [Markup.button.callback(`💎 Faqat VIP (${vipCount} ta)`,'tour_add_vip')],
            [Markup.button.callback("🔍 Bitta ID bo'yicha",'tour_add_one')],
            [Markup.button.callback('❌ Bekor qilish','cancel_action')],
        ])
    );
});
bot.hears('🟢 Yoqish', (ctx) => { if(!isAdmin(ctx.from.id))return; const db=getDb(); if(!db.tournament) db.tournament={isActive:false,participants:[],results:{}}; db.tournament.isActive=true; db.tournament.results={}; saveDb(db); return ctx.reply("✅ Musobaqa rejimi yoqildi!"); });
bot.hears("🔴 O'chirish", (ctx) => { if(!isAdmin(ctx.from.id))return; const db=getDb(); if(db.tournament){db.tournament.isActive=false;saveDb(db);} return ctx.reply("🛑 Musobaqa o'chirildi."); });
bot.hears('📢 Musobaqa natijalari', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    return ctx.reply("Natijalarni hisoblab e'lon qilishni tasdiqlaysizmi?", Markup.inlineKeyboard([[Markup.button.callback("✅ Tasdiqlash va e'lon qilish",'announce_results')],[Markup.button.callback('❌ Bekor qilish','cancel_action')]]));
});
bot.hears('🚀 Musobaqani start berish', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const db = getDb();
    const tour = db.tournament;
    if (!tour?.isActive) return ctx.reply("❌ Faol musobaqa belgilanmagan!");
    if (!tour.participants.length) return ctx.reply("❌ Musobaqada hech kim ro'yxatdan o'tmagan.");
    let sent = 0;
    for (const uid of tour.participants) {
        try { await ctx.telegram.sendMessage(uid,'🔔 <b>MUSOBAQA BOSHLANDI!</b>\n\nAdmin tomonidan start berildi. Pastdagi tugmani bosing:',{parse_mode:'HTML',...Markup.inlineKeyboard([[Markup.button.callback('🏁 TESTNI BOSHLASH','start_actual_tour')]])}); sent++; } catch {}
    }
    return ctx.reply(`🚀 Musobaqa ${sent} ta ishtirokchiga yuborildi!`);
});
bot.hears('🏆 Xalqaro test musobaqa', async (ctx) => {
    const db = getDb();
    const tour = db.tournament;
    const userId = ctx.from.id;
    if (!tour?.isActive) return ctx.reply("❌ Hozircha faol musobaqa yo'q. Admin e'lonini kuting.");
    const totalSec = tour.count * 30;
    const [sh,sm] = tour.time.split(':').map(Number);
    let endMin = sm + Math.floor(totalSec/60);
    const endHour = (sh + Math.floor(endMin/60)) % 24; endMin = endMin % 60;
    const endTimeStr = `${String(endHour).padStart(2,'0')}:${String(endMin).padStart(2,'0')}`;
    const durationStr = totalSec >= 60 ? `${Math.floor(totalSec/60)} daqiqa` : `${totalSec} soniya`;
    const isJoined = tour.participants.includes(userId);
    const info = `🏆 <b>XALQARO TEST MUSOBAQA</b>\n\n📅 <b>Sana:</b> ${tour.date}\n🕒 <b>Boshlanish:</b> ${tour.time}\n🏁 <b>Tugash (taxm.):</b> ${endTimeStr}\n⏱ <b>Davomiylik:</b> ${durationStr}\n📝 <b>Savollar:</b> ${tour.count} ta\n_________________________\n`;
    if (isJoined) return ctx.replyWithHTML(`${info}\n✅ <b>Siz ro'yxatdansiz!</b>\n🚀 Musobaqa vaqtida xabar keladi.`);
    return ctx.replyWithHTML(`${info}\nMusobaqada qatnashishni tasdiqlaysizmi?`, Markup.inlineKeyboard([[Markup.button.callback("✅ Qo'shilish",'join_tour'),Markup.button.callback('❌ Rad etish','cancel_join')]]));
});
bot.hears("🏆 Musobaqaga o'tish", async (ctx) => {
    const db = getDb();
    const tour = db.tournament;
    if (!tour?.isActive) return showSubjectMenu(ctx);
    return ctx.replyWithHTML(`🏆 <b>Musobaqa rejasi</b>\n\n📅 Sana: ${tour.date}\n🕒 Vaqt: ${tour.time}\n📝 Savollar: ${tour.count} ta\n\nRo'yxatdan o'tish uchun:`, Markup.inlineKeyboard([[Markup.button.callback("✅ Ro'yxatdan o'tish",'join_tour')],[Markup.button.callback('⬅️ Fanlarga qaytish','back_to_main')]]));
});
bot.hears('🧹 Reytingni tozalash', (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    return ctx.reply('⚠️ Barcha ballarni tozalashni tasdiqlaysizmi?', Markup.inlineKeyboard([[Markup.button.callback('✅ Ha, tozalash','confirm_clear_rank')],[Markup.button.callback("❌ Yo'q",'cancel_clear')]]));
});
bot.hears("🗑 Botni Restart qilish", (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    return ctx.reply("⚠️ Barcha foydalanuvchilar ballari nolga tushiriladi.\n\nDavom etasizmi?", Markup.inlineKeyboard([[Markup.button.callback('✅ Ha, tozalash','confirm_full_restart')],[Markup.button.callback("❌ Yo'q",'cancel_restart')]]));
});
bot.hears('📣 Xabar tarqatish', (ctx) => { if(!isAdmin(ctx.from.id))return; ctx.session.waitingForForward=true; return ctx.reply("Yubormoqchi bo'lgan xabaringizni yuboring:", Markup.keyboard([['🚫 Bekor qilish']]).resize()); });
bot.hears(/^⏱ Vaqt: \d+s$/, (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    ctx.session.waitingForTime = true;
    const cur = botSettings?.timeLimit || 30;
    return ctx.reply(`⏱ Hozirgi vaqt: <b>${cur} sekund</b>\n\nYangi vaqtni <b>soniyalarda</b> kiriting:`,{parse_mode:'HTML',...Markup.keyboard([['🚫 Bekor qilish']]).resize()});
});
bot.hears('➕ Yangi fan qoshish', (ctx) => { if(!isAdmin(ctx.from.id))return; ctx.session.waitingForSubjectName=true; return ctx.reply("Yangi fan nomini kiriting:", Markup.keyboard([['🚫 Bekor qilish']]).resize()); });
bot.hears(["🗑 Foydalanuvchini o'chirish"], (ctx) => { if(!isAdmin(ctx.from.id))return; ctx.session.adminStep='wait_delete_id'; return ctx.reply("🗑 O'chirmoqchi bo'lgan foydalanuvchining ID raqamini kiriting:"); });
bot.hears(['⬅️ Orqaga (Admin)','⬅️ Orqaga'], (ctx) => { if(!isAdmin(ctx.from.id))return; return ctx.reply('Admin paneli:', adminMainKeyboard(getDb())); });
bot.hears('🏆 Haftalik musobaqa', (ctx) => { if(!isAdmin(ctx.from.id))return; ctx.session.adminStep='wait_tour_date'; return ctx.reply("📅 Musobaqa sanasini kiriting (masalan: 09.03.2026):", Markup.keyboard([['🚫 Bekor qilish']]).resize()); });

// ============================================================
// ASOSIY MATN / MEDIA HANDLER
// ============================================================
bot.on(['text','photo','video','animation','document'], async (ctx, next) => {
    const msgText = ctx.message.text || ctx.message.caption || '';
    const userId  = ctx.from.id;
    const username = ctx.from.username || 'Lichka yopiq';
    const s = ctx.session;
    if (msgText.startsWith('/')) return next();
    if (msgText === '🚫 Bekor qilish') {
        s.waitingForForward = s.waitingForTime = s.waitingForSubjectName = s.waitingForSubjectQuestions = s.waitingForName = false;
        s.adminStep = null; s.fakeScoreTarget = null; s.fakeScoreUserId = null;
        return showSubjectMenu(ctx);
    }
    // VIP chek
    if (s.waitingForReceipt && ctx.message.photo) {
        s.waitingForReceipt = false;
        const fileId = ctx.message.photo[ctx.message.photo.length-1].file_id;
        await ctx.telegram.sendPhoto(ADMIN_ID, fileId, {
            caption:`🔔 <b>Yangi to'lov!</b>\n👤 ${escapeHTML(ctx.from.first_name)}\n🆔 <code>${userId}</code>`,
            parse_mode:'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback('✅ Tasdiqlash',`approve_${userId}`)],[Markup.button.callback('❌ Rad etish',`reject_vip_${userId}`)]])
        });
        return ctx.reply("✅ Chekingiz adminga yuborildi. Tasdiqlangach xabar boradi.");
    }
    // Admin — xabar tarqatish
    if (isAdmin(userId) && s.waitingForForward) {
        s.waitingForForward = false;
        const db = getDb();
        const users = Object.keys(db.users||{});
        await ctx.reply(`📣 ${users.length} kishiga yuborilmoqda...`);
        let success = 0;
        for (const uid of users) {
            try { await ctx.telegram.copyMessage(uid, ctx.chat.id, ctx.message.message_id); success++; if (success%25===0) await new Promise(r=>setTimeout(r,500)); } catch {}
        }
        await ctx.reply(`✅ Xabar yuborildi!\nJami: ${users.length} | Muvaffaqiyatli: ${success}`);
        return showSubjectMenu(ctx);
    }
    // Admin — vaqt
    if (isAdmin(userId) && s.waitingForTime) {
        const val = parseInt(msgText);
        if (isNaN(val) || val < 5) return ctx.reply('❌ Xato raqam! Kamida 5 kiriting:');
        botSettings.timeLimit = val; saveSettings(botSettings); s.waitingForTime = false;
        await ctx.reply(`✅ Savol vaqti <b>${val} sekund</b>ga yangilandi.`,{parse_mode:'HTML'});
        return ctx.reply('🛠 Admin Panel:', adminMainKeyboard(getDb()));
    }
    // Admin — yangi fan
    if (isAdmin(userId) && s.waitingForSubjectName) { s.newSubName=msgText; s.waitingForSubjectName=false; s.waitingForSubjectQuestions=true; return ctx.reply(`"${msgText}" fani uchun savollarni JSON formatida yuboring:`, Markup.keyboard([['🚫 Bekor qilish']]).resize()); }
    if (isAdmin(userId) && s.waitingForSubjectQuestions) {
        try {
            const qs = JSON.parse(msgText);
            const key = s.newSubName.toLowerCase().replace(/ /g,'_');
            SUBJECTS[key] = { title:s.newSubName, questions:qs };
            writeJSON(PATHS.customQ, SUBJECTS); s.waitingForSubjectQuestions=false;
            await ctx.reply("✅ Yangi fan muvaffaqiyatli qo'shildi!");
            return showSubjectMenu(ctx);
        } catch { return ctx.reply("❌ JSON formati noto'g'ri! Tekshirib qaytadan yuboring:"); }
    }

    // ✅ TO'G'RI: Admin sohta ball — o'ziga (user.score ga yozadi!)
    if (isAdmin(userId) && s.adminStep === 'wait_fake_score_amount_self') {
        const amount = parseFloat(msgText);
        if (isNaN(amount) || amount <= 0) return ctx.reply('❌ Noto\'g\'ri miqdor! Musbat raqam kiriting:');
        const db = getDb();
        if (!db.users[userId]) db.users[userId] = { id:userId, name:'Admin', username:ctx.from.username||'admin', score:0, totalTests:0, totalCorrect:0, totalWrong:0 };
        const u = db.users[userId];
        const before = parseFloat(u.score||0).toFixed(1);
        u.score        = (u.score        || 0) + amount;
        u.totalTests   = (u.totalTests   || 0) + 1;
        u.totalCorrect = (u.totalCorrect || 0) + amount;
        saveDb(db);
        s.adminStep = null; s.fakeScoreTarget = null;
        await ctx.replyWithHTML(`✅ <b>Ball muvaffaqiyatli qo'shildi!</b>\n\n👤 Admin (o'zingiz)\n💰 Qo'shildi: <b>+${amount}</b> ball\n📊 Oldingi: <b>${before}</b>\n🏆 Yangi: <b>${parseFloat(u.score).toFixed(1)}</b>`);
        return ctx.reply('🛠 Admin Panel', adminMainKeyboard(getDb()));
    }
    // ✅ TO'G'RI: Admin sohta ball — boshqa user TG ID
    if (isAdmin(userId) && s.adminStep === 'wait_fake_score_tgid') {
        const rawInput = msgText.trim();
        const targetId = parseInt(rawInput);
        if (isNaN(targetId)) return ctx.reply('Notogri ID! Faqat raqam kiriting:');

        const db  = getDb();
        const wu  = getWebUsers();

        // Virtual ID 7777 = Mercury (web-only)
        const WEB_VIRTUAL_IDS = { 7777: 'mercury', 3333: 'cmbk' };

        if (WEB_VIRTUAL_IDS[targetId]) {
            const wKey = WEB_VIRTUAL_IDS[targetId];
            const wUser = wu[wKey];
            if (!wUser) return ctx.replyWithHTML(`ID: ${targetId} - bu foydalanuvchi topilmadi.`);
            s.fakeScoreUserId  = targetId;
            s.fakeScoreIsWeb   = true;   // web-only belgisi
            s.fakeScoreWebKey  = wKey;
            s.adminStep        = 'wait_fake_score_amount_other';
            return ctx.replyWithHTML(
                `Foydalanuvchi topildi!

` +
                `Ism: <b>${escapeHTML(wUser.name||wKey)}</b>
` +
                `Nikname: <b>@${escapeHTML(wUser.nickname||wKey)}</b>
` +
                `ID: <code>${targetId}</code> (web-only)
` +
                `Joriy ball: <b>${parseFloat(wUser.score||0).toFixed(1)}</b>

` +
                `Qoshmoqchi bolgan ball miqdorini kiriting:`
            );
        }

        const user = db.users[targetId];
        if (!user) {
            // web_users dan ham qidirish (nickname yoki username bo'yicha)
            const wByNick = Object.entries(wu).find(([,u])=>
                String(u.tgId)===String(targetId) ||
                (u.nickname||'').toLowerCase()===rawInput.toLowerCase() ||
                (u.username||'').toLowerCase()===rawInput.toLowerCase()
            );
            if(wByNick){
                const [wKey2, wUser2] = wByNick;
                s.fakeScoreUserId = targetId;
                s.fakeScoreIsWeb  = true;
                s.fakeScoreWebKey = wKey2;
                s.adminStep       = 'wait_fake_score_amount_other';
                return ctx.replyWithHTML(
                    `Foydalanuvchi topildi!

` +
                    `Ism: <b>${escapeHTML(wUser2.name||wKey2)}</b>
` +
                    `Nikname: <b>@${escapeHTML(wUser2.nickname||wKey2)}</b>
` +
                    `Joriy ball: <b>${parseFloat(wUser2.score||0).toFixed(1)}</b>

` +
                    `Qoshmoqchi bolgan ball miqdorini kiriting:`
                );
            }
            return ctx.replyWithHTML(`ID: ${targetId} li foydalanuvchi topilmadi.`);
        }
        s.fakeScoreUserId = targetId;
        s.fakeScoreIsWeb  = false;
        s.adminStep       = 'wait_fake_score_amount_other';
        return ctx.replyWithHTML(
            `Foydalanuvchi topildi!

` +
            `Ism: <b>${escapeHTML(user.name||'Nomalum')}</b>
` +
            `ID: <code>${targetId}</code>
` +
            `Joriy ball: <b>${parseFloat(user.score||0).toFixed(1)}</b>

` +
            `Qoshmoqchi bolgan ball miqdorini kiriting:`
        );
    }
    if (isAdmin(userId) && s.adminStep === 'wait_fake_score_amount_other') {
        const amount = parseFloat(msgText);
        const targetId  = s.fakeScoreUserId;
        const isWebUser = s.fakeScoreIsWeb || false;
        const webKey    = s.fakeScoreWebKey || null;

        if (isNaN(amount) || amount <= 0) return ctx.reply('Notogri miqdor! Musbat raqam kiriting:');
        if (!targetId) { s.adminStep=null; return ctx.reply('Xatolik. Qaytadan urinib koring.'); }

        s.adminStep=null; s.fakeScoreUserId=null; s.fakeScoreIsWeb=null; s.fakeScoreWebKey=null;

        if (isWebUser && webKey) {
            // Web-only foydalanuvchi (Mercury va boshqalar)
            const wu = getWebUsers();
            const wUser = wu[webKey];
            if (!wUser) return ctx.reply('Foydalanuvchi topilmadi.');
            const before = parseFloat(wUser.score||0).toFixed(1);
            wUser.score        = (parseFloat(wUser.score)||0)   + amount;
            wUser.totalTests   = (parseInt(wUser.totalTests)||0) + 1;
            wUser.totalCorrect = (parseInt(wUser.totalCorrect)||0) + amount;
            wu[webKey] = wUser;
            saveWebUsers(wu);
            await ctx.replyWithHTML(
                `Ball qoshildi!

` +
                `Foydalanuvchi: <b>${escapeHTML(wUser.name||webKey)}</b>
` +
                `Nikname: <b>@${escapeHTML(wUser.nickname||webKey)}</b>
` +
                `Qoshildi: <b>+${amount}</b> ball
` +
                `Oldingi: <b>${before}</b>
` +
                `Yangi: <b>${parseFloat(wUser.score).toFixed(1)}</b>`
            );
        } else {
            // Oddiy TG foydalanuvchi
            const db = getDb();
            const user = db.users[targetId];
            if (!user) return ctx.reply('Foydalanuvchi topilmadi.');
            const before = parseFloat(user.score||0).toFixed(1);
            user.score        = (user.score        || 0) + amount;
            user.totalTests   = (user.totalTests   || 0) + 1;
            user.totalCorrect = (user.totalCorrect || 0) + amount;
            saveDb(db);
            await ctx.replyWithHTML(
                `Ball qoshildi!

` +
                `Foydalanuvchi: <b>${escapeHTML(user.name)}</b>
` +
                `TG ID: <code>${targetId}</code>
` +
                `Qoshildi: <b>+${amount}</b> ball
` +
                `Oldingi: <b>${before}</b>
` +
                `Yangi: <b>${parseFloat(user.score).toFixed(1)}</b>`
            );
        }
        return ctx.reply('Admin Panel', adminMainKeyboard(getDb()));
    }
    // Admin — musobaqa steps
    if (isAdmin(userId)) {
        if (s.adminStep === 'wait_tour_date') { if(msgText==='🚫 Bekor qilish'){s.adminStep=null;return ctx.reply('Bekor qilindi.');} s.tourDate=msgText; s.adminStep='wait_tour_time'; return ctx.reply('🕒 Musobaqa boshlanish soatini kiriting (masalan: 15:00):'); }
        if (s.adminStep === 'wait_tour_time') { s.tourTime=msgText; s.adminStep='wait_tour_count'; return ctx.reply('📝 Jami testlar sonini kiriting (masalan: 50):'); }
        if (s.adminStep === 'wait_tour_count') { if(isNaN(msgText))return ctx.reply('❌ Faqat raqam kiriting:'); s.tourCount=msgText; s.adminStep=null; return ctx.replyWithHTML(`🏆 <b>Yangi musobaqa tafsilotlari:</b>\n\n📅 ${s.tourDate}\n🕒 ${s.tourTime}\n📝 ${s.tourCount} ta\n\nTasdiqlaysizmi?`, Markup.inlineKeyboard([[Markup.button.callback('✅ Tasdiqlash','confirm_tour'),Markup.button.callback('❌ Rad etish','reject_tour')]])); }
        if (s.adminStep === 'wait_delete_id') {
            const delId = parseInt(msgText); s.adminStep = null;
            const db = getDb();
            if (db.users[delId]) { const userName=db.users[delId].name||'Foydalanuvchi'; delete db.users[delId]; saveDb(db); return ctx.reply(`✅ Foydalanuvchi (${escapeHTML(userName)}, ID: ${delId}) o'chirildi.`); }
            return ctx.reply("❌ Bunday ID li foydalanuvchi topilmadi.");
        }
    }
    // Ro'yxatdan o'tish
    const db = getDb();
    const user = db.users[userId];
    if (!user || !user.isRegistered) {
        if (!db.users[userId]) { db.users[userId]={id:userId,step:'wait_name',isRegistered:false,score:0,username}; saveDb(db); }
        const cu = db.users[userId];
        if (cu.step === 'wait_name') {
            const forbidden = ['📝 Akademik yozuv','📜 Tarix','➕ Matematika','💻 Dasturlash 1','🧲 Fizika','🇬🇧 Perfect English','📊 Reyting','👤 Profil','⚙️ Sozlamalar'];
            if (forbidden.includes(msgText)) return ctx.reply("❌ Menyu tugmalarini bosmang! Ism va familiyangizni yozing:", Markup.removeKeyboard());
            if (!isValidName(msgText)) return ctx.replyWithHTML(`❌ <b>Bu ism sifatida qabul qilinmadi!</b>\n\nHaqiqiy ism va familiyangizni kiriting.\nMasalan: <i>Abdullayev Jasur</i>`, Markup.removeKeyboard());
            cu.name=msgText.trim(); cu.step='wait_univ'; saveDb(db);
            return ctx.reply(`Rahmat, ${escapeHTML(msgText.trim())}!\n\nO'qish joyingizni tanlang:`, Markup.keyboard([['Alfraganus Universiteti','Perfect Universiteti'],['TATU','TDPU']]).oneTime().resize());
        }
        if (cu.step === 'wait_univ') { if(!['Alfraganus Universiteti','Perfect Universiteti','TATU','TDPU'].includes(msgText))return ctx.reply('⚠️ Universitetni tanlang:'); cu.univ=msgText; cu.step='wait_kurs'; saveDb(db); return ctx.reply('Nechanchi kurs?', Markup.keyboard([['1-kurs','2-kurs'],['3-kurs','4-kurs']]).oneTime().resize()); }
        if (cu.step === 'wait_kurs') { if(!['1-kurs','2-kurs','3-kurs','4-kurs'].includes(msgText))return ctx.reply('⚠️ Kursni tanlang:'); cu.kurs=msgText; cu.step='wait_yonalish'; saveDb(db); const buttons=msgText==='1-kurs'?[["Dasturiy Injiniring","Kiberxavfsizlik"],["Sun'iy intelekt"]]:[['Magistratura','Boshqa']]; return ctx.reply("Yo'nalishingizni tanlang:", Markup.keyboard(buttons).oneTime().resize()); }
        if (cu.step === 'wait_yonalish') { cu.yonalish=msgText; cu.step='wait_semester'; saveDb(db); return ctx.reply('Semestrni tanlang:', Markup.keyboard([['1-semestr','2-semestr']]).oneTime().resize()); }
        if (cu.step === 'wait_semester') {
            if (msgText === '2-semestr') return ctx.reply("❌ Hozircha faqat 1-semestr mavjud.");
            if (msgText === '1-semestr') { cu.semester=msgText; cu.isRegistered=true; cu.step='completed'; saveDb(db); await ctx.reply("✅ Ro'yxatdan o'tildi!"); return showSubjectMenu(ctx); }
            return ctx.reply('⚠️ Semestrni tanlang:');
        }
        return ctx.reply("⚠️ Davom etish uchun ismingizni kiriting!");
    }
    if (user.step === 'edit_name') {
        if (!isValidName(msgText)) return ctx.replyWithHTML("❌ <b>Bu ism sifatida qabul qilinmadi!</b>\n\nHaqiqiy ism va familiyangizni kiriting:");
        user.name=msgText.trim(); user.step='completed'; saveDb(db);
        await ctx.reply(`✅ Ism o'zgartirildi: ${escapeHTML(msgText.trim())}`);
        return showSubjectMenu(ctx);
    }
    return next();
});

// ============================================================
// CRON — MUSOBAQA GLOBAL DEADLINE
// ============================================================
let tourDeadlineTimer = null;
function scheduleTourDeadline(deadlineMs) {
    if (tourDeadlineTimer) { clearTimeout(tourDeadlineTimer); tourDeadlineTimer = null; }
    const remaining = deadlineMs - Date.now();
    if (remaining <= 0) { setImmediate(() => forceFinishAllParticipants()); return; }
    console.log(`⏰ Deadline taymer: ${Math.round(remaining/1000)}s qoldi`);
    tourDeadlineTimer = setTimeout(() => forceFinishAllParticipants(), remaining);
}
async function forceFinishAllParticipants() {
    if (tourDeadlineTimer) { clearTimeout(tourDeadlineTimer); tourDeadlineTimer = null; }
    const db = getDb();
    const tour = db.tournament;
    if (!tour) return;
    const parts = tour.participants || [];
    let finished = 0;
    const chunkSize = 20;
    for (let i = 0; i < parts.length; i += chunkSize) {
        const chunk = parts.slice(i, i+chunkSize);
        await Promise.allSettled(chunk.map(async (uid) => {
            if (!db.users[uid]) return;
            const alreadyDone = db.users[uid].tourFinished;
            const score = db.users[uid].tourScore || 0;
            if (!alreadyDone) { db.users[uid].tourFinished = true; finished++; }
            try {
                await bot.telegram.sendMessage(uid,
                    `⏰ <b>MUSOBAQA VAQTI TUGADI!</b>\n\n📅 ${tour.date||'—'}\n👤 Sizning natijangiz: <b>${score} ball</b>\n${alreadyDone?'✅ Siz testni o\'z vaqtida yakunlagansiz.':'⚠️ Vaqt tugaganligi sababli test avtomatik yakunlandi.'}\n\n🏆 Natijalar tez orada e'lon qilinadi!`,
                    {parse_mode:'HTML'}
                );
            } catch {}
        }));
        if (i+chunkSize < parts.length) await new Promise(r => setTimeout(r,600));
    }
    db.tournament.isActive = false;
    saveDb(db);
    console.log(`✅ Deadline: ${finished} yangi yakunladi`);
}
cron.schedule('* * * * *', async () => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const db = getDb();
    const tour = db.tournament;
    if (!tour?.isActive || !tour.time) return;
    if (tour.time === currentTime && !tour.started) {
        const totalMs = (tour.count||30) * 30 * 1000;
        const deadlineTime = Date.now() + totalMs;
        db.tournament.started = true; db.tournament.startedAt = Date.now(); db.tournament.deadlineTime = deadlineTime;
        saveDb(db);
        scheduleTourDeadline(deadlineTime);
        const parts = tour.participants || [];
        const chunkSize = 25;
        for (let i = 0; i < parts.length; i += chunkSize) {
            const chunk = parts.slice(i, i+chunkSize);
            await Promise.allSettled(chunk.map(uid =>
                bot.telegram.sendMessage(uid,
                    `🔔 <b>MUSOBAQA BOSHLANDI!</b>\n\n📅 <b>${tour.date}</b> · 🕒 <b>${tour.time}</b>\n📝 Savollar: <b>${tour.count} ta</b>\n⏱ Umumiy vaqt: <b>${Math.round(totalMs/60000)} daqiqa</b>\n\n⚠️ Testni boshlamasangiz, <b>0 ball</b> bilan yakunlanadi!\n\n👇 Testni boshlang:`,
                    {parse_mode:'HTML',...Markup.inlineKeyboard([[Markup.button.callback('🏁 TESTNI BOSHLASH','start_actual_tour')]])}
                ).catch(()=>{})
            ));
            if (i+chunkSize < parts.length) await new Promise(r => setTimeout(r,500));
        }
        return;
    }
    if (tour.started && tour.deadlineTime && Date.now() >= tour.deadlineTime && tour.isActive) {
        console.log('🏁 Cron zahira: deadline o\'tib ketgan, tugatmoqda...');
        await forceFinishAllParticipants();
    }
});
(async () => {
    await new Promise(r => setTimeout(r,3000));
    try {
        const db = getDb();
        const tour = db.tournament;
        if (tour?.isActive && tour.started && tour.deadlineTime) {
            const remaining = tour.deadlineTime - Date.now();
            if (remaining > 0) { console.log(`🔄 Bot restart: deadline tiklandi (${Math.round(remaining/1000)}s)`); scheduleTourDeadline(tour.deadlineTime); }
            else { console.log('⚠️ Bot restart: deadline o\'tib ketgan'); await forceFinishAllParticipants(); }
        }
    } catch (err) { console.error('[Restart recovery]', err.message); }
})();

// ============================================================
// EXPRESS API
// ============================================================

// ─── Foto ─────────────────────────────────────────────────────────
app.post('/api/save-photo', (req, res) => {
    try {
        const { username, photoData, isAdmin: isAdminUser } = req.body;
        if (!photoData) return res.status(400).json({error:'photoData kerak'});
        const photos = getPhotos();
        const key = isAdminUser ? '__admin__' : username;
        if (!key) return res.status(400).json({error:'username kerak'});
        photos[key] = { data:photoData, updatedAt:Date.now() };
        savePhotos(photos);
        res.json({ success:true });
    } catch (err) { console.error('[Photo save]', err.message); res.status(500).json({error:'Xatolik'}); }
});
app.get('/api/photos', (req, res) => {
    try {
        const photos = getPhotos();
        const result = {};
        const db = getDb();
        Object.keys(photos).forEach(key => { result[key] = photos[key].data; });
        Object.values(db.users).forEach(u => {
            if (u.username && u.name) {
                const clean = (u.username||'').replace('@','').toLowerCase();
                if (photos[clean]) result[u.name] = photos[clean].data;
            }
        });
        res.json(result);
    } catch (err) { res.status(500).json({error:'Xatolik'}); }
});
app.get('/api/telegram-photo/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const db = getDb();
        let targetId = null;
        if (/^\d+$/.test(userId)) { targetId = parseInt(userId); }
        else { for (const [id,u] of Object.entries(db.users||{})) { if ((u.name||'').toLowerCase().trim()===userId.toLowerCase().trim()) { targetId=parseInt(id); break; } } }
        if (!targetId) return res.status(404).json({error:'Foydalanuvchi topilmadi'});
        try {
            const photos = await bot.telegram.getUserProfilePhotos(targetId, {limit:1});
            if (!photos.total_count || !photos.photos[0]?.length) return res.status(404).json({error:"Rasm yo'q"});
            const fileId = photos.photos[0][photos.photos[0].length-1].file_id;
            const fileInfo = await bot.telegram.getFile(fileId);
            const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.file_path}`;
            const https = require('https');
            https.get(fileUrl, (imgRes) => { res.setHeader('Content-Type', imgRes.headers['content-type']||'image/jpeg'); res.setHeader('Cache-Control','public, max-age=3600'); imgRes.pipe(res); }).on('error', () => res.status(500).json({error:'Rasm yuklanmadi'}));
        } catch { res.status(404).json({error:'Rasm olinmadi'}); }
    } catch (err) { res.status(500).json({error:'Xatolik'}); }
});

// ─── Foydalanuvchilar ──────────────────────────────────────────────
app.get('/api/users-map', (req, res) => {
    try {
        const db = getDb();
        const result = {};
        Object.entries(db.users||{}).forEach(([id,u]) => { if (u.name) result[u.name.toLowerCase().trim()] = {id:parseInt(id), name:u.name, username:u.username||''}; });
        res.json(result);
    } catch (err) { res.status(500).json({error:'Xatolik'}); }
});
app.get('/api/user-stats', (req, res) => {
    const nameQ = (req.query.name||'').toLowerCase().trim();
    const usernameQ = (req.query.username||'').toLowerCase().trim();
    if (!nameQ && !usernameQ) return res.status(400).json({error:'name yoki username kerak'});
    const db = getDb();
    let user = null;
    if (nameQ) user = Object.values(db.users).find(u => (u.name||'').toLowerCase().trim() === nameQ);
    if (!user && usernameQ) user = Object.values(db.users).find(u => (u.username||'').toLowerCase().replace('@','').trim() === usernameQ.replace('@',''));
    if (!user) return res.status(404).json({error:'Topilmadi'});
    res.json({ score:user.score||0, totalTests:user.totalTests||0, totalCorrect:user.totalCorrect||null, totalWrong:user.totalWrong||null, univ:user.univ||'—', kurs:user.kurs||'—', yonalish:user.yonalish||'—', isVip:user.isVip||false, vipStart:user.vipStart||null, vipEnd:user.vipEnd||null, subjects:user.subjects||{} });
});

// ─── Web Auth ──────────────────────────────────────────────────────
app.post('/api/web-auth/register', (req, res) => {
    try {
        const { username, name, password } = req.body;
        if (!username||!name||!password) return res.status(400).json({error:'missing_fields'});
        const u = username.toLowerCase().trim();
        if (!/^[a-z0-9_]{3,}$/.test(u)) return res.status(400).json({error:'invalid_username'});
        if (name.trim().length < 3) return res.status(400).json({error:'invalid_name'});
        if (password.length < 6) return res.status(400).json({error:'invalid_password'});
        const webUsers = getWebUsers();
        const db = getDb();
        if (webUsers[u]) return res.status(409).json({error:'exists'});
        if (Object.values(db.users||{}).find(usr => (usr.username||'').replace('@','').toLowerCase()===u)) return res.status(409).json({error:'exists'});
        webUsers[u] = { username:u, name:name.trim(), password, photo:null, createdAt:Date.now() };
        saveWebUsers(webUsers);
        res.json({ success:true, user:{username:u, name:name.trim()} });
    } catch (err) { console.error('[web-register]', err.message); res.status(500).json({error:'server_error'}); }
});
app.post('/api/web-auth/login', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username||!password) return res.status(400).json({error:'missing_fields'});
        const u = username.toLowerCase().trim();
        const webUsers = getWebUsers();
        if (webUsers[u]) {
            if (webUsers[u].password !== password) return res.status(401).json({error:'wrong_password'});
            return res.json({ success:true, user:{username:u, name:webUsers[u].name, photo:webUsers[u].photo||null, createdAt:webUsers[u].createdAt} });
        }
        return res.status(404).json({error:'notfound'});
    } catch (err) { console.error('[web-login]', err.message); res.status(500).json({error:'server_error'}); }
});
app.get('/api/web-auth/me', (req, res) => {
    try {
        const u = (req.query.username||'').toLowerCase().trim();
        if (!u) return res.status(400).json({error:'missing'});
        const webUsers = getWebUsers();
        if (!webUsers[u]) return res.status(404).json({error:'notfound'});
        res.json({ success:true, user:{username:u, name:webUsers[u].name, photo:webUsers[u].photo||null, createdAt:webUsers[u].createdAt} });
    } catch (err) { res.status(500).json({error:'server_error'}); }
});
app.post('/api/web-auth/reset-password', (req, res) => {
    try {
        const { username, newPassword } = req.body;
        if (!username||!newPassword) return res.status(400).json({error:'missing_fields'});
        if (newPassword.length < 6) return res.status(400).json({error:'too_short'});
        const u = username.toLowerCase().trim();
        const webUsers = getWebUsers();
        if (!webUsers[u]) return res.status(404).json({error:'notfound'});
        webUsers[u].password = newPassword; webUsers[u].updatedAt = Date.now();
        saveWebUsers(webUsers);
        res.json({ success:true });
    } catch (err) { res.status(500).json({error:'server_error'}); }
});
app.post('/api/web-auth/update', (req, res) => {
    try {
        const { username, newUsername, name, newPassword } = req.body;
        if (!username) return res.status(400).json({error:'missing'});
        const u = username.toLowerCase().trim();
        const webUsers = getWebUsers();
        if (!webUsers[u]) return res.status(404).json({error:'notfound'});
        if (newUsername && newUsername !== u) {
            const nu = newUsername.toLowerCase().trim();
            if (webUsers[nu]) return res.status(409).json({error:'username_taken'});
            webUsers[nu] = {...webUsers[u], username:nu};
            if (name) webUsers[nu].name = name;
            if (newPassword && newPassword.length >= 6) webUsers[nu].password = newPassword;
            webUsers[nu].updatedAt = Date.now();
            delete webUsers[u]; saveWebUsers(webUsers);
            return res.json({ success:true, newUsername:nu });
        }
        if (name) webUsers[u].name = name;
        if (newPassword && newPassword.length >= 6) webUsers[u].password = newPassword;
        webUsers[u].updatedAt = Date.now(); saveWebUsers(webUsers);
        res.json({ success:true });
    } catch (err) { res.status(500).json({error:'server_error'}); }
});

// ─── Chat ──────────────────────────────────────────────────────────
app.post('/api/chat/send', async (req, res) => {
    try {
        const { fromName, toName, text, imageData } = req.body;
        if (!fromName||!toName||(!text?.trim()&&!imageData)) return res.status(400).json({error:'Parametrlar yetishmayapti'});
        const chats = getChatMsgs();
        const cid = chatId(fromName, toName);
        if (!chats[cid]) chats[cid] = [];
        const msg = { id:Date.now()+'_'+Math.random().toString(36).slice(2,7), from:fromName, to:toName, text:text?.trim()||'', imageData:imageData||null, ts:Date.now(), read:false };
        chats[cid].push(msg);
        if (chats[cid].length > 500) chats[cid] = chats[cid].slice(-500);
        saveChatMsgs(chats);
        res.json({ success:true, msg });
        try {
            const db = getDb();
            const toLow = (toName||'').toLowerCase().trim();
            for (const [uid,u] of Object.entries(db.users||{})) {
                if ((u.name||'').toLowerCase().trim()===toLow || (u.username||'').replace('@','').toLowerCase()===toLow) {
                    await bot.telegram.sendMessage(uid,`💬 <b>Yangi xabar!</b>\n👤 <b>Kimdan:</b> ${fromName}\n📝 ${imageData?'🖼️ Rasm':(text||'').slice(0,100)}`,{parse_mode:'HTML'}).catch(()=>{});
                    break;
                }
            }
        } catch {}
    } catch (err) { console.error('[Chat send]', err.message); res.status(500).json({error:'Xatolik'}); }
});
app.get('/api/chat/messages', (req, res) => {
    try {
        const { name1, name2, since=0 } = req.query;
        if (!name1||!name2) return res.status(400).json({error:'name1 va name2 kerak'});
        const chats = getChatMsgs();
        const cid = chatId(name1, name2);
        const msgs = (chats[cid]||[]).filter(m => m.ts > parseInt(since) && ((m.from===name1&&m.to===name2)||(m.from===name2&&m.to===name1)));
        res.json({ messages:msgs });
    } catch (err) { res.status(500).json({error:'Xatolik'}); }
});
app.post('/api/chat/read', (req, res) => {
    try {
        const { myName, otherName } = req.body;
        if (!myName||!otherName) return res.status(400).json({error:'Parametrlar kerak'});
        const chats = getChatMsgs();
        const cid = chatId(myName, otherName);
        const myLow = myName.toLowerCase().trim();
        if (chats[cid]) { chats[cid].forEach(m => { if ((m.to||'').toLowerCase().trim()===myLow) m.read=true; }); saveChatMsgs(chats); }
        res.json({ success:true });
    } catch (err) { res.status(500).json({error:'Xatolik'}); }
});
app.post('/api/chat/delete', (req, res) => {
    try {
        const { myName, otherName } = req.body;
        if (!myName||!otherName) return res.status(400).json({error:'Parametrlar kerak'});
        const chats = getChatMsgs();
        const cid = chatId(myName, otherName);
        if (chats[cid]) { delete chats[cid]; saveChatMsgs(chats); }
        res.json({ success:true });
    } catch (err) { console.error('[Chat delete]', err.message); res.status(500).json({error:'Xatolik'}); }
});
app.get('/api/chat/unread', (req, res) => {
    try {
        const { myName } = req.query;
        if (!myName) return res.status(400).json({error:'myName kerak'});
        const chats = getChatMsgs();
        const myLow = myName.toLowerCase().trim();
        let total = 0;
        const byChat = {};
        Object.entries(chats).forEach(([cid,msgs]) => {
            const isParticipant = msgs.some(m => (m.from||'').toLowerCase().trim()===myLow || (m.to||'').toLowerCase().trim()===myLow);
            if (!isParticipant) return;
            const unread = msgs.filter(m => (m.to||'').toLowerCase().trim()===myLow && !m.read).length;
            if (unread > 0) { total += unread; byChat[cid] = unread; }
        });
        res.json({ total, byChat });
    } catch (err) { res.status(500).json({error:'Xatolik'}); }
});
app.get('/api/chat/list', (req, res) => {
    try {
        const { myName } = req.query;
        if (!myName) return res.status(400).json({error:'myName kerak'});
        const myLow = myName.toLowerCase().trim();
        const chats = getChatMsgs();
        const list = [];
        Object.entries(chats).forEach(([cid,msgs]) => {
            if (!msgs.length) return;
            const isParticipant = msgs.some(m => (m.from||'').toLowerCase().trim()===myLow || (m.to||'').toLowerCase().trim()===myLow);
            if (!isParticipant) return;
            const last = msgs[msgs.length-1];
            const other = (last.from||'').toLowerCase().trim()===myLow ? last.to : last.from;
            const unread = msgs.filter(m => (m.to||'').toLowerCase().trim()===myLow && !m.read).length;
            list.push({ cid, otherName:other, lastMsg:last.imageData?'[Rasm 🖼️]':last.text, lastFrom:last.from, lastTs:last.ts, unread });
        });
        list.sort((a,b) => b.lastTs - a.lastTs);
        res.json(list);
    } catch (err) { console.error('[Chat list]', err.message); res.status(500).json({error:'Xatolik'}); }
});

// ─── Follow ────────────────────────────────────────────────────────
app.post('/api/follow', (req, res) => {
    try {
        const { follower, following } = req.body;
        if (!follower||!following) return res.status(400).json({error:'follower va following kerak'});
        if (follower.toLowerCase()===following.toLowerCase()) return res.status(400).json({error:"O'zingizni follow qila olmaysiz"});
        const follows = getFollows();
        const fKey = follower.toLowerCase().trim();
        if (!follows[fKey]) follows[fKey] = [];
        const targetLower = following.toLowerCase().trim();
        const idx = follows[fKey].findIndex(n => n.toLowerCase()===targetLower);
        let action;
        if (idx === -1) { follows[fKey].push(following.trim()); action='followed'; }
        else { follows[fKey].splice(idx,1); action='unfollowed'; }
        saveFollows(follows);
        res.json({ success:true, action });
    } catch (err) { res.status(500).json({error:'Xatolik'}); }
});
app.get('/api/follow-info', (req, res) => {
    try {
        const name = (req.query.name||'').toLowerCase().trim();
        const myName = (req.query.myName||'').toLowerCase().trim();
        if (!name) return res.status(400).json({error:'name kerak'});
        const follows = getFollows();
        const followers = Object.entries(follows).filter(([,list]) => list.some(n => n.toLowerCase()===name)).map(([follower]) => follower);
        const following = follows[name] || [];
        const isFollowing = myName ? (follows[myName]||[]).some(n => n.toLowerCase()===name) : false;
        res.json({ followers:followers.length, following:following.length, isFollowing });
    } catch (err) { res.status(500).json({error:'Xatolik'}); }
});
app.get('/api/follow-list', (req, res) => {
    try {
        const { name, type } = req.query;
        if (!name) return res.status(400).json({error:'name kerak'});
        const follows = getFollows();
        const nameLow = name.toLowerCase().trim();
        if (type === 'followers') {
            const result = Object.entries(follows).filter(([,list]) => list.some(n => n.toLowerCase()===nameLow)).map(([follower]) => follower);
            res.json({ followers:result });
        } else res.json({ following:follows[nameLow]||[] });
    } catch (err) { res.status(500).json({error:'Xatolik'}); }
});

// ─── Subjects ──────────────────────────────────────────────────────
app.get('/api/subjects', (req, res) => {
    try {
        const result = {};
        Object.entries(SUBJECTS).forEach(([key,sub]) => {
            if (sub && sub.questions && sub.questions.length > 0) {
                result[key] = { title:sub.title||key, questions:sub.questions.map(q => ({q:q.q, a:q.a, options:q.options, hint:q.hint||null, image:q.image||null})) };
            }
        });
        res.json(result);
    } catch (err) { console.error('[Subjects API]', err.message); res.status(500).json({error:'Xatolik'}); }
});

// ─── ✅ YAGONA va TO'G'RI Leaderboard — ball bo'yicha kamayish ──────
app.get('/api/leaderboard', (req, res) => {
    try {
        const db        = getDb();
        const webScores = getWebScores();
        const webUsers  = getWebUsers();

        // nickname map: name.lower -> nickname (web_users dan)
        const nickMap = {};
        Object.values(webUsers).forEach(wu => {
            if(wu.name && wu.nickname) nickMap[wu.name.toLowerCase().trim()] = wu.nickname;
        });

        const map = new Map(); // name.lower -> entry

        // 1. web_users — BIRINCHI (eng ishonchli manba, admin shu yerga yozadi)
        for (const [,wu] of Object.entries(webUsers)) {
            if(!wu.name || !wu.name.trim()) continue;
            const sc = parseFloat(wu.score) || 0;
            const k  = wu.name.trim().toLowerCase();
            // web-only har doim qo'shiladi (score=0 bo'lsa ham)
            // Odatiy web user - faqat score>0
            if(!wu.isWebOnly && sc <= 0) continue;
            map.set(k, {
                name:         wu.name.trim(),
                nickname:     wu.nickname || null,
                tgUsername:   wu.tgUsername || wu.username || '',
                univ:         wu.univ || '',
                kurs:         wu.kurs || '',
                yonalish:     wu.yonalish || '',
                score:        sc,
                totalTests:   parseInt(wu.totalTests)   || 0,
                totalCorrect: parseInt(wu.totalCorrect) || 0,
                totalWrong:   parseInt(wu.totalWrong)   || 0,
                isWebOnly:    wu.isWebOnly || false,
            });
        }

        // 2. Telegram (bot) foydalanuvchilari
        for (const [,u] of Object.entries(db.users||{})) {
            const sc = parseFloat(u.score) || 0;
            if(sc <= 0 || !u.name || !u.name.trim()) continue;
            const k = u.name.trim().toLowerCase();
            if(map.has(k)){
                // web_users da bor — scoreni KATTASINI olish
                const ex = map.get(k);
                const merged = Math.max(ex.score, sc);
                // Ikkalasini qo'shish (bot test + web test)
                const totalScore = sc + (ex.isWebOnly ? ex.score : 0);
                map.set(k, {...ex,
                    score:        totalScore || sc,
                    tgUsername:   (u.username||'').replace('@','') || ex.tgUsername,
                    univ:         u.univ || ex.univ,
                    kurs:         u.kurs || ex.kurs,
                    totalTests:   (parseInt(u.totalTests)||0) + (ex.isWebOnly ? parseInt(ex.totalTests)||0 : 0),
                    isWebOnly:    false,
                });
            } else {
                map.set(k, {
                    name:         u.name.trim(),
                    nickname:     nickMap[k] || null,
                    tgUsername:   (u.username||'').replace('@',''),
                    univ:         u.univ || '',
                    kurs:         u.kurs || '',
                    yonalish:     u.yonalish || '',
                    score:        sc,
                    totalTests:   parseInt(u.totalTests)   || 0,
                    totalCorrect: parseInt(u.totalCorrect) || 0,
                    totalWrong:   parseInt(u.totalWrong)   || 0,
                    isWebOnly:    false,
                });
            }
        }

        // 3. web_scores (admin qo'lda qo'shgan, boshqa joyda yo'qlar)
        for (const [,ws] of Object.entries(webScores)) {
            const sc = parseFloat(ws.score) || 0;
            if(sc <= 0 || !ws.name || !ws.name.trim()) continue;
            const k = ws.name.trim().toLowerCase();
            if(map.has(k)){
                // Allaqachon bor — scoreni yangilash (qo'shish)
                const ex = map.get(k);
                map.set(k, {...ex, score: ex.score + sc,
                    totalTests: ex.totalTests + (parseInt(ws.totalTests)||0)});
            } else {
                map.set(k, {
                    name:         ws.name.trim(),
                    nickname:     nickMap[k] || null,
                    tgUsername:   ws.username || '',
                    univ:'', kurs:'', yonalish:'',
                    score:        sc,
                    totalTests:   parseInt(ws.totalTests)   || 0,
                    totalCorrect: parseInt(ws.totalCorrect) || 0,
                    totalWrong:   parseInt(ws.totalWrong)   || 0,
                    isWebOnly:    false,
                });
            }
        }

        const sorted = Array.from(map.values()).sort((a,b) => b.score - a.score);
        res.json(sorted);
    } catch (err) { console.error('[leaderboard]', err.message); res.status(500).json({error:'Xatolik'}); }
});

// ─── ✅ YAGONA va TO'G'RI Admin add-score ──────────────────────────
// ─── Admin: Ball AYIRISH ────────────────────────────────────
app.post('/api/admin/sub-score', async (req, res) => {
    try {
        const { name, amount, fromWebapp, fromTg, clearAll } = req.body;
        if (!name || !name.trim()) return res.status(400).json({error:'Ism kiriting'});
        if (!fromWebapp && !fromTg) return res.status(400).json({error:'WebApp yoki TG tanlang'});
        // clearAll=true bo'lsa to'liq nolga tushirish, aks holda amount kerak
        if (!clearAll && (!amount || amount <= 0)) return res.status(400).json({error:'Miqdor kiriting'});

        const nameTrim = name.trim();
        const nameLow  = nameTrim.toLowerCase();
        const db  = getDb();
        let newWebScore = null;
        let newTgScore  = null;

        // ─── WebApp (web_users + web_scores) dan ayirish ────
        // MUHIM: IKKALASINI HAM tekshirish, chunki ball ikki joyda saqlanishi mumkin
        if (fromWebapp) {
            const wu = getWebUsers();
            const ws = getWebScores();

            // 1. web_users dan (Mercury, nikname bilan kirgan)
            for (const [k,v] of Object.entries(wu)) {
                const mn = (v.name||'').toLowerCase().trim() === nameLow;
                const mk = (v.nickname||'').toLowerCase() === nameLow;
                const mu = k.toLowerCase() === nameLow;
                if (!mn && !mk && !mu) continue;
                const before = parseFloat(v.score) || 0;
                v.score        = clearAll ? 0 : Math.max(0, before - amount);
                v.totalTests   = clearAll ? 0 : (parseInt(v.totalTests)||0);
                v.totalCorrect = clearAll ? 0 : (parseInt(v.totalCorrect)||0);
                v.totalWrong   = clearAll ? 0 : (parseInt(v.totalWrong)||0);
                if (clearAll) v.subjects = {};
                wu[k] = v;
                newWebScore = v.score;
                break;
            }
            saveWebUsers(wu);

            // 2. web_scores dan HAM (admin qo'shgan yozuvlar)
            // DOIM tekshirish — foundWu dan qat'iy nazar
            let wsChanged = false;
            for (const [k,v] of Object.entries(ws)) {
                const mn = (v.name||'').toLowerCase().trim() === nameLow;
                const mk = (v.nickname||'').toLowerCase() === nameLow;
                if (!mn && !mk) continue;
                const before = parseFloat(v.score) || 0;
                v.score        = clearAll ? 0 : Math.max(0, before - amount);
                v.totalTests   = clearAll ? 0 : (parseInt(v.totalTests)||0);
                v.totalCorrect = clearAll ? 0 : (parseInt(v.totalCorrect)||0);
                v.totalWrong   = clearAll ? 0 : (parseInt(v.totalWrong)||0);
                ws[k] = v;
                wsChanged = true;
                // newWebScore ni web_scores dan ham yangilash
                if (newWebScore === null) newWebScore = v.score;
            }
            if (wsChanged) saveWebScores(ws);

            if (newWebScore === null) newWebScore = 0;
        }

        // ─── Telegram (db.users) dan ayirish ────────────────
        if (fromTg) {
            for (const [uid, u] of Object.entries(db.users||{})) {
                if ((u.name||'').toLowerCase().trim() !== nameLow) continue;
                const before = parseFloat(u.score) || 0;
                u.score        = clearAll ? 0 : Math.max(0, before - amount);
                u.totalTests   = clearAll ? 0 : (parseInt(u.totalTests)||0);
                u.totalCorrect = clearAll ? 0 : (parseInt(u.totalCorrect)||0);
                u.totalWrong   = clearAll ? 0 : (parseInt(u.totalWrong)||0);
                if (clearAll) u.subjects = {};
                db.users[uid] = u; saveDb(db);
                newTgScore = u.score;
                // TG xabar
                const msg = clearAll
                    ? `Sizning barcha ballaringiz admin tomonidan tozalandi.`
                    : `Admin tomonidan -${amount} ball ayirildi. Yangi ball: ${u.score.toFixed(1)}`;
                bot.telegram.sendMessage(uid, msg).catch(()=>{});
                break;
            }
            if (newTgScore === null) newTgScore = 0;
        }

        console.log(`[sub-score] ${nameTrim}: ${clearAll?'CLEAR':'-'+amount} | webapp=${fromWebapp} tg=${fromTg}`);
        res.json({ success:true, name:nameTrim, amount, clearAll, newWebScore, newTgScore });
    } catch(err) {
        console.error('[sub-score]', err.message);
        res.status(500).json({error: err.message});
    }
});

app.post('/api/admin/add-score', async (req, res) => {
    try {
        const { name, addScore, addTests, addCorrect, addWrong, subjectKey, toWebapp, toTg } = req.body;
        if (!name||!name.trim()) return res.status(400).json({error:'Ism kiriting'});
        const nameTrim     = name.trim();
        const scoreToAdd   = parseFloat(addScore)  || 0;
        const testsToAdd   = parseInt(addTests)     || 0;
        const correctToAdd = parseInt(addCorrect)   || 0;
        const wrongToAdd   = parseInt(addWrong)     || 0;
        const subjKey      = (subjectKey||'').trim();
        // Qayerga qo'shish (default: WebApp)
        const addToWebapp  = toWebapp !== false; // default true
        const addToTg      = toTg === true;       // default false
        if (scoreToAdd <= 0 && testsToAdd <= 0) return res.status(400).json({error:'Ball yoki test miqdori kiriting'});

        const db = getDb();
        let found = false, foundId = null, newScore = 0, newTests = 0;

        // Fan statistikasini yangilash yordamchi funksiyasi
        function applySubject(u) {
            if (!subjKey) return;
            if (!u.subjects) u.subjects = {};
            if (!u.subjects[subjKey]) u.subjects[subjKey] = { tests:0, correct:0, wrong:0 };
            u.subjects[subjKey].tests   = (u.subjects[subjKey].tests   || 0) + testsToAdd;
            u.subjects[subjKey].correct = (u.subjects[subjKey].correct || 0) + correctToAdd;
            u.subjects[subjKey].wrong   = (u.subjects[subjKey].wrong   || 0) + wrongToAdd;
        }

        // 0. AVVAL web_users da tekshirish (Mercury kabi web-only foydalanuvchilar)
        if (addToWebapp) {
            const wu0 = getWebUsers();
            for (const [k,v] of Object.entries(wu0)) {
                const mn = (v.name||'').trim().toLowerCase() === nameTrim.toLowerCase();
                const mk = (v.nickname||'').trim().toLowerCase() === nameTrim.toLowerCase();
                const mu = k.toLowerCase() === nameTrim.toLowerCase();
                if (!mn && !mk && !mu) continue;
                // Bu web-only foydalanuvchi (tgId yo'q yoki isWebOnly=true)
                if (v.isWebOnly || !v.tgId) {
                    v.score        = (parseFloat(v.score)       ||0) + scoreToAdd;
                    v.totalTests   = (parseInt(v.totalTests)     ||0) + testsToAdd;
                    v.totalCorrect = (parseInt(v.totalCorrect)   ||0) + correctToAdd;
                    v.totalWrong   = (parseInt(v.totalWrong)     ||0) + wrongToAdd;
                    applySubject(v);
                    newScore = v.score; newTests = v.totalTests;
                    wu0[k] = v; saveWebUsers(wu0);
                    found = true; break;
                }
            }
        }

        // 1. Telegram foydalanuvchilarida — addToTg yoki addToWebapp
        if (!found) for (const [uid,user] of Object.entries(db.users||{})) {
            if ((user.name||'').trim().toLowerCase() !== nameTrim.toLowerCase()) continue;
            user.score        = (parseFloat(user.score)        ||0) + scoreToAdd;
            user.totalTests   = (parseInt(user.totalTests)      ||0) + testsToAdd;
            user.totalCorrect = (parseInt(user.totalCorrect)    ||0) + correctToAdd;
            user.totalWrong   = (parseInt(user.totalWrong)      ||0) + wrongToAdd;
            applySubject(user);
            newScore = user.score; newTests = user.totalTests;
            db.users[uid] = user; saveDb(db);
            found = true; foundId = parseInt(uid); break;
        }
        // 2. web_scores.json
        if (!found) {
            const ws = getWebScores();
            for (const [k,v] of Object.entries(ws)) {
                const mn=(v.name||'').trim().toLowerCase()===nameTrim.toLowerCase();
                const mk=(v.nickname||'').trim().toLowerCase()===nameTrim.toLowerCase();
                if (!mn && !mk) continue;
                v.score        = (parseFloat(v.score)       ||0) + scoreToAdd;
                v.totalTests   = (parseInt(v.totalTests)     ||0) + testsToAdd;
                v.totalCorrect = (parseInt(v.totalCorrect)   ||0) + correctToAdd;
                v.totalWrong   = (parseInt(v.totalWrong)     ||0) + wrongToAdd;
                applySubject(v);
                newScore = v.score; newTests = v.totalTests;
                ws[k] = v; saveWebScores(ws); found = true; break;
            }
        }
        // 3. web_users.json — ism YOKI nikname bo'yicha
        if (!found) {
            const wu = getWebUsers();
            for (const [k,v] of Object.entries(wu)) {
                const matchName = (v.name||'').trim().toLowerCase() === nameTrim.toLowerCase();
                const matchNick = (v.nickname||'').trim().toLowerCase() === nameTrim.toLowerCase();
                const matchUser = k.toLowerCase() === nameTrim.toLowerCase();
                if (!matchName && !matchNick && !matchUser) continue;
                v.score        = (parseFloat(v.score)       ||0) + scoreToAdd;
                v.totalTests   = (parseInt(v.totalTests)     ||0) + testsToAdd;
                v.totalCorrect = (parseInt(v.totalCorrect)   ||0) + correctToAdd;
                v.totalWrong   = (parseInt(v.totalWrong)     ||0) + wrongToAdd;
                applySubject(v);
                newScore = v.score; newTests = v.totalTests;
                wu[k] = v; saveWebUsers(wu); found = true; break;
            }
        }
        // 4. Topilmasa — web_users da yangi yaratish (getLeaderboard uchun)
        if (!found) {
            const wu4 = getWebUsers();
            const key4 = nameTrim.toLowerCase().replace(/\s+/g,'_');
            const newEntry = {
                username: key4, name: nameTrim, nickname: key4,
                score: scoreToAdd, totalTests: testsToAdd,
                totalCorrect: correctToAdd, totalWrong: wrongToAdd,
                subjects: {}, createdAt: Date.now(), addedByAdmin: true
            };
            applySubject(newEntry);
            wu4[key4] = newEntry;
            newScore = scoreToAdd; newTests = testsToAdd;
            saveWebUsers(wu4);
        }
        // 4b. Agar TG ga ham qo'shish kerak bo'lsa (addToTg=true)
        if (addToTg && !foundId) {
            // db.users dan nom bo'yicha topish va qo'shish
            const db2 = getDb();
            for (const [uid,u] of Object.entries(db2.users||{})) {
                if ((u.name||'').toLowerCase().trim() !== nameTrim.toLowerCase()) continue;
                u.score        = (parseFloat(u.score)||0) + scoreToAdd;
                u.totalTests   = (parseInt(u.totalTests)||0) + testsToAdd;
                u.totalCorrect = (parseInt(u.totalCorrect)||0) + correctToAdd;
                u.totalWrong   = (parseInt(u.totalWrong)||0) + wrongToAdd;
                db2.users[uid]=u; saveDb(db2);
                foundId=parseInt(uid);
                console.log(`[add-score] TG ga ham qoshildi: ${nameTrim} (${uid})`);
                break;
            }
        }

        // 5. Telegram xabarnoma
        if (foundId) {
            const subjName = subjKey ? Object.values(SUBJECTS).find(s=>s&&s.title&&subjKey.includes('_')?false:false)||SUBJECTS[subjKey]?.title||subjKey : '';
            bot.telegram.sendMessage(foundId,
                `🎉 <b>Tabriklaymiz!</b>\n\nAdmin sizga qo'shdi:\n`+
                (scoreToAdd>0   ? `⚡ <b>+${scoreToAdd} ball</b>\n`       : '')+
                (testsToAdd>0   ? `📝 <b>+${testsToAdd} ta test</b>\n`    : '')+
                (correctToAdd>0 ? `✅ <b>+${correctToAdd} to'g'ri</b>\n`  : '')+
                (wrongToAdd>0   ? `❌ <b>+${wrongToAdd} xato</b>\n`       : '')+
                (subjKey        ? `📚 <b>Fan: ${subjName||subjKey}</b>\n`  : '')+
                `\n📊 Jami: <b>${parseFloat(newScore).toFixed(1)} ball</b> · <b>${newTests} test</b>`,
                {parse_mode:'HTML'}
            ).catch(()=>{});
        }
        res.json({ success:true, name:nameTrim, newScore, newTests });
    } catch (err) { console.error('[admin/add-score]', err.message); res.status(500).json({error:err.message}); }
});

// ─── Tournament ────────────────────────────────────────────────────
app.get('/api/tournament', (req, res) => {
    const db = getDb();
    const tour = db.tournament || {isActive:false};
    if (tour.participants?.length) {
        tour.participantDetails = tour.participants.map(id => {
            const u = db.users[id];
            return u ? {id, name:u.name||'Foydalanuvchi', username:(u.username||'').replace('@',''), univ:u.univ||'—', kurs:u.kurs||'—', tourScore:u.tourScore||0, isVip:u.isVip||false} : {id, name:"Noma'lum", username:''};
        });
    }
    res.json(tour);
});
app.post('/api/tournament/add-all', async (req, res) => {
    try {
        const db = getDb();
        const tour = db.tournament;
        if (!tour?.isActive) return res.status(400).json({error:'Musobaqa faol emas'});
        const allUserIds = Object.keys(db.users).map(id => parseInt(id)).filter(id => !isNaN(id));
        let added = 0;
        for (const uid of allUserIds) { if (!tour.participants.includes(uid)) { tour.participants.push(uid); added++; } }
        db.tournament = tour; saveDb(db);
        let notified = 0;
        for (const uid of allUserIds) { try { await bot.telegram.sendMessage(uid,`🏆 <b>Musobaqaga qo'shildingiz!</b>\n\n📅 ${tour.date||'—'}\n🕒 ${tour.time||'—'}\n📝 ${tour.count||'—'} ta savol`,{parse_mode:'HTML'}); notified++; } catch {} }
        res.json({ success:true, total:allUserIds.length, added, notified });
    } catch (err) { res.status(500).json({error:'Xatolik'}); }
});
app.post('/api/tournament/add-user', async (req, res) => {
    try {
        const { userId } = req.body;
        const db = getDb();
        const tour = db.tournament;
        if (!tour?.isActive) return res.status(400).json({error:'Musobaqa faol emas'});
        const uid = parseInt(userId);
        if (isNaN(uid)||!db.users[uid]) return res.status(404).json({error:'Foydalanuvchi topilmadi'});
        if (!tour.participants.includes(uid)) { tour.participants.push(uid); db.tournament=tour; saveDb(db); await bot.telegram.sendMessage(uid,`🏆 <b>Musobaqaga qo'shildingiz!</b>\n\n📅 ${tour.date||'—'} · 🕒 ${tour.time||'—'}`,{parse_mode:'HTML'}).catch(()=>{}); }
        res.json({ success:true, name:db.users[uid].name||'Foydalanuvchi' });
    } catch (err) { res.status(500).json({error:'Xatolik'}); }
});
app.post('/api/reject', async (req, res) => {
    const db = getDb();
    db.tournament = {isActive:false, date:null, time:null, participants:[]};
    saveDb(db);
    for (const id of Object.keys(db.users||{})) {
        await bot.telegram.sendMessage(id,"🚫 <b>E'lon:</b> Rejalashtirilgan musobaqa bekor qilindi.",{parse_mode:'HTML',...Markup.keyboard([['📝 Akademik yozuv','📜 Tarix'],['➕ Matematika','📊 Reyting'],['👤 Profil']]).resize()}).catch(()=>{});
    }
    res.json({ success:true });
});

// ─── Web score ─────────────────────────────────────────────────────
app.post('/api/web-score', (req, res) => {
    try {
        const { name, username, score, totalQ, wrongCount, subjectKey } = req.body;
        // Web-only akkaunt (Mercury) uchun web_users ga yozish
        const wu2 = getWebUsers();
        const uKey2 = (username||'').toLowerCase().trim();
        if(uKey2 && wu2[uKey2]) {
            wu2[uKey2].score        = (parseFloat(wu2[uKey2].score)||0) + (parseFloat(score)||0);
            wu2[uKey2].totalTests   = (parseInt(wu2[uKey2].totalTests)||0) + 1;
            wu2[uKey2].totalCorrect = (parseInt(wu2[uKey2].totalCorrect)||0) + Math.max(0,(parseInt(totalQ)||0)-(parseInt(wrongCount)||0));
            wu2[uKey2].totalWrong   = (parseInt(wu2[uKey2].totalWrong)||0) + (parseInt(wrongCount)||0);
            if(subjectKey) {
                if(!wu2[uKey2].subjects) wu2[uKey2].subjects={};
                if(!wu2[uKey2].subjects[subjectKey]) wu2[uKey2].subjects[subjectKey]={tests:0,correct:0,wrong:0};
                wu2[uKey2].subjects[subjectKey].tests++;
                wu2[uKey2].subjects[subjectKey].correct+=Math.max(0,(parseInt(totalQ)||0)-(parseInt(wrongCount)||0));
                wu2[uKey2].subjects[subjectKey].wrong+=parseInt(wrongCount)||0;
            }
            saveWebUsers(wu2);
        }
        if (!name||score===undefined) return res.status(400).json({error:'name va score kerak'});
        const db = getDb();
        // Telegram user topish
        let realUserId = null;
        for (const [id,u] of Object.entries(db.users||{})) {
            if ((u.name||'').toLowerCase().trim() === (name||'').toLowerCase().trim()) { realUserId=id; break; }
        }
        if (realUserId) {
            const u = db.users[realUserId];
            u.score        = (u.score        ||0) + score;
            u.totalTests   = (u.totalTests   ||0) + 1;
            u.totalCorrect = (u.totalCorrect ||0) + score;
            u.totalWrong   = (u.totalWrong   ||0) + (wrongCount||0);
            if (subjectKey) {
                if (!u.subjects) u.subjects = {};
                if (!u.subjects[subjectKey]) u.subjects[subjectKey] = {tests:0,correct:0,wrong:0};
                u.subjects[subjectKey].tests++;
                u.subjects[subjectKey].correct += score;
                u.subjects[subjectKey].wrong   += (wrongCount||0);
            }
            saveDb(db);
            return res.json({ success:true, source:'telegram_user', newScore:u.score });
        }
        const ws = getWebScores();
        const wKey = name.toLowerCase().trim();
        if (!ws[wKey]) ws[wKey] = { name, username:username||'', score:0, totalTests:0, totalCorrect:0, totalWrong:0, subjects:{}, createdAt:Date.now() };
        ws[wKey].score        += score;
        ws[wKey].totalTests   += 1;
        ws[wKey].totalCorrect += score;
        ws[wKey].totalWrong   += (wrongCount||0);
        ws[wKey].lastActive    = Date.now();
        if (subjectKey) {
            if (!ws[wKey].subjects[subjectKey]) ws[wKey].subjects[subjectKey] = {tests:0,correct:0,wrong:0};
            ws[wKey].subjects[subjectKey].tests++;
            ws[wKey].subjects[subjectKey].correct += score;
            ws[wKey].subjects[subjectKey].wrong   += (wrongCount||0);
        }
        saveWebScores(ws);
        res.json({ success:true, source:'web_only', newScore:ws[wKey].score });
    } catch (err) { console.error('[Web score]', err.message); res.status(500).json({error:'Xatolik'}); }
});
app.post('/api/notify-non-vip', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({error:'name kerak'});
        const db = getDb();
        let userId = null;
        for (const [id,u] of Object.entries(db.users||{})) { if ((u.name||'').toLowerCase().trim()===(name||'').toLowerCase().trim()) { userId=id; break; } }
        if (!userId) return res.status(404).json({error:'Foydalanuvchi topilmadi'});
        await bot.telegram.sendMessage(userId,`💎 <b>VIP A'zolik kerak!</b>\n\nWeb orqali test ishlash uchun VIP a'zo bo'lishingiz kerak.\n\n💳 Karta: <code>4073420058363577</code>\n👤 Egasi: M.M\n💰 Summa: <b>6,000 so'm</b>`,{parse_mode:'HTML'}).catch(()=>{});
        res.json({ success:true });
    } catch (err) { res.status(500).json({error:'Xatolik'}); }
});

// ─── Activity Feed & Sessions ──────────────────────────────────────
app.post('/api/test-session', (req, res) => {
    try {
        const { name, tgUsername, subjectKey, subjectName, score, totalQ, wrongCount, durationMin } = req.body;
        if (!name||score===undefined) return res.status(400).json({error:'name va score kerak'});
        const sessions = getSessions();
        const session = { id:Date.now()+'_'+Math.random().toString(36).slice(2,7), name:name.trim(), tgUsername:(tgUsername||'').replace('@',''), subjectKey:subjectKey||'', subjectName:subjectName||subjectKey||'Test', score:score||0, totalQ:totalQ||0, wrongCount:wrongCount||0, correctCount:(totalQ||0)-(wrongCount||0), durationMin:durationMin||1, ts:Date.now() };
        sessions.unshift(session);
        saveSessions(sessions.slice(0,200));
        res.json({ success:true, session });
    } catch (err) { res.status(500).json({error:'Xatolik'}); }
});
app.get('/api/activity-feed', (req, res) => {
    try { const sessions = getSessions(); res.json(sessions.slice(0, Math.min(parseInt(req.query.limit)||30, 50))); }
    catch (err) { res.status(500).json({error:'Xatolik'}); }
});

// ─── Qo'shimcha endpointlar ───────────────────────────────────────
app.get('/api/get-photo', (req, res) => {
    try {
        const { username, isAdmin: isAdminUser } = req.query;
        const photos = getPhotos();
        const key = isAdminUser === 'true' ? '__admin__' : username;
        if (!key || !photos[key]) return res.status(404).json({ error: 'Rasm topilmadi' });
        res.json({ photoData: photos[key].data });
    } catch (err) { res.status(500).json({ error: 'Olishda xatolik' }); }
});

app.get('/api/top-user', (req, res) => {
    const db = getDb();
    const sorted = Object.values(db.users)
        .filter(u => u && isValidName(u.name) && (u.totalTests || 0) > 0)
        .sort((a, b) => (b.totalTests || 0) - (a.totalTests || 0));
    if (!sorted.length) return res.status(404).json({ error: "Hech kim yo'q" });
    const top = sorted[0];
    res.json({ name: top.name||'—', tgUsername: (top.username||'').replace('@',''), score: top.score||0, totalTests: top.totalTests||0, univ: top.univ||'—', kurs: top.kurs||'—', yonalish: top.yonalish||'—' });
});

app.get('/api/leaderboard-full', (req, res) => {
    try {
        const db = getDb();
        const sessions = getSessions();
        const sessionCounts = {};
        sessions.forEach(s => {
            const k = (s.name||'').toLowerCase().trim();
            if (!sessionCounts[k]) sessionCounts[k] = { count:0, totalMin:0 };
            sessionCounts[k].count++;
            sessionCounts[k].totalMin += (s.durationMin||1);
        });
        const users = Object.values(db.users||{})
            .filter(u => u && isValidName(u.name) && (u.score||0) > 0)
            .map(u => {
                const k = (u.name||'').toLowerCase().trim();
                const sc = sessionCounts[k] || { count:0, totalMin:0 };
                return { name:u.name, tgUsername:(u.username||'').replace('@',''), score:u.score||0, totalTests:u.totalTests||0, sessionCount:sc.count, totalMin:sc.totalMin, univ:u.univ||'', kurs:u.kurs||'', yonalish:u.yonalish||'' };
            })
            .sort((a,b) => (b.score||0) - (a.score||0));
        res.json(users);
    } catch (err) { res.status(500).json({ error: 'Xatolik' }); }
});

// ─── PWA fayllarini serve qilish ──────────────────────────────────
app.get('/manifest.json', (req, res) => {
    const p = path.join(__dirname, 'public', 'manifest.json');
    if (fs.existsSync(p)) res.sendFile(p);
    else res.status(404).json({error:'manifest.json topilmadi'});
});
app.get('/sw.js', (req, res) => {
    const p = path.join(__dirname, 'public', 'sw.js');
    if (fs.existsSync(p)) {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Service-Worker-Allowed', '/');
        res.sendFile(p);
    } else res.status(404).send('// sw.js topilmadi');
});
app.get('/icon-192.png', (req, res) => {
    const p = path.join(__dirname, 'public', 'icon-192.png');
    if (fs.existsSync(p)) res.sendFile(p);
    else res.status(404).send('Not found');
});
app.get('/icon-512.png', (req, res) => {
    const p = path.join(__dirname, 'public', 'icon-512.png');
    if (fs.existsSync(p)) res.sendFile(p);
    else res.status(404).send('Not found');
});

app.get('/', (req, res) => {
    const filePath = path.join(__dirname,'public','index.html');
    fs.readFile(filePath, (err, data) => {
        if (err) return res.status(404).send('HTML fayl topilmadi.');
        // Telegram WebApp cache ni o'chirish
        res.setHeader('Content-Type','text/html');
        res.setHeader('Cache-Control','no-cache, no-store, must-revalidate');
        res.setHeader('Pragma','no-cache');
        res.setHeader('Expires','0');
        res.setHeader('Surrogate-Control','no-store');
        res.send(data);
    });
});

// ============================================================
// XATOLARNI USHLASH
// ============================================================
bot.catch((err, ctx) => {
    if (err.response?.error_code === 403) { console.log(`🚫 User ${ctx.from?.id} botni bloklagan.`); return; }
    console.error('🔴 Xatolik:', err.message);
});

// ============================================================
// ISHGA TUSHIRISH
// ============================================================

// ═══════════════════════════════════════════════════════════
// YO'QOLGAN ENDPOINTLAR — QAYTA QO'SHILDI
// ═══════════════════════════════════════════════════════════

// ─── App versiyasi (force logout uchun) ──────────────────
const VER_PATH = path.join(DATA_DIR, 'app_version.json');
function getAppVer(){ try{ return JSON.parse(fs.readFileSync(VER_PATH,'utf8')).version||'2'; }catch{ return '2'; } }
function setAppVer(v){ try{ fs.writeFileSync(VER_PATH,JSON.stringify({version:String(v),updatedAt:Date.now()})); }catch{} }
if(!fs.existsSync(VER_PATH)) setAppVer('4'); else { const cur=parseInt(getAppVer()||'0'); if(cur<4) setAppVer('4'); }

app.get('/api/app-version',(req,res)=>{
    res.setHeader('Cache-Control','no-cache,no-store,must-revalidate');
    res.json({version:getAppVer()});
});

// ─── Force logout ─────────────────────────────────────────
app.post('/api/admin/force-logout',(req,res)=>{
    try{
        const cur=parseInt(getAppVer())||2;
        const next=String(cur+1);
        setAppVer(next);
        const wu=getWebUsers();
        let count=0;
        Object.keys(wu).forEach(k=>{ if(!wu[k].isAdmin){wu[k].nickname=null;wu[k].updatedAt=Date.now();count++;} });
        saveWebUsers(wu);
        console.log(`[Force Logout] v${cur}->v${next}, ${count} nickname tozalandi`);
        res.json({success:true,oldVersion:String(cur),newVersion:next,clearedCount:count});
    }catch(err){res.status(500).json({error:err.message});}
});

// ─── Nikname mavjudligini tekshirish ─────────────────────
app.get('/api/nickname/check',(req,res)=>{
    try{
        const nick=(req.query.nickname||'').toLowerCase().trim().replace(/^@/,'');
        if(!nick||nick.length<3) return res.status(400).json({error:'invalid'});
        if(!/^[a-z0-9_.]{3,30}$/.test(nick)) return res.status(400).json({error:'invalid',message:'Faqat lotin, raqam, _ va . (3-30 belgi)'});
        const wu=getWebUsers();
        const taken=Object.values(wu).some(u=>(u.nickname||'').toLowerCase()===nick);
        if(taken) return res.json({available:false});
        const db=getDb();
        const tgTaken=Object.values(db.users||{}).some(u=>(u.username||'').replace('@','').toLowerCase()===nick);
        res.json({available:!tgTaken});
    }catch(err){res.status(500).json({error:err.message});}
});

// ─── Nikname o'rnatish ────────────────────────────────────
app.post('/api/nickname/set',(req,res)=>{
    try{
        const {username,nickname}=req.body;
        if(!username||!nickname) return res.status(400).json({error:'missing'});
        const nick=nickname.toLowerCase().trim().replace(/^@/,'');
        if(!/^[a-z0-9_.]{3,30}$/.test(nick)) return res.status(400).json({error:'invalid'});
        const wu=getWebUsers();
        const u=username.toLowerCase().trim();
        if(!wu[u]) return res.status(404).json({error:'notfound'});
        const taken=Object.entries(wu).some(([k,v])=>k!==u&&(v.nickname||'').toLowerCase()===nick);
        if(taken) return res.status(409).json({error:'taken',message:'Bu nikname band!'});
        wu[u].nickname=nick; wu[u].updatedAt=Date.now();
        saveWebUsers(wu);
        res.json({success:true,nickname:nick});
    }catch(err){res.status(500).json({error:err.message});}
});

// ─── Login uchun nikname bo'yicha user topish ─────────────
app.get('/api/user-by-nick',(req,res)=>{
    try{
        const nick=(req.query.nickname||'').toLowerCase().trim().replace(/^@/,'');
        if(!nick) return res.status(400).json({error:'missing'});
        const wu=getWebUsers();
        // 1. nickname bo'yicha
        let found=Object.entries(wu).find(([,u])=>(u.nickname||'').toLowerCase()===nick);
        // 2. username bo'yicha
        if(!found) found=Object.entries(wu).find(([k,])=>k.toLowerCase()===nick);
        // 3. TG username bo'yicha
        if(!found) found=Object.entries(wu).find(([,u])=>(u.tgUsername||'').toLowerCase()===nick);
        if(!found) return res.status(404).json({error:'notfound'});
        const [uKey,uData]=found;
        res.json({username:uKey,name:uData.name||'',nickname:uData.nickname||uKey,univ:uData.univ||'',kurs:uData.kurs||''});
    }catch(err){res.status(500).json({error:err.message});}
});

// ─── TG orqali avtomatik login/register ──────────────────
app.post('/api/tg-auth', async (req, res) => {
    try {
        const { tgId, tgUsername, tgFirstName, tgLastName } = req.body;
        if (!tgId) return res.status(400).json({error:'tgId kerak'});

        const tgIdStr = String(tgId);
        const tgName  = [tgFirstName, tgLastName].filter(Boolean).join(' ') || tgUsername || 'Foydalanuvchi';
        const tgUsr   = (tgUsername||'').replace('@','').toLowerCase();
        const wu      = getWebUsers();
        const db      = getDb();

        // 1. web_users da tgId bilan bog'liq akkaunt bormi?
        let found = Object.entries(wu).find(([,u]) => u.tgId === tgIdStr);

        // 2. TG username bo'yicha izlash
        if (!found && tgUsr) {
            found = Object.entries(wu).find(([,u]) =>
                (u.tgUsername||'').toLowerCase() === tgUsr ||
                (u.username||'').toLowerCase() === tgUsr
            );
        }

        // 3. Bot foydalanuvchi — db.users dan ismni olish
        let botUser = db.users[tgIdStr] || null;
        if (!botUser && tgUsr) {
            for (const u of Object.values(db.users||{})) {
                if ((u.username||'').replace('@','').toLowerCase() === tgUsr) {
                    botUser = u; break;
                }
            }
        }

        const realName = botUser?.name || tgName;

        if (found) {
            // Akkaunt bor — tgId yangilash va qaytarish
            const [uKey, uData] = found;
            if (!uData.tgId) { uData.tgId = tgIdStr; wu[uKey] = uData; saveWebUsers(wu); }
            // Bot dan score sinxronlash
            if (botUser && botUser.score > (uData.score||0)) {
                uData.score        = botUser.score;
                uData.totalTests   = botUser.totalTests||0;
                uData.totalCorrect = botUser.totalCorrect||0;
                uData.totalWrong   = botUser.totalWrong||0;
                wu[uKey] = uData; saveWebUsers(wu);
            }
            return res.json({
                success: true,
                isNew:   false,
                user: {
                    username:   uKey,
                    name:       uData.name || realName,
                    nickname:   uData.nickname || uKey,
                    tgId:       tgIdStr,
                    tgUsername: tgUsr,
                    score:      uData.score || 0,
                    univ:       uData.univ || botUser?.univ || '',
                    kurs:       uData.kurs || botUser?.kurs || '',
                }
            });
        }

        // 4. Yangi akkaunt yaratish — tgUsername nikname sifatida
        let nickname = tgUsr || realName.toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,20);
        // Nikname band bo'lsa raqam qo'shish
        let base = nickname, i = 1;
        while (Object.values(wu).some(u => (u.nickname||'').toLowerCase() === nickname)) {
            nickname = base + i++;
        }
        const newKey = nickname;
        wu[newKey] = {
            username:    newKey,
            name:        realName,
            nickname:    nickname,
            password:    null, // parolsiz
            tgId:        tgIdStr,
            tgUsername:  tgUsr,
            univ:        botUser?.univ || '',
            kurs:        botUser?.kurs || '',
            yonalish:    botUser?.yonalish || '',
            score:       botUser?.score || 0,
            totalTests:  botUser?.totalTests || 0,
            totalCorrect:botUser?.totalCorrect || 0,
            totalWrong:  botUser?.totalWrong || 0,
            subjects:    botUser?.subjects || {},
            isWebOnly:   false,
            createdAt:   Date.now(),
        };
        saveWebUsers(wu);

        res.json({
            success: true,
            isNew:   true,
            user: {
                username:   newKey,
                name:       realName,
                nickname:   nickname,
                tgId:       tgIdStr,
                tgUsername: tgUsr,
                score:      wu[newKey].score,
                univ:       wu[newKey].univ,
                kurs:       wu[newKey].kurs,
            }
        });
    } catch(err) {
        console.error('[tg-auth]', err.message);
        res.status(500).json({error: err.message});
    }
});

// ─── TG profil ma'lumotlari ───────────────────────────────
app.get('/api/tg-profile',(req,res)=>{
    try{
        const {tgId,tgUsername}=req.query;
        const db=getDb();
        let user=null;
        if(tgId) user=db.users[tgId];
        if(!user&&tgUsername){
            const uLow=tgUsername.replace('@','').toLowerCase();
            for(const u of Object.values(db.users||{})){
                if((u.username||'').replace('@','').toLowerCase()===uLow){user=u;break;}
            }
        }
        if(!user||!user.isRegistered) return res.status(404).json({error:'notfound'});
        res.json({name:user.name||'',univ:user.univ||'',kurs:user.kurs||'',yonalish:user.yonalish||'',tgUsername:(user.username||'').replace('@',''),score:user.score||0,totalTests:user.totalTests||0,isVip:user.isVip||false,vipEnd:user.vipEnd||null});
    }catch(err){res.status(500).json({error:err.message});}
});

// ─── TG ID bilan bog'lash ─────────────────────────────────
app.post('/api/web-auth/link-tg',(req,res)=>{
    try{
        const {username,tgId,tgUsername}=req.body;
        if(!username) return res.status(400).json({error:'missing'});
        const u=username.toLowerCase().trim();
        const wu=getWebUsers();
        if(!wu[u]) return res.status(404).json({error:'notfound'});
        if(tgId) wu[u].tgId=String(tgId);
        if(tgUsername) wu[u].tgUsername=tgUsername.replace('@','');
        wu[u].updatedAt=Date.now();
        saveWebUsers(wu);
        res.json({success:true});
    }catch(err){res.status(500).json({error:err.message});}
});

// ─── Admin: nikname statistikasi ─────────────────────────
app.get('/api/admin/nick-stats',(req,res)=>{
    try{
        const wu=getWebUsers();
        const all=Object.values(wu);
        const users=all
            .filter(u=>u.nickname&&u.nickname.trim()&&u.nickname!=='null')
            .map(u=>({username:u.username,name:u.name||u.username,nickname:u.nickname,score:u.score||0,totalTests:u.totalTests||0,totalCorrect:u.totalCorrect||0,totalWrong:u.totalWrong||0,isWebOnly:u.isWebOnly||false,createdAt:u.createdAt||Date.now()}))
            .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
        res.json({total:users.length,totalUsers:all.length,noNickname:all.length-users.length,users});
    }catch(err){res.status(500).json({error:err.message});}
});

// ─── Admin: duplicate chatlarni tozalash ─────────────────
app.post('/api/admin/fix-chats',(req,res)=>{
    try{
        const chats=getChatMsgs();
        const merged={};
        let fixedCount=0;
        Object.entries(chats).forEach(([cid,msgs])=>{
            const parts=cid.split('__CHAT__');
            if(parts.length!==2){merged[cid]=msgs;return;}
            const canonical=[parts[0].toLowerCase().trim(),parts[1].toLowerCase().trim()].sort().join('__CHAT__');
            if(!merged[canonical]) merged[canonical]=[];
            const existing=new Set(merged[canonical].map(m=>m.id));
            msgs.forEach(m=>{if(!existing.has(m.id)){merged[canonical].push(m);existing.add(m.id);}});
            if(canonical!==cid) fixedCount++;
        });
        Object.values(merged).forEach(msgs=>msgs.sort((a,b)=>a.ts-b.ts));
        saveChatMsgs(merged);
        res.json({success:true,fixedCount,totalChats:Object.keys(merged).length});
    }catch(err){res.status(500).json({error:err.message});}
});

// ─── Parol tiklash — Telegram orqali ─────────────────────
const resetTokens=new Map();
function genToken(){return Math.random().toString(36).slice(2,9)+Date.now().toString(36);}

app.post('/api/reset-request',async(req,res)=>{
    try{
        const{nickname,newPassword,requesterUsername,fingerprint}=req.body;
        if(!nickname||!newPassword) return res.status(400).json({error:'missing'});
        if(newPassword.length<6) return res.status(400).json({error:'short_pass',message:'Parol kamida 6 belgi'});
        const nick=nickname.toLowerCase().trim().replace(/^@/,'');
        const wu=getWebUsers();
        let found=Object.entries(wu).find(([,u])=>(u.nickname||'').toLowerCase()===nick);
        if(!found) found=Object.entries(wu).find(([k,])=>k.toLowerCase()===nick);
        if(!found){
            const db=getDb();
            for(const[uid,u]of Object.entries(db.users||{})){
                const tgU=(u.username||'').replace('@','').toLowerCase();
                if(tgU===nick||(u.name||'').toLowerCase().trim()===nick){
                    const wuEntry=Object.entries(wu).find(([,w])=>(w.name||'').toLowerCase().trim()===(u.name||'').toLowerCase().trim());
                    if(wuEntry){found=wuEntry;}
                    break;
                }
            }
        }
        if(!found) return res.status(404).json({error:'notfound',message:'Bu nikname topilmadi'});
        const[uKey,uData]=found;
        let tgId=uData.tgId||null;
        if(!tgId){
            const db=getDb();
            for(const[uid,u]of Object.entries(db.users||{})){
                if((u.name||'').toLowerCase().trim()===(uData.name||'').toLowerCase().trim()){tgId=uid;break;}
            }
        }
        if(!tgId) return res.status(400).json({error:'no_tg',message:'Akkaunt Telegram ga boglanmagan'});
        for(const[t,v]of resetTokens.entries()){if(v.username===uKey)resetTokens.delete(t);}
        const token=genToken();
        const expiresAt=Date.now()+5*60*1000;
        resetTokens.set(token,{username:uKey,nickname:nick,newPassword,tgId:String(tgId),status:'pending',expiresAt,requesterUsername:(requesterUsername||'').toLowerCase().trim()||null,fingerprint:fingerprint||null,ip:req.headers['x-forwarded-for']?.split(',')[0]?.trim()||req.socket?.remoteAddress||null});
        await bot.telegram.sendMessage(tgId,
            `Parol ozgartirish sorovi\n\nAkkaunt: @${nick}\nAgar siz soramagan bolsangiz — Bekor qilish ni bosing!\n\nSorov 5 daqiqadan keyin bekor boladi.`,
            {reply_markup:{inline_keyboard:[[{text:'Tasdiqlash',callback_data:`reset_ok_${token}`},{text:'Bekor qilish',callback_data:`reset_no_${token}`}]]}}
        );
        res.json({success:true,token,expiresIn:300});
    }catch(err){console.error('[reset-request]',err.message);res.status(500).json({error:'server_error',message:'Server xatosi'});}
});

app.get('/api/reset-status',(req,res)=>{
    const{token}=req.query;
    if(!token) return res.status(400).json({error:'missing'});
    const data=resetTokens.get(token);
    if(!data) return res.json({status:'expired'});
    if(Date.now()>data.expiresAt){resetTokens.delete(token);return res.json({status:'expired'});}
    res.json({status:data.status});
});

bot.action(/^reset_ok_(.+)$/,async(ctx)=>{
    const token=ctx.match[1];
    const data=resetTokens.get(token);
    if(!data){return ctx.answerCbQuery("Sorov topilmadi yoki eskirgan");}
    if(Date.now()>data.expiresAt){resetTokens.delete(token);return ctx.answerCbQuery("Sorov vaqti tugagan");}
    const wu=getWebUsers();
    if(wu[data.username]){wu[data.username].password=data.newPassword;wu[data.username].updatedAt=Date.now();saveWebUsers(wu);}
    resetTokens.set(token,{...data,status:'approved'});
    setTimeout(()=>resetTokens.delete(token),30000);
    await ctx.editMessageText(`Parol muvaffaqiyatli ozgartirildi!\n\nAkkaunt: @${data.nickname}\nEndi yangi parol bilan kiring.`).catch(()=>{});
    ctx.answerCbQuery('Parol yangilandi!');
});

bot.action(/^reset_no_(.+)$/,async(ctx)=>{
    const token=ctx.match[1];
    const data=resetTokens.get(token);
    if(!data){return ctx.answerCbQuery("Sorov topilmadi");}
    let penaltyMsg='';
    try{
        const wu=getWebUsers();
        if(data.requesterUsername){
            const req2=wu[data.requesterUsername];
            if(req2){req2.score=(parseFloat(req2.score)||0)-100;req2.updatedAt=Date.now();wu[data.requesterUsername]=req2;saveWebUsers(wu);
            const db=getDb();for(const[uid,u]of Object.entries(db.users||{})){if((u.name||'').toLowerCase().trim()===(req2.name||'').toLowerCase().trim()){db.users[uid].score=(parseFloat(db.users[uid].score)||0)-100;saveDb(db);break;}}
            penaltyMsg=`\n\n@${req2.nickname||data.requesterUsername} dan 100 ball ayirildi!`;}
        }
    }catch(e){console.error('[Penalty]',e.message);}
    resetTokens.set(token,{...data,status:'rejected'});
    setTimeout(()=>resetTokens.delete(token),10000);
    await ctx.editMessageText(`Parol ozgartirish rad etildi.\nKimdir @${data.nickname} akkauntingizga kirmoqchi boldi.${penaltyMsg}`).catch(()=>{});
    ctx.answerCbQuery('Rad etildi');
});



// ═══════════════════════════════════════════════════════════
// YANGI FEATURE ENDPOINTLAR
// ═══════════════════════════════════════════════════════════

// ─── File paths ──────────────────────────────────────────
const STREAKS_PATH    = path.join(DATA_DIR, 'streaks.json');
const LIKES_PATH      = path.join(DATA_DIR, 'likes.json');
const BADGES_PATH     = path.join(DATA_DIR, 'badges.json');
const NOTIFS_PATH     = path.join(DATA_DIR, 'notifs.json');
const CHALLENGES_PATH = path.join(DATA_DIR, 'challenges.json');
const STORIES_PATH    = path.join(DATA_DIR, 'stories.json');
const GROUPS_PATH     = path.join(DATA_DIR, 'groups.json');
const DARK_PATH       = path.join(DATA_DIR, 'dark_prefs.json');

const getStreaks    = () => readJSON(STREAKS_PATH, {});
const saveStreaks   = (d) => writeJSON(STREAKS_PATH, d);
const getLikes      = () => readJSON(LIKES_PATH, {});
const saveLikes     = (d) => writeJSON(LIKES_PATH, d);
const getBadges     = () => readJSON(BADGES_PATH, {});
const saveBadges    = (d) => writeJSON(BADGES_PATH, d);
const getNotifs     = () => readJSON(NOTIFS_PATH, {});
const saveNotifs    = (d) => writeJSON(NOTIFS_PATH, d);
const getChallenges = () => readJSON(CHALLENGES_PATH, {});
const saveChallenges= (d) => writeJSON(CHALLENGES_PATH, d);
const getStories    = () => readJSON(STORIES_PATH, []);
const saveStories   = (d) => writeJSON(STORIES_PATH, d);
const getGroups     = () => readJSON(GROUPS_PATH, {});
const saveGroups    = (d) => writeJSON(GROUPS_PATH, d);

// ─── Badge tariflar ───────────────────────────────────────
const BADGE_DEFS = {
  first_test:   { id:'first_test',   emoji:'🎯', name:'Birinchi test',    desc:'Birinchi testni ishladi' },
  tests_10:     { id:'tests_10',     emoji:'📝', name:'10 ta test',       desc:'10 ta test ishladi' },
  tests_50:     { id:'tests_50',     emoji:'📚', name:'50 ta test',       desc:'50 ta test ishladi' },
  tests_100:    { id:'tests_100',    emoji:'🏆', name:'100 ta test',      desc:'100 ta test ishladi' },
  streak_3:     { id:'streak_3',     emoji:'🔥', name:'3 kun streak',     desc:'3 kun ketma-ket test' },
  streak_7:     { id:'streak_7',     emoji:'⚡', name:'Haftalik streak',  desc:'7 kun ketma-ket test' },
  streak_30:    { id:'streak_30',    emoji:'💎', name:'Oylik streak',     desc:'30 kun ketma-ket test' },
  accuracy_90:  { id:'accuracy_90',  emoji:'🎯', name:'Aniq nishot',      desc:'90%+ aniqlik' },
  top_10:       { id:'top_10',       emoji:'🥇', name:'Top 10',           desc:'Reytingda Top 10 ga kirdi' },
  social_10:    { id:'social_10',    emoji:'👥', name:'Mashhur',          desc:'10 ta follower' },
};

function checkAndAwardBadges(userName) {
    const wu  = getWebUsers();
    const db  = getDb();
    const badges = getBadges();
    if (!badges[userName]) badges[userName] = [];
    const userBadges = new Set(badges[userName]);
    const newBadges  = [];

    // Foydalanuvchi ma'lumotlarini topish
    let userData = Object.values(wu).find(u=>(u.nickname||u.username||'').toLowerCase()===userName.toLowerCase()||
        (u.name||'').toLowerCase()===userName.toLowerCase());
    if(!userData){
        for(const u of Object.values(db.users||{})){
            if((u.name||'').toLowerCase()===userName.toLowerCase()){userData=u;break;}
        }
    }
    if(!userData) return [];

    const tests   = parseInt(userData.totalTests)||0;
    const correct = parseInt(userData.totalCorrect)||0;
    const accuracy = tests>0 ? (correct/tests*100) : 0;

    // Streak
    const streaks = getStreaks();
    const streak  = (streaks[userName]||{}).current||0;

    // Followers
    const follows = getFollows();
    let followerCount = 0;
    Object.values(follows).forEach(list=>{
        if((list||[]).some(n=>n.toLowerCase()===userName.toLowerCase())) followerCount++;
    });

    // Badge tekshirish
    const checks = [
        ['first_test',  tests>=1],
        ['tests_10',    tests>=10],
        ['tests_50',    tests>=50],
        ['tests_100',   tests>=100],
        ['streak_3',    streak>=3],
        ['streak_7',    streak>=7],
        ['streak_30',   streak>=30],
        ['accuracy_90', accuracy>=90 && tests>=10],
        ['social_10',   followerCount>=10],
    ];

    checks.forEach(([id, cond])=>{
        if(cond && !userBadges.has(id)){
            userBadges.add(id);
            newBadges.push(BADGE_DEFS[id]);
        }
    });

    if(newBadges.length>0){
        badges[userName]=[...userBadges];
        saveBadges(badges);
    }
    return newBadges;
}

function addNotif(toUser, type, fromUser, data={}) {
    const notifs = getNotifs();
    if(!notifs[toUser]) notifs[toUser]=[];
    notifs[toUser].unshift({
        id: Date.now()+'_'+Math.random().toString(36).slice(2,5),
        type, fromUser, data,
        ts: Date.now(),
        read: false,
    });
    // Max 100 ta
    if(notifs[toUser].length>100) notifs[toUser]=notifs[toUser].slice(0,100);
    saveNotifs(notifs);
}

function updateStreak(userName) {
    const streaks = getStreaks();
    if(!streaks[userName]) streaks[userName]={current:0,max:0,lastDate:null};
    const s = streaks[userName];
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now()-86400000).toDateString();
    if(s.lastDate===today) return s; // bugun allaqachon
    if(s.lastDate===yesterday) s.current++;
    else s.current=1;
    s.max = Math.max(s.max||0, s.current);
    s.lastDate=today;
    streaks[userName]=s;
    saveStreaks(streaks);
    return s;
}

// ─── STREAK ───────────────────────────────────────────────
app.get('/api/streak', (req,res)=>{
    const name=(req.query.name||'').trim();
    if(!name) return res.status(400).json({error:'name kerak'});
    const streaks=getStreaks();
    const s=streaks[name]||{current:0,max:0,lastDate:null};
    res.json(s);
});

app.post('/api/streak/update', (req,res)=>{
    const {name}=req.body;
    if(!name) return res.status(400).json({error:'name kerak'});
    const s=updateStreak(name);
    const newBadges=checkAndAwardBadges(name);
    res.json({...s, newBadges});
});

// ─── LIKE ─────────────────────────────────────────────────
app.post('/api/like', (req,res)=>{
    try{
        const {likerName, targetName, itemId, itemType}=req.body;
        if(!likerName||!targetName||!itemId) return res.status(400).json({error:'missing'});
        const likes=getLikes();
        if(!likes[itemId]) likes[itemId]={count:0,users:[]};
        const idx=likes[itemId].users.indexOf(likerName);
        let action;
        if(idx===-1){
            likes[itemId].users.push(likerName);
            likes[itemId].count++;
            action='liked';
            if(likerName!==targetName){
                addNotif(targetName,'like',likerName,{itemId,itemType});
            }
        } else {
            likes[itemId].users.splice(idx,1);
            likes[itemId].count--;
            action='unliked';
        }
        saveLikes(likes);
        res.json({success:true,action,count:likes[itemId].count});
    }catch(err){res.status(500).json({error:err.message});}
});

app.get('/api/likes', (req,res)=>{
    const {itemId,userName}=req.query;
    if(!itemId) return res.status(400).json({error:'itemId kerak'});
    const likes=getLikes();
    const item=likes[itemId]||{count:0,users:[]};
    res.json({count:item.count, liked:userName?item.users.includes(userName):false});
});

// ─── BADGES ───────────────────────────────────────────────
app.get('/api/badges', (req,res)=>{
    const name=(req.query.name||'').trim();
    if(!name) return res.status(400).json({error:'name kerak'});
    const badges=getBadges();
    const userBadges=(badges[name]||[]).map(id=>BADGE_DEFS[id]).filter(Boolean);
    res.json({badges:userBadges, all:Object.values(BADGE_DEFS)});
});

app.post('/api/badges/check', (req,res)=>{
    const {name}=req.body;
    if(!name) return res.status(400).json({error:'name kerak'});
    const newBadges=checkAndAwardBadges(name);
    res.json({newBadges});
});

// ─── BILDIRISHNOMALAR ─────────────────────────────────────
app.get('/api/notifs', (req,res)=>{
    const name=(req.query.name||'').trim();
    if(!name) return res.status(400).json({error:'name kerak'});
    const notifs=getNotifs();
    const list=notifs[name]||[];
    const unread=list.filter(n=>!n.read).length;
    res.json({notifs:list.slice(0,50), unread});
});

app.post('/api/notifs/read', (req,res)=>{
    const {name}=req.body;
    if(!name) return res.status(400).json({error:'name kerak'});
    const notifs=getNotifs();
    if(notifs[name]) notifs[name].forEach(n=>n.read=true);
    saveNotifs(notifs);
    res.json({success:true});
});

// ─── CHALLENGE ────────────────────────────────────────────
app.get('/api/challenges', (req,res)=>{
    const challenges=getChallenges();
    const active=Object.values(challenges.active||{});
    res.json({challenges:active});
});

app.post('/api/challenge/join', (req,res)=>{
    try{
        const {name,challengeId}=req.body;
        if(!name||!challengeId) return res.status(400).json({error:'missing'});
        const ch=getChallenges();
        if(!ch.active) ch.active={};
        if(!ch.active[challengeId]) return res.status(404).json({error:'topilmadi'});
        if(!ch.active[challengeId].participants) ch.active[challengeId].participants=[];
        if(!ch.active[challengeId].participants.includes(name)){
            ch.active[challengeId].participants.push(name);
        }
        saveChallenges(ch);
        res.json({success:true});
    }catch(err){res.status(500).json({error:err.message});}
});

app.post('/api/challenge/create', (req,res)=>{
    try{
        const{title,description,goal,type,endsAt,createdBy}=req.body;
        if(!title||!goal||!type) return res.status(400).json({error:'missing'});
        const ch=getChallenges();
        if(!ch.active) ch.active={};
        const id='ch_'+Date.now();
        ch.active[id]={id,title,description:description||'',goal,type,
            endsAt:endsAt||Date.now()+7*24*60*60*1000,
            createdBy:createdBy||'Admin',
            participants:[],progress:{},
            createdAt:Date.now()};
        saveChallenges(ch);
        res.json({success:true,id});
    }catch(err){res.status(500).json({error:err.message});}
});

app.get('/api/challenge/progress', (req,res)=>{
    const{challengeId,name}=req.query;
    const ch=getChallenges();
    const c=(ch.active||{})[challengeId];
    if(!c) return res.status(404).json({error:'topilmadi'});
    res.json({challenge:c, myProgress:(c.progress||{})[name]||0});
});

// ─── STORIES (24 soat) ────────────────────────────────────
app.post('/api/story/add', (req,res)=>{
    try{
        const{name,text,score,subject,imageData}=req.body;
        if(!name) return res.status(400).json({error:'name kerak'});
        let stories=getStories();
        // 24 soatdan eski storylarni o'chirish
        const now=Date.now();
        stories=stories.filter(s=>now-s.ts<24*60*60*1000);
        stories.unshift({
            id:'s_'+Date.now(),
            name,text:text||'',score:score||0,
            subject:subject||'',
            imageData:imageData||null,
            ts:now, views:[], likes:[]
        });
        if(stories.length>200) stories=stories.slice(0,200);
        saveStories(stories);
        res.json({success:true});
    }catch(err){res.status(500).json({error:err.message});}
});

app.get('/api/stories', (req,res)=>{
    const {viewerName}=req.query;
    let stories=getStories();
    const now=Date.now();
    stories=stories.filter(s=>now-s.ts<24*60*60*1000);
    saveStories(stories); // Eski larni tozalash
    // Viewer ni qo'shish
    if(viewerName){
        const name=viewerName.trim();
        const myIdx=stories.findIndex(s=>s.name===name);
        // Mening story larimi boshiga
        const mine=myIdx>=0?stories.splice(myIdx,1):[];
        stories=[...mine,...stories];
    }
    res.json(stories.map(s=>({
        id:s.id, name:s.name, text:s.text,
        score:s.score, subject:s.subject,
        ts:s.ts, viewCount:s.views.length,
        likeCount:s.likes.length,
        viewed:viewerName?s.views.includes(viewerName):false,
        liked:viewerName?s.likes.includes(viewerName):false,
        imageData:s.imageData||null,
    })));
});

app.post('/api/story/view', (req,res)=>{
    const{storyId,viewerName}=req.body;
    let stories=getStories();
    const s=stories.find(s=>s.id===storyId);
    if(s&&viewerName&&!s.views.includes(viewerName)){
        s.views.push(viewerName);
        saveStories(stories);
    }
    res.json({success:true});
});

app.post('/api/story/like', (req,res)=>{
    const{storyId,likerName}=req.body;
    let stories=getStories();
    const s=stories.find(s=>s.id===storyId);
    if(!s) return res.status(404).json({error:'topilmadi'});
    const idx=s.likes.indexOf(likerName);
    if(idx===-1){s.likes.push(likerName);}
    else{s.likes.splice(idx,1);}
    saveStories(stories);
    res.json({success:true,liked:idx===-1,count:s.likes.length});
});

// ─── STUDY GROUPS ─────────────────────────────────────────
app.post('/api/group/create', (req,res)=>{
    try{
        const{name,groupName,description}=req.body;
        if(!name||!groupName) return res.status(400).json({error:'missing'});
        const groups=getGroups();
        const id='g_'+Date.now();
        groups[id]={id,name:groupName,description:description||'',
            creator:name,members:[name],
            createdAt:Date.now()};
        saveGroups(groups);
        res.json({success:true,id});
    }catch(err){res.status(500).json({error:err.message});}
});

app.get('/api/groups', (req,res)=>{
    const{name}=req.query;
    const groups=getGroups();
    const list=Object.values(groups);
    if(name) {
        const myGroups=list.filter(g=>g.members.includes(name));
        const otherGroups=list.filter(g=>!g.members.includes(name));
        return res.json({myGroups,otherGroups});
    }
    res.json({groups:list});
});

app.post('/api/group/join', (req,res)=>{
    const{name,groupId}=req.body;
    const groups=getGroups();
    if(!groups[groupId]) return res.status(404).json({error:'topilmadi'});
    if(!groups[groupId].members.includes(name)) groups[groupId].members.push(name);
    saveGroups(groups);
    res.json({success:true});
});

app.get('/api/group/leaderboard', (req,res)=>{
    const{groupId}=req.query;
    const groups=getGroups();
    const g=groups[groupId];
    if(!g) return res.status(404).json({error:'topilmadi'});
    const wu=getWebUsers();
    const db=getDb();
    const members=g.members.map(mName=>{
        let score=0,tests=0;
        const wUser=Object.values(wu).find(u=>(u.nickname||u.username||'').toLowerCase()===mName.toLowerCase()||(u.name||'').toLowerCase()===mName.toLowerCase());
        if(wUser){score=wUser.score||0;tests=wUser.totalTests||0;}
        else{
            for(const u of Object.values(db.users||{})){
                if((u.name||'').toLowerCase()===mName.toLowerCase()){score=u.score||0;tests=u.totalTests||0;break;}
            }
        }
        return{name:mName,score,tests};
    }).sort((a,b)=>b.score-a.score);
    res.json({group:g,leaderboard:members});
});

// ─── Dark mode preference ─────────────────────────────────
app.post('/api/dark-mode', (req,res)=>{
    const{name,dark}=req.body;
    if(!name) return res.status(400).json({error:'missing'});
    const prefs=readJSON(DARK_PATH,{});
    prefs[name]=!!dark;
    writeJSON(DARK_PATH,prefs);
    res.json({success:true});
});

// ─── Test tugagandan so'ng streak va badge yangilash ──────
// /api/web-score ga hook

// ─── Admin: Bloklash ──────────────────────────────────────
app.post('/api/admin/block-user', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId kerak' });
        const id = parseInt(userId);
        if (isNaN(id)) return res.status(400).json({ error: 'Notogri ID' });
        const blocked = getBlocked();
        if (blocked.includes(id)) return res.json({ success: true, alreadyBlocked: true, userId: id });
        blocked.push(id);
        saveBlocked(blocked);
        const db = getDb();
        const user = db.users[id];
        const name  = escapeHTML(user?.name || 'Foydalanuvchi');
        const uname = user?.username ? '@' + escapeHTML(user.username) : '';
        const uids = Object.keys(db.users);
        let notified = 0;
        const blockMsg =
            `🚫 <b>E'LON</b>\n\n` +
            `Foydalanuvchi: <b>${name}</b>\n` +
            `ID: <code>${id}</code>${uname ? '\n' + uname : ''}\n\n` +
            `<b>Bot'dan bloklandi.</b>\n\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `⚠️ <i>Ogohlantirish: Bot bilan chiroyli muomila qiling. Siz ham bloklab qo'yish — patir uchidan ignadek gap. Huslas.</i>`;
        for (let i = 0; i < uids.length; i += 25) {
            const chunk = uids.slice(i, i + 25);
            await Promise.allSettled(
                chunk.map(uid => bot.telegram.sendMessage(uid, blockMsg, { parse_mode: 'HTML' }).catch(() => {}))
            );
            notified += chunk.length;
            if (i + 25 < uids.length) await new Promise(r => setTimeout(r, 600));
        }
        res.json({ success: true, name: user?.name || 'Foydalanuvchi', userId: id, notified });
    } catch (err) {
        console.error('[block-user]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Admin: Blokdan chiqarish ─────────────────────────────
app.post('/api/admin/unblock-user', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId kerak' });
        const id = parseInt(userId);
        let blocked = getBlocked();
        const was = blocked.includes(id);
        blocked = blocked.filter(b => b !== id);
        saveBlocked(blocked);
        if (was) {
            await bot.telegram.sendMessage(id,
                `✅ <b>Blokdan chiqarildingiz!</b>\n\nEndi botdan yana foydalanishingiz mumkin.`,
                { parse_mode: 'HTML' }
            ).catch(() => {});
        }
        res.json({ success: true, wasBlocked: was, userId: id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Admin: Bloklangan ro'yxat ────────────────────────────
app.get('/api/admin/blocked-users', (req, res) => {
    try {
        const blocked = getBlocked();
        const db = getDb();
        const list = blocked.map(id => {
            const u = db.users[id] || {};
            return { id, name: u.name || "Noma'lum", username: u.username || '' };
        });
        res.json({ blocked: list, total: blocked.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

server.listen(PORT, '0.0.0.0', () => console.log(`🌐 Express+Socket.io server ${PORT}-portda`));

// ─── Socket.io connection handler ─────────────────────────
io.on('connection', (socket) => {
    const userName = socket.handshake.auth?.name;
    if (!userName) return;

    const key = userName.toLowerCase().trim();
    onlineUsers.set(key, { socketId: socket.id, name: userName });
    console.log(`🟢 [Socket] ${userName} ulandi (${onlineUsers.size} online)`);

    // Hamma ga online statusni yuborish
    io.emit('user_online', { name: userName });

    // ─── Xabar yuborish (WebSocket orqali) ────────────────
    socket.on('chat_message', async (data) => {
        try {
            const { fromName, toName, text, imageData } = data;
            if (!fromName || !toName || (!text?.trim() && !imageData)) return;

            // Bazaga saqlash
            const chats = getChatMsgs();
            const [n1, n2] = [fromName.toLowerCase().trim(), toName.toLowerCase().trim()].sort();
            const cid = n1 + '__CHAT__' + n2;
            if (!chats[cid]) chats[cid] = [];

            const msg = {
                id: Date.now() + '_' + Math.random().toString(36).slice(2,7),
                from: fromName,
                to: toName,
                text: text?.trim() || '',
                imageData: imageData || null,
                ts: Date.now(),
                read: false,
            };
            chats[cid].push(msg);
            if (chats[cid].length > 500) chats[cid] = chats[cid].slice(-500);
            saveChatMsgs(chats);

            // Yuboruvchiga confirm (tempId bilan)
            socket.emit('message_sent', { msg, tempId: data.tempId||null });

            // Qabul qiluvchiga real-time yuborish
            const toKey = toName.toLowerCase().trim();
            const toSocket = onlineUsers.get(toKey);
            if (toSocket) {
                io.to(toSocket.socketId).emit('new_message', { msg });
                console.log(`📨 [Socket] ${fromName} → ${toName} (online, realtime)`);
            } else {
                // Offline — Telegram orqali xabar
                console.log(`📭 [Socket] ${toName} offline — TG xabar yuboriladi`);
                const db = getDb();
                for (const [uid, u] of Object.entries(db.users || {})) {
                    if ((u.name||'').toLowerCase().trim() === toKey) {
                        const preview = imageData ? '🖼️ Rasm' : (text||'').slice(0,100);
                        bot.telegram.sendMessage(uid,
                            `💬 <b>Yangi xabar!</b>\n👤 <b>Kimdan:</b> ${fromName}\n📝 ${preview}`,
                            { parse_mode: 'HTML' }
                        ).catch(()=>{});
                        break;
                    }
                }
            }
        } catch (err) {
            console.error('[Socket chat_message]', err.message);
        }
    });

    // ─── Xabarni o'qilgan deb belgilash ───────────────────
    socket.on('mark_read', (data) => {
        try {
            const { myName, otherName } = data;
            if (!myName || !otherName) return;
            const chats = getChatMsgs();
            const [n1, n2] = [myName.toLowerCase().trim(), otherName.toLowerCase().trim()].sort();
            const cid = n1 + '__CHAT__' + n2;
            const myLow = myName.toLowerCase().trim();
            if (chats[cid]) {
                chats[cid].forEach(m => { if ((m.to||'').toLowerCase().trim() === myLow) m.read = true; });
                saveChatMsgs(chats);
            }
            // Yuboruvchiga ✓✓ signali
            const fromKey = otherName.toLowerCase().trim();
            const fromSocket = onlineUsers.get(fromKey);
            if (fromSocket) {
                io.to(fromSocket.socketId).emit('messages_read', { by: myName, chatWith: otherName });
            }
        } catch (err) { console.error('[Socket mark_read]', err.message); }
    });

    // ─── Typing indicator ─────────────────────────────────
    socket.on('typing', (data) => {
        const { fromName, toName, isTyping } = data;
        if (!fromName || !toName) return;
        const toKey = toName.toLowerCase().trim();
        const toSocket = onlineUsers.get(toKey);
        if (toSocket) {
            io.to(toSocket.socketId).emit('user_typing', { name: fromName, isTyping });
        }
    });

    // ─── Disconnect ───────────────────────────────────────
    socket.on('disconnect', () => {
        onlineUsers.delete(key);
        io.emit('user_offline', { name: userName });
        console.log(`🔴 [Socket] ${userName} uzildi (${onlineUsers.size} online)`);
    });
});

// Online foydalanuvchilar soni API
app.get('/api/online-count', (req, res) => {
    res.json({ count: onlineUsers.size, users: Array.from(onlineUsers.values()).map(u => u.name) });
});

const WEBHOOK_URL = process.env.WEBHOOK_URL || process.env.RAILWAY_STATIC_URL || null;

// Mercury va boshqa default akkauntlarni yaratish
function ensureDefaultChallenges(){
    const ch = getChallenges();
    if(!ch.active || Object.keys(ch.active).length === 0){
        ch.active = {
            'ch_daily': {
                id:'ch_daily', title:'Kunlik 20 ta savol',
                description:'Bugun 20 ta savol ishlang',
                goal:20, type:'tests_today',
                endsAt: Date.now()+24*60*60*1000,
                createdBy:'Admin', participants:[], progress:{},
                createdAt: Date.now()
            },
            'ch_weekly': {
                id:'ch_weekly', title:'Haftalik 100 ball',
                description:'Bu hafta 100 ball topling',
                goal:100, type:'score_week',
                endsAt: Date.now()+7*24*60*60*1000,
                createdBy:'Admin', participants:[], progress:{},
                createdAt: Date.now()
            },
            'ch_accuracy': {
                id:'ch_accuracy', title:'Aniqlik ustasi',
                description:'80%+ aniqlik bilan 10 ta test ishlang',
                goal:10, type:'accuracy_tests',
                endsAt: Date.now()+7*24*60*60*1000,
                createdBy:'Admin', participants:[], progress:{},
                createdAt: Date.now()
            },
        };
        saveChallenges(ch);
        console.log('[Init] Default challengelar yaratildi');
    }
}
ensureDefaultChallenges();

function ensureDefaultAccounts() {
    const wu = getWebUsers();
    const defaults = [
        {
            username:'mercury', name:'Mercury', nickname:'mercury',
            password:'Yusuf_bro01', tgId:'7777', tgUsername:'',
            score:0, totalTests:0, totalCorrect:0, totalWrong:0,
            subjects:{}, isWebOnly:true, addedByAdmin:true, createdAt:Date.now(),
        },
        {
            username:'cmbk', name:'CMBK', nickname:'cmbk',
            password:'Yusuf_bro01', tgId:'3333', tgUsername:'',
            score:0, totalTests:0, totalCorrect:0, totalWrong:0,
            subjects:{}, isWebOnly:true, addedByAdmin:true, createdAt:Date.now(),
        },
    ];
    let changed = false;
    for (const acc of defaults) {
        if (!wu[acc.username]) { wu[acc.username]=acc; changed=true; }
    }
    if (changed) saveWebUsers(wu);
}
ensureDefaultAccounts();

async function startBot() {
    try { await bot.telegram.deleteWebhook(); } catch {}
    if (WEBHOOK_URL) {
        const webhookPath = `/webhook/${BOT_TOKEN}`;
        const fullUrl = `${WEBHOOK_URL.replace(/\/$/,'')}${webhookPath}`;
        app.use(bot.webhookCallback(webhookPath));
        await bot.telegram.setWebhook(fullUrl, { allowed_updates:['message','callback_query','inline_query'], drop_pending_updates:true });
        console.log(`✅ Bot WEBHOOK rejimida ishga tushdi!`);
        console.log(`🔗 Webhook URL: ${fullUrl}`);
    } else {
        let attempt = 0;
        const maxAttempts = 5;
        const tryLaunch = async () => {
            attempt++;
            try { await bot.launch({ allowedUpdates:['message','callback_query','inline_query'], dropPendingUpdates:true }); console.log('✅ Bot POLLING rejimida ishga tushdi!'); }
            catch (err) {
                console.error(`❌ Bot ishga tushmadi (${attempt}/${maxAttempts}):`, err.message);
                if (attempt < maxAttempts) { const delay=attempt*3000; console.log(`⏳ ${delay/1000}s dan keyin qayta urinish...`); setTimeout(tryLaunch, delay); }
                else console.error('💀 Bot ishga tushmadi — barcha urinishlar tugadi');
            }
        };
        await tryLaunch();
    }
}

startBot().catch(err => console.error('❌ startBot xatolik:', err.message));
process.once('SIGINT',  () => { bot.stop('SIGINT');  process.exit(0); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });