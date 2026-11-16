'use strict';
// ============================================================
// ADMIN PANEL — himoyalangan API (/api/panel/*) + bot bilan umumiy amallar
//
// Kirish: botda /panel → bir martalik havola (10 daqiqa) → panel uni sessiya
// tokeniga almashtiradi (30 kun). Har bir so'rov: Authorization: Bearer <token>.
// Adminlar: ADMIN_ID va ixtiyoriy ADMIN_IDS="id1,id2" (env).
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const parser = require('./questionParser');
const ai = require('./ai');

const DAY = 86400000;
const now = () => Date.now();
const rid = (n = 8) => crypto.randomBytes(n).toString('hex');
const monthKey = (ts) => new Date(ts + 5 * 3600 * 1000).toISOString().slice(0, 7);

module.exports = function createAdminPanel(d) {
    const {
        bot, Markup, ADMIN_ID, DATA_DIR, PATHS, escapeHTML: esc,
        getDb, saveDb, getConfig, saveConfig, getSettings, saveSettings, botSettings,
        getBlocked, saveBlocked, getVipUsers, setVipUsers, saveVip, getPaidMode, setPaidMode,
        getSubjects, getRequiredChannels, saveRequiredChannels, parseChannelInput,
        getWebUsers, saveWebUsers, getWebScores, saveWebScores,
        prepareTournamentQuestions, finalizeTournament, clearTourDeadline,
        userTests, stats, readJSON, writeJSON,
    } = d;

    const ADMIN_IDS = new Set([String(ADMIN_ID), ...String(process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)]);
    const isPanelAdmin = (id) => ADMIN_IDS.has(String(id));

    // ─── Kichik JSON omborlar ─────────────────────────────────
    const file = (name) => path.join(DATA_DIR, name);
    const store = (name, def) => ({ get: () => readJSON(file(name), def), set: (v) => writeJSON(file(name), v) });
    const paymentsDb = store('payments.json', []);
    const reportsDb = store('reports.json', []);
    const auditDb = store('audit_log.json', []);
    const broadcastsDb = store('broadcasts.json', []);
    const sessionsDb = store('admin_sessions.json', {});

    function audit(who, action, target, type = 'other') {
        const log = auditDb.get();
        log.unshift({ who, action, target: String(target ?? ''), type, at: now() });
        auditDb.set(log.slice(0, 1000));
    }
    const adminName = (id) => getDb().users[id]?.name || (String(id) === String(ADMIN_ID) ? 'Admin' : `Admin ${id}`);

    // ─── Foydalanuvchi yordamchilari ──────────────────────────
    const isVip = (id, u = getDb().users[id]) => {
        if (getVipUsers().some((v) => String(v) === String(id))) return true;
        return !!(u?.isVip && (!u.vipEnd || u.vipEnd > now()));
    };
    const isBlocked = (id) => getBlocked().some((b) => String(b) === String(id));
    const fmtDate = (ts) => new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const send = (id, text, extra = {}) => bot.telegram.sendMessage(id, text, { parse_mode: 'HTML', ...extra });

    async function giveVip(id, days = 30, { notify = true, text } = {}) {
        id = parseInt(id);
        const db = getDb();
        const start = now();
        const u = db.users[id];
        // Muddati tugamagan VIP bo'lsa — ustiga qo'shiladi
        const base = u?.isVip && u.vipEnd > start ? u.vipEnd : start;
        const end = base + days * DAY;
        if (u) { u.isVip = true; u.vipStart = u.vipStart && u.vipEnd > start ? u.vipStart : start; u.vipEnd = end; saveDb(db); }
        const list = getVipUsers();
        if (!list.includes(id)) { list.push(id); saveVip(); }
        const wu = getWebUsers();
        let wuChanged = false;
        for (const w of Object.values(wu)) if (w.tgId === String(id)) { w.isVip = true; w.vipStart = start; w.vipEnd = end; wuChanged = true; }
        if (wuChanged) saveWebUsers(wu);
        if (notify) await send(id, text || `🎉 <b>VIP a'zolik berildi!</b>\n\n📅 Boshlanish: <b>${fmtDate(start)}</b>\n⏳ Tugaydi: <b>${fmtDate(end)}</b>`).catch(() => {});
        return { vipEnd: end, name: u?.name || "Noma'lum" };
    }

    async function removeVip(id, { notify = true } = {}) {
        id = parseInt(id);
        const db = getDb();
        if (db.users[id]) { db.users[id].isVip = false; db.users[id].vipEnd = null; db.users[id].vipStart = null; saveDb(db); }
        setVipUsers(getVipUsers().filter((v) => String(v) !== String(id)));
        saveVip();
        const wu = getWebUsers();
        let ch = false;
        for (const w of Object.values(wu)) if (w.tgId === String(id)) { w.isVip = false; w.vipEnd = null; w.vipStart = null; ch = true; }
        if (ch) saveWebUsers(wu);
        if (notify) await send(id, "⚠️ <b>VIP a'zoligingiz admin tomonidan bekor qilindi.</b>").catch(() => {});
    }

    async function setBlock(id, on, { notify = true } = {}) {
        id = parseInt(id);
        let list = getBlocked();
        if (on && !isBlocked(id)) list.push(id);
        if (!on) list = list.filter((b) => String(b) !== String(id));
        saveBlocked(list);
        if (notify) {
            await send(id, on
                ? "🚫 <b>Siz botdan bloklandingiz.</b>\n\nSavollar bo'lsa admin bilan bog'laning."
                : "✅ <b>Blokdan chiqarildingiz!</b>\n\nEndi botdan yana foydalanishingiz mumkin.").catch(() => {});
        }
    }

    // ─── To'lovlar (chek) ─────────────────────────────────────
    function recordPayment({ userId, name, username, fileId, amount, plan = 'VIP · 30 kun' }) {
        const list = paymentsDb.get();
        const p = { id: rid(5), userId: String(userId), name, username, fileId, amount, plan, status: 'pending', createdAt: now() };
        list.unshift(p);
        paymentsDb.set(list.slice(0, 5000));
        return p;
    }

    async function decidePayment({ paymentId, userId, approve, reason, fake = true, by = ADMIN_ID }) {
        const list = paymentsDb.get();
        const p = paymentId
            ? list.find((x) => x.id === paymentId)
            : list.find((x) => x.userId === String(userId) && x.status === 'pending');
        if (p && p.status !== 'pending') return { already: true, payment: p };
        const uid = parseInt(p?.userId || userId);
        if (p) { p.status = approve ? 'approved' : 'rejected'; p.decidedAt = now(); p.reason = reason || null; p.by = String(by); paymentsDb.set(list); }

        if (approve) {
            const r = await giveVip(uid, 30, { text: null });
            audit(adminName(by), "To'lovni tasdiqladi (VIP)", `${r.name} · ${p?.amount || ''} so'm`, 'vip');
            return { payment: p, vipEnd: r.vipEnd };
        }
        // Rad etish: soxta chek bo'lsa hisoblagich (3 marta → avtomatik blok)
        const db = getDb();
        const u = db.users[uid] || (db.users[uid] = {});
        let autoBlocked = false;
        if (fake) {
            u.fakeCheckCount = (u.fakeCheckCount || 0) + 1;
            saveDb(db);
            if (u.fakeCheckCount >= 3) { await setBlock(uid, true, { notify: false }); autoBlocked = true; }
        }
        const left = 3 - (u.fakeCheckCount || 0);
        const msg = autoBlocked
            ? "🚫 <b>Siz botdan bloklangansiz!</b>\n\n❌ Chekingiz rad etildi. Ko'p marta soxta chek yuborganingiz sababli bloklandingiz."
            : `❌ <b>Chekingiz tasdiqlanmadi.</b>${reason ? `\n\n📝 Sabab: ${esc(reason)}` : ''}${fake ? `\n\n⚠️ Yana <b>${left} ta</b> imkoniyat qoldi. Soxta chek yuborsangiz bloklanasiz.` : ''}`;
        await send(uid, msg).catch(() => {});
        audit(adminName(by), "To'lovni rad etdi", `${u.name || uid}${reason ? ` · ${reason}` : ''}`, 'vip');
        return { payment: p, autoBlocked, fakeCount: u.fakeCheckCount || 0 };
    }

    // ─── Shikoyatlar ──────────────────────────────────────────
    function recordReport({ userId, userName, subject, q, a, options }) {
        const list = reportsDb.get();
        const r = { id: rid(5), userId: String(userId), userName, subject, q, a, options: options || [], status: 'open', createdAt: now() };
        list.unshift(r);
        reportsDb.set(list.slice(0, 2000));
        return r;
    }
    function closeReportsOf(userId, status) {
        const list = reportsDb.get();
        const r = list.find((x) => x.userId === String(userId) && x.status === 'open');
        if (r) { r.status = status; r.closedAt = now(); reportsDb.set(list); }
        return r;
    }

    // ─── Savollarni saqlash (restartda yo'qolmasligi uchun custom_questions.json) ──
    function persistSubject(key) {
        const SUBJECTS = getSubjects();
        writeJSON(PATHS.subjects, SUBJECTS);
        const custom = readJSON(PATHS.customQ, {}) || {};
        if (SUBJECTS[key]) custom[key] = SUBJECTS[key]; else delete custom[key];
        writeJSON(PATHS.customQ, custom);
    }

    // ─── AI xarajatlari ───────────────────────────────────────
    const aiUsage = () => readJSON(file('ai_usage.json'), []) || [];
    let monthCostCache = { at: 0, value: 0 };
    function aiCostThisMonth() {
        if (now() - monthCostCache.at < 60000) return monthCostCache.value;
        const m = monthKey(now());
        const value = aiUsage().filter((e) => monthKey(e.ts) === m).reduce((s, e) => s + (e.costUsd || 0), 0);
        monthCostCache = { at: now(), value };
        return value;
    }
    const aiSettings = () => getSettings().ai || {};
    ai.setModelResolver((task) => aiSettings().models?.[task] || null);
    ai.setBudgetGuard(() => {
        const budget = Number(aiSettings().monthlyBudgetUsd || 0);
        return !budget || aiCostThisMonth() < budget;
    });

    // ─── Xabar tarqatish ──────────────────────────────────────
    function segmentIds(seg, univ) {
        const db = getDb();
        const ids = Object.keys(db.users).filter((id) => /^\d+$/.test(id) && !isBlocked(id));
        const weekAgo = now() - 7 * DAY;
        switch (seg) {
            case 'vip': return ids.filter((id) => isVip(id, db.users[id]));
            case 'nonvip': return ids.filter((id) => !isVip(id, db.users[id]));
            case 'inactive': return ids.filter((id) => (stats.lastSeen(id) || 0) < weekAgo);
            case 'univ': return ids.filter((id) => db.users[id].univ === univ);
            default: return ids;
        }
    }
    const segmentLabel = (seg, univ) => ({ all: 'Hammaga', vip: "VIP'lar", nonvip: 'VIP emaslar', inactive: '7 kun faol emaslar', univ: univ || 'Universitet' }[seg] || seg);

    let broadcasting = false;
    async function runBroadcast(id) {
        if (broadcasting) return;
        broadcasting = true;
        try {
            let list = broadcastsDb.get();
            const b = list.find((x) => x.id === id);
            if (!b) return;
            const ids = segmentIds(b.segment, b.univ);
            Object.assign(b, { status: 'sending', total: ids.length, sent: 0, failed: 0, startedAt: now() });
            broadcastsDb.set(list);
            for (let i = 0; i < ids.length; i++) {
                try {
                    await bot.telegram.sendMessage(ids[i], b.text, { parse_mode: 'HTML' })
                        .catch((e) => (e?.response?.error_code === 400 && /parse/i.test(e.response.description) ? bot.telegram.sendMessage(ids[i], b.text) : Promise.reject(e)));
                    b.sent++;
                } catch { b.failed++; }
                if (i % 20 === 19) { await new Promise((r) => setTimeout(r, 1100)); list = broadcastsDb.get(); const cur = list.find((x) => x.id === id); if (cur) Object.assign(cur, { sent: b.sent, failed: b.failed }); broadcastsDb.set(list); }
            }
            list = broadcastsDb.get();
            const cur = list.find((x) => x.id === id);
            if (cur) { Object.assign(cur, { status: 'sent', sent: b.sent, failed: b.failed, at: now() }); broadcastsDb.set(list); }
        } finally {
            broadcasting = false;
            const next = broadcastsDb.get().find((x) => x.status === 'queued' || (x.status === 'scheduled' && x.at <= now()));
            if (next) setImmediate(() => runBroadcast(next.id));
        }
    }
    // Restartda uzilib qolganlarni belgilash, rejalashtirilganlarni tekshirish
    (() => {
        const list = broadcastsDb.get();
        let ch = false;
        for (const b of list) if (b.status === 'sending') { b.status = 'interrupted'; ch = true; }
        if (ch) broadcastsDb.set(list);
    })();
    const schedTimer = setInterval(() => {
        const due = broadcastsDb.get().find((x) => (x.status === 'scheduled' && x.at <= now()) || x.status === 'queued');
        if (due) runBroadcast(due.id);
    }, 30000);
    schedTimer.unref?.();

    // ─── Kirish (login) ───────────────────────────────────────
    const loginTokens = new Map(); // token → { adminId, exp }

    // Login/parol: avval <DATA_DIR>/admin_credentials.json (botda /parol bilan o'rnatiladi),
    // bo'lmasa env ADMIN_USERNAME + ADMIN_PASSWORD. Parol faqat scrypt hash ko'rinishida saqlanadi.
    const credsDb = store('admin_credentials.json', null);
    const hashPw = (pw, salt = rid(16)) => ({ salt, hash: crypto.scryptSync(String(pw), salt, 64).toString('hex') });
    const sameHash = (a, b) => { const x = Buffer.from(a, 'hex'); const y = Buffer.from(b, 'hex'); return x.length === y.length && crypto.timingSafeEqual(x, y); };
    function checkCredentials(username, password) {
        const u = String(username || '').trim().toLowerCase();
        const saved = credsDb.get();
        if (saved?.username && saved?.hash) {
            return u === saved.username && sameHash(hashPw(password, saved.salt).hash, saved.hash);
        }
        const envUser = String(process.env.ADMIN_USERNAME || '').trim().toLowerCase();
        const envPass = process.env.ADMIN_PASSWORD || '';
        if (!envUser || !envPass) return false;
        const salt = 'env';
        return u === envUser && sameHash(hashPw(password, salt).hash, hashPw(envPass, salt).hash);
    }
    const loginConfigured = () => !!(credsDb.get()?.hash || (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD));

    // Noto'g'ri urinishlar: IP bo'yicha 5 ta / 15 daqiqa, umumiy 30 ta / 15 daqiqa
    const fails = new Map(); // ip → [ts...]
    let globalFails = [];
    const WINDOW = 15 * 60 * 1000;
    const clientIp = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '?';
    function isLocked(ip) {
        const t = now() - WINDOW;
        globalFails = globalFails.filter((x) => x > t);
        const list = (fails.get(ip) || []).filter((x) => x > t);
        fails.set(ip, list);
        return list.length >= 5 || globalFails.length >= 30;
    }
    function registerFail(ip, username) {
        const list = fails.get(ip) || []; list.push(now()); fails.set(ip, list); globalFails.push(now());
        if (list.length === 5 || globalFails.length === 30) {
            send(ADMIN_ID, `⚠️ <b>Admin panelga kirishga shubhali urinish</b>\n\n🌐 IP: <code>${esc(ip)}</code>\n👤 Login: <code>${esc(String(username || '').slice(0, 40))}</code>\n🔒 15 daqiqaga bloklandi.`).catch(() => {});
        }
    }

    // Botda: /parol login yangiParol — xabar darhol o'chiriladi
    bot.command('parol', async (ctx) => {
        if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply("❌ Faqat bosh admin uchun.");
        const parts = (ctx.message.text || '').trim().split(/\s+/).slice(1);
        await ctx.deleteMessage().catch(() => {});
        if (parts.length !== 2) {
            return ctx.replyWithHTML("🔐 <b>Admin panel login/parolini o'rnatish</b>\n\nYozing: <code>/parol login YangiParol</code>\n\n• Login: 3–32 belgi (lotin harf, raqam, _ .)\n• Parol: kamida 8 belgi\n• Xabaringiz xavfsizlik uchun darhol o'chiriladi.");
        }
        const [username, password] = parts;
        if (!/^[a-zA-Z0-9_.]{3,32}$/.test(username)) return ctx.reply("❌ Login 3–32 belgi: lotin harf, raqam, _ yoki .");
        if (password.length < 8) return ctx.reply("❌ Parol kamida 8 belgidan iborat bo'lsin.");
        credsDb.set({ username: username.toLowerCase(), ...hashPw(password), updatedAt: now() });
        // Eski sessiyalar bekor qilinadi
        sessionsDb.set({});
        audit(adminName(ctx.from.id), "Panel parolini o'zgartirdi", username.toLowerCase(), 'auth');
        return ctx.replyWithHTML(`✅ <b>Login va parol saqlandi.</b>\n\n👤 Login: <code>${esc(username.toLowerCase())}</code>\n🔑 Parol: yashirin (xabaringiz o'chirildi)\n\nBarcha eski sessiyalardan chiqildi.`);
    });
    const publicApiUrl = () => {
        const raw = process.env.PUBLIC_URL || process.env.WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL
            || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '')
            || process.env.RAILWAY_STATIC_URL || '';
        if (!raw) return '';
        return (raw.startsWith('http') ? raw : `https://${raw}`).replace(/\/$/, '');
    };

    bot.command('panel', async (ctx) => {
        if (!isPanelAdmin(ctx.from.id)) return ctx.reply("❌ Ruxsat yo'q!");
        const token = rid(16);
        loginTokens.set(token, { adminId: String(ctx.from.id), exp: now() + 10 * 60 * 1000 });
        const panelUrl = (process.env.PANEL_URL || '').replace(/\/$/, '');
        const api = publicApiUrl();
        if (panelUrl.startsWith('https://')) {
            const url = `${panelUrl}/#/login?t=${token}${api ? `&api=${encodeURIComponent(api)}` : ''}`;
            return ctx.replyWithHTML('🖥 <b>Admin panelga kirish</b>\n\nHavola 10 daqiqa amal qiladi va bir marta ishlaydi.', Markup.inlineKeyboard([[Markup.button.url('🔐 Panelni ochish', url)]]));
        }
        return ctx.replyWithHTML(`🖥 <b>Admin panelga kirish kodi</b> (10 daqiqa):\n\n<code>${token}</code>\n\n${api ? `API manzili: <code>${esc(api)}</code>\n\n` : ''}ℹ️ Tugma bilan ochilishi uchun Railway'da <code>PANEL_URL</code> (panel manzili, https://...) ni o'rnating.`);
    });

    // ─── Router ───────────────────────────────────────────────
    const r = express.Router();
    r.use((req, res, next) => {
        // Bearer token ishlatiladi (cookie yo'q) — istalgan origin'ga ruxsat xavfsiz
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        if (req.method === 'OPTIONS') return res.sendStatus(204);
        next();
    });
    const h = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => { console.error('[panel]', req.method, req.path, e); res.status(500).json({ error: e.message || 'server_error' }); });

    r.get('/login-info', (req, res) => res.json({ passwordLogin: loginConfigured() }));

    r.post('/login', h((req, res) => {
        const ip = clientIp(req);
        if (isLocked(ip)) return res.status(429).json({ error: "Juda ko'p noto'g'ri urinish. 15 daqiqadan keyin qayta urinib ko'ring." });
        if (!loginConfigured()) return res.status(400).json({ error: "Login/parol hali o'rnatilmagan. Botda /parol login YangiParol yozing." });
        const { username, password } = req.body || {};
        if (!checkCredentials(username, password)) {
            registerFail(ip, username);
            return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
        }
        fails.delete(ip);
        const session = rid(24);
        const sessions = sessionsDb.get();
        for (const [k, v] of Object.entries(sessions)) if (v.exp < now()) delete sessions[k];
        sessions[session] = { adminId: String(ADMIN_ID), exp: now() + 7 * DAY, createdAt: now(), ip, via: 'password' };
        sessionsDb.set(sessions);
        audit(adminName(ADMIN_ID), 'Panelga kirdi (parol)', ip, 'auth');
        const ua = String(req.headers['user-agent'] || '').slice(0, 80);
        send(ADMIN_ID, `🔐 <b>Admin panelga kirildi</b>\n\n🌐 IP: <code>${esc(ip)}</code>\n💻 ${esc(ua)}\n\nSiz bo'lmasangiz: botda /parol bilan parolni darhol almashtiring.`).catch(() => {});
        res.json({ session, admin: { id: String(ADMIN_ID), name: adminName(ADMIN_ID) } });
    }));

    r.post('/auth', h((req, res) => {
        const t = loginTokens.get(String(req.body?.token || '').trim());
        if (!t || t.exp < now()) return res.status(401).json({ error: "Kod noto'g'ri yoki muddati o'tgan. Botda /panel ni qayta yozing." });
        loginTokens.delete(req.body.token);
        const session = rid(24);
        const sessions = sessionsDb.get();
        for (const [k, v] of Object.entries(sessions)) if (v.exp < now()) delete sessions[k];
        sessions[session] = { adminId: t.adminId, exp: now() + 30 * DAY, createdAt: now() };
        sessionsDb.set(sessions);
        audit(adminName(t.adminId), 'Panelga kirdi', '', 'auth');
        res.json({ session, admin: { id: t.adminId, name: adminName(t.adminId) } });
    }));

    // Auth middleware
    r.use((req, res, next) => {
        const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        const s = token && sessionsDb.get()[token];
        if (!s || s.exp < now() || !isPanelAdmin(s.adminId)) return res.status(401).json({ error: 'unauthorized' });
        req.admin = { id: s.adminId, name: adminName(s.adminId), token };
        next();
    });

    r.get('/me', (req, res) => res.json({ admin: req.admin, ai: ai.isEnabled() }));
    r.post('/logout', (req, res) => { const s = sessionsDb.get(); delete s[req.admin.token]; sessionsDb.set(s); res.json({ ok: true }); });

    // ── Dashboard ────────────────────────────────────────────
    r.get('/dashboard', h((req, res) => {
        const db = getDb();
        const users = Object.entries(db.users).filter(([id]) => /^\d+$/.test(id));
        const m = monthKey(now());
        const pays = paymentsDb.get();
        const monthRevenue = pays.filter((p) => p.status === 'approved' && monthKey(p.decidedAt || p.createdAt) === m).reduce((s, p) => s + (p.amount || 0), 0);
        const prevM = monthKey(now() - 30 * DAY);
        const prevRevenue = pays.filter((p) => p.status === 'approved' && monthKey(p.decidedAt || p.createdAt) === prevM).reduce((s, p) => s + (p.amount || 0), 0);
        const byUniv = {};
        users.forEach(([, u]) => { const k = u.univ || "Ko'rsatilmagan"; byUniv[k] = (byUniv[k] || 0) + 1; });
        const series = stats.series(14);
        res.json({
            totalUsers: users.length,
            registered: users.filter(([, u]) => u.isRegistered).length,
            activeToday: stats.activeOn(),
            vipCount: users.filter(([id, u]) => isVip(id, u)).length,
            todayTests: series.at(-1).tests,
            monthRevenue, prevRevenue,
            aiCostMonth: aiCostThisMonth(),
            aiBudget: Number(aiSettings().monthlyBudgetUsd || 0),
            pendingPayments: pays.filter((p) => p.status === 'pending').length,
            openReports: reportsDb.get().filter((x) => x.status === 'open').length,
            uploadsCount: userTests.allTests().filter((t) => t.status === 'ready').length,
            byUniv: Object.entries(byUniv).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
            top: users.map(([id, u]) => ({ id, name: u.name || 'Foydalanuvchi', univ: u.univ || '', kurs: u.kurs || '', score: Number(u.score) || 0, isVip: isVip(id, u) })).sort((a, b) => b.score - a.score).slice(0, 5),
            pending: pays.filter((p) => p.status === 'pending').slice(0, 5),
            activity: series,
            isMaintenance: !!db.settings?.isMaintenance,
            isPaidMode: getPaidMode(),
        });
    }));

    // ── Foydalanuvchilar ─────────────────────────────────────
    r.get('/users', h((req, res) => {
        const db = getDb();
        const q = String(req.query.q || '').toLowerCase().trim();
        const tab = req.query.tab || 'all';
        const univ = req.query.univ || '';
        const page = Math.max(0, parseInt(req.query.page) || 0);
        const per = Math.min(100, parseInt(req.query.per) || 20);
        const all = Object.entries(db.users).filter(([id]) => /^\d+$/.test(id)).map(([id, u]) => ({
            id, name: u.name || '', username: u.username || '', univ: u.univ || '', kurs: u.kurs || '', yonalish: u.yonalish || '', semester: u.semester || '',
            score: Number(u.score) || 0, totalTests: u.totalTests || 0, totalCorrect: u.totalCorrect || 0, totalWrong: u.totalWrong || 0,
            isVip: isVip(id, u), vipEnd: u.vipEnd || null, isBlocked: isBlocked(id), isRegistered: !!u.isRegistered,
            lastSeen: stats.lastSeen(id), uploadsUsed: u.uploadsUsed || 0, referralCount: u.referralCount || 0, fakeCheckCount: u.fakeCheckCount || 0,
        }));
        const counts = { all: all.length, vip: all.filter((u) => u.isVip).length, blocked: all.filter((u) => u.isBlocked).length };
        let list = all.filter((u) => (tab === 'vip' ? u.isVip : tab === 'blocked' ? u.isBlocked : true));
        if (univ) list = list.filter((u) => u.univ === univ);
        if (q) list = list.filter((u) => u.name.toLowerCase().includes(q) || u.id.includes(q) || u.username.toLowerCase().includes(q.replace('@', '')));
        list.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0) || b.score - a.score);
        res.json({ total: list.length, counts, page, per, users: list.slice(page * per, page * per + per), universities: [...new Set(all.map((u) => u.univ).filter(Boolean))].sort() });
    }));

    r.post('/users/:id/vip', h(async (req, res) => {
        const { id } = req.params;
        if (req.body.on) {
            const r2 = await giveVip(id, parseInt(req.body.days) || 30);
            audit(req.admin.name, 'VIP berdi', `${r2.name} (${id})`, 'vip');
            return res.json({ ok: true, vipEnd: r2.vipEnd });
        }
        await removeVip(id);
        audit(req.admin.name, 'VIP ni oldi', id, 'vip');
        res.json({ ok: true });
    }));
    r.post('/users/:id/block', h(async (req, res) => {
        await setBlock(req.params.id, !!req.body.on);
        audit(req.admin.name, req.body.on ? 'Blokladi' : 'Blokdan chiqardi', `${getDb().users[req.params.id]?.name || ''} (${req.params.id})`, 'block');
        res.json({ ok: true });
    }));
    r.post('/users/:id/score', h((req, res) => {
        const db = getDb();
        const u = db.users[req.params.id];
        if (!u) return res.status(404).json({ error: 'topilmadi' });
        const delta = Number(req.body.delta) || 0;
        u.score = Math.max(0, (Number(u.score) || 0) + delta);
        saveDb(db);
        audit(req.admin.name, delta >= 0 ? "Ball qo'shdi" : 'Ball ayirdi', `${u.name} · ${delta > 0 ? '+' : ''}${delta}`, 'score');
        res.json({ ok: true, score: u.score });
    }));
    r.post('/users/:id/message', h(async (req, res) => {
        const text = String(req.body.text || '').trim();
        if (!text) return res.status(400).json({ error: "Xabar bo'sh" });
        await send(req.params.id, `📩 <b>Admin xabari:</b>\n\n${esc(text)}`);
        audit(req.admin.name, 'Shaxsiy xabar yubordi', req.params.id, 'broadcast');
        res.json({ ok: true });
    }));
    r.delete('/users/:id', h(async (req, res) => {
        const db = getDb();
        const name = db.users[req.params.id]?.name;
        if (!db.users[req.params.id]) return res.status(404).json({ error: 'topilmadi' });
        delete db.users[req.params.id];
        saveDb(db);
        setVipUsers(getVipUsers().filter((v) => String(v) !== String(req.params.id))); saveVip();
        audit(req.admin.name, "Foydalanuvchini o'chirdi", `${name} (${req.params.id})`, 'block');
        res.json({ ok: true });
    }));

    // ── To'lovlar ────────────────────────────────────────────
    r.get('/payments', h((req, res) => {
        const status = req.query.status || 'all';
        const list = paymentsDb.get();
        const counts = { pending: list.filter((p) => p.status === 'pending').length, approved: list.filter((p) => p.status === 'approved').length, rejected: list.filter((p) => p.status === 'rejected').length, all: list.length };
        const db = getDb();
        const vips = Object.entries(db.users).filter(([id, u]) => /^\d+$/.test(id) && isVip(id, u)).map(([id, u]) => ({ id, name: u.name || '', vipEnd: u.vipEnd || null })).sort((a, b) => (a.vipEnd || Infinity) - (b.vipEnd || Infinity));
        res.json({ counts, payments: list.filter((p) => status === 'all' || p.status === status).slice(0, 200), vips, vipPrice: getConfig().vipPrice || 10000 });
    }));
    r.get('/payments/:id/receipt', h(async (req, res) => {
        const p = paymentsDb.get().find((x) => x.id === req.params.id);
        if (!p?.fileId) return res.status(404).end();
        const link = await bot.telegram.getFileLink(p.fileId);
        const f = await fetch(link.href);
        res.setHeader('Content-Type', f.headers.get('content-type') || 'image/jpeg');
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.send(Buffer.from(await f.arrayBuffer()));
    }));
    r.post('/payments/:id/decide', h(async (req, res) => {
        const out = await decidePayment({ paymentId: req.params.id, approve: !!req.body.approve, reason: req.body.reason, fake: req.body.fake !== false, by: req.admin.id });
        if (out.already) return res.status(409).json({ error: "Bu to'lov allaqachon ko'rib chiqilgan" });
        res.json({ ok: true, ...out });
    }));
    r.post('/vip-price', h((req, res) => {
        const price = parseInt(req.body.price);
        if (!(price >= 1000)) return res.status(400).json({ error: "Narx kamida 1000 so'm" });
        const cfg = getConfig(); const old = cfg.vipPrice; cfg.vipPrice = price; saveConfig(cfg);
        audit(req.admin.name, "VIP narxini o'zgartirdi", `${old} → ${price} so'm`, 'settings');
        res.json({ ok: true });
    }));

    // ── Moliya va AI ─────────────────────────────────────────
    r.get('/finance', h((req, res) => {
        const pays = paymentsDb.get().filter((p) => p.status === 'approved');
        const usage = aiUsage();
        const months = [];
        for (let i = 11; i >= 0; i--) {
            const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - i);
            months.push(dt.toISOString().slice(0, 7));
        }
        const names = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
        const series = months.map((m) => ({
            month: names[parseInt(m.slice(5, 7)) - 1],
            key: m,
            revenue: pays.filter((p) => monthKey(p.decidedAt || p.createdAt) === m).reduce((s, p) => s + (p.amount || 0), 0),
            aiCostUsd: usage.filter((e) => monthKey(e.ts) === m).reduce((s, e) => s + (e.costUsd || 0), 0),
        }));
        const m = monthKey(now());
        const byTask = {};
        usage.filter((e) => monthKey(e.ts) === m).forEach((e) => {
            const k = `${e.task}|${e.model}`;
            byTask[k] ||= { task: e.task, model: e.model, requests: 0, costUsd: 0 };
            byTask[k].requests++; byTask[k].costUsd += e.costUsd || 0;
        });
        res.json({
            series,
            aiByTask: Object.values(byTask).sort((a, b) => b.costUsd - a.costUsd),
            aiCostMonth: aiCostThisMonth(),
            aiBudget: Number(aiSettings().monthlyBudgetUsd || 0),
            aiEnabled: ai.isEnabled(),
            recentPayments: paymentsDb.get().filter((p) => p.status !== 'pending').slice(0, 10),
            activeVips: Object.entries(getDb().users).filter(([id, u]) => /^\d+$/.test(id) && isVip(id, u)).length,
            vipPrice: getConfig().vipPrice || 10000,
        });
    }));

    // ── Xabar tarqatish ──────────────────────────────────────
    r.get('/broadcasts', h((req, res) => {
        const db = getDb();
        const univs = [...new Set(Object.values(db.users).map((u) => u.univ).filter(Boolean))].sort();
        const segments = ['all', 'vip', 'nonvip', 'inactive'].map((id) => ({ id, label: segmentLabel(id), count: segmentIds(id).length }));
        res.json({ broadcasts: broadcastsDb.get().slice(0, 50), segments, universities: univs.map((u) => ({ name: u, count: segmentIds('univ', u).length })) });
    }));
    r.post('/broadcasts', h((req, res) => {
        const text = String(req.body.text || '').trim();
        if (!text) return res.status(400).json({ error: "Xabar bo'sh" });
        if (text.length > 4000) return res.status(400).json({ error: 'Xabar 4000 belgidan oshmasin' });
        const at = req.body.scheduleAt ? new Date(req.body.scheduleAt).getTime() : null;
        const b = { id: rid(5), text, segment: req.body.segment || 'all', univ: req.body.univ || null, label: segmentLabel(req.body.segment, req.body.univ), status: at && at > now() ? 'scheduled' : 'queued', at: at || now(), createdAt: now(), by: req.admin.name };
        const list = broadcastsDb.get(); list.unshift(b); broadcastsDb.set(list.slice(0, 200));
        audit(req.admin.name, b.status === 'scheduled' ? 'Xabarni rejalashtirdi' : 'Xabar tarqatdi', `${b.label} · ${segmentIds(b.segment, b.univ).length} kishi`, 'broadcast');
        if (b.status === 'queued') setImmediate(() => runBroadcast(b.id));
        res.json({ ok: true, broadcast: b });
    }));
    r.delete('/broadcasts/:id', h((req, res) => {
        const list = broadcastsDb.get();
        const b = list.find((x) => x.id === req.params.id);
        if (!b || b.status !== 'scheduled') return res.status(400).json({ error: 'Faqat rejalashtirilganni bekor qilish mumkin' });
        b.status = 'cancelled'; broadcastsDb.set(list);
        res.json({ ok: true });
    }));

    // ── Moderatsiya: shikoyatlar va yuklangan testlar ────────
    r.get('/reports', h((req, res) => {
        const list = reportsDb.get();
        res.json({ open: list.filter((x) => x.status === 'open').slice(0, 200), closed: list.filter((x) => x.status !== 'open').slice(0, 30) });
    }));
    r.post('/reports/:id/close', h(async (req, res) => {
        const list = reportsDb.get();
        const rep = list.find((x) => x.id === req.params.id);
        if (!rep) return res.status(404).json({ error: 'topilmadi' });
        rep.status = req.body.fine ? 'fined' : 'resolved'; rep.closedAt = now(); reportsDb.set(list);
        if (req.body.fine) {
            // Botdagi "❌ Jarima ber" bilan bir xil
            const db = getDb(); const u = db.users[rep.userId];
            if (u) {
                u.falseReportCount = (u.falseReportCount || 0) + 1;
                const fine = u.falseReportCount === 1 ? 100 : u.falseReportCount === 2 ? 200 : 300;
                u.score = Math.max(0, (Number(u.score) || 0) - fine); saveDb(db);
                await send(rep.userId, `🚫 <b>JARIMA!</b>\n\n❗️ Aslida bu savol <b>to'g'ri edi</b>.\nHisobingizdan <b>-${fine} ball</b> yechildi.`).catch(() => {});
            }
        } else if (req.body.notify) {
            await send(rep.userId, `✅ <b>Rahmat!</b> Siz xabar bergan savol tekshirildi va tuzatildi.\n\n❓ ${esc(rep.q.slice(0, 200))}`).catch(() => {});
        }
        audit(req.admin.name, req.body.fine ? 'Shikoyat uchun jarima berdi' : 'Shikoyatni yopdi', rep.q.slice(0, 80), 'moderation');
        res.json({ ok: true });
    }));
    // Savolni tahrirlash (tayyor fanlar)
    r.get('/subjects/:key/question', h((req, res) => {
        const subj = getSubjects()[req.params.key];
        const q = subj?.questions?.find((x) => x.q === req.query.q);
        if (!q) return res.status(404).json({ error: 'Savol topilmadi' });
        res.json({ question: q });
    }));
    r.put('/subjects/:key/question', h((req, res) => {
        const SUBJECTS = getSubjects();
        const subj = SUBJECTS[req.params.key];
        const idx = subj?.questions?.findIndex((x) => x.q === req.body.originalQ);
        if (!subj || idx < 0) return res.status(404).json({ error: 'Savol topilmadi' });
        const { q, options, a, hint } = req.body;
        const opts = (options || []).map((o) => String(o).trim()).filter(Boolean);
        if (!q || opts.length < 2 || !opts.includes(a)) return res.status(400).json({ error: "Savol, kamida 2 variant va to'g'ri javob kerak" });
        subj.questions[idx] = { ...subj.questions[idx], q: q.trim(), options: opts, a, ...(hint !== undefined ? { hint } : {}) };
        persistSubject(req.params.key);
        audit(req.admin.name, 'Savolni tahrirladi', `${req.params.key}: ${q.slice(0, 60)}`, 'content');
        res.json({ ok: true });
    }));

    r.get('/uploads', h((req, res) => {
        const db = getDb();
        const tests = userTests.allTests().filter((t) => t.status === 'ready').sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);
        res.json({
            uploads: tests.map((t) => ({
                id: t.id, subject: t.subject, fileName: t.fileName, lang: t.lang, source: t.source, createdAt: t.createdAt, publishedAs: t.publishedAs || null,
                questions: t.questions.length, answered: t.questions.filter((q) => q.correct !== null).length,
                missing: t.questions.filter((q) => q.correct === null).length, aiGuess: t.questions.filter((q) => q.aiGuess).length,
                options: Math.max(...t.questions.map((q) => q.options.length)),
                owner: { id: t.ownerId, name: db.users[t.ownerId]?.name || t.ownerId, univ: db.users[t.ownerId]?.univ || '', yonalish: db.users[t.ownerId]?.yonalish || '' },
                sample: t.questions.slice(0, 5),
            })),
        });
    }));
    r.delete('/uploads/:id', h((req, res) => {
        const t = userTests.get(req.params.id);
        if (!t) return res.status(404).json({ error: 'topilmadi' });
        userTests.remove(t.id);
        audit(req.admin.name, "Yuklangan testni o'chirdi", t.subject, 'moderation');
        res.json({ ok: true });
    }));
    // Yuklangan testni bot menyusidagi fanga aylantirish (hamma uchun)
    r.post('/uploads/:id/publish', h((req, res) => {
        const t = userTests.get(req.params.id);
        if (!t) return res.status(404).json({ error: 'topilmadi' });
        const { dir, sem, name, icon } = req.body;
        const cfg = getConfig();
        if (!cfg.subjectsByDirection?.[dir]) return res.status(400).json({ error: "Yo'nalish topilmadi" });
        const key = uniqueKey(`${slug(dir)}_${slug(name || t.subject)}`);
        const qs = t.questions.filter((q) => q.correct !== null).map((q) => ({ q: q.q, options: q.options, a: q.options[q.correct], ...(q.hint ? { hint: q.hint } : {}) }));
        if (!qs.length) return res.status(400).json({ error: "Javobi bor savol yo'q" });
        addSubjectToConfig(cfg, dir, sem, { name: name || t.subject, icon: icon || '📘', key });
        saveConfig(cfg);
        getSubjects()[key] = { name: `${icon || '📘'} ${name || t.subject}`, questions: qs };
        persistSubject(key);
        t.publishedAs = key; userTests.save(t);
        audit(req.admin.name, 'Testni fanga aylantirdi', `${name || t.subject} → ${dir}, ${sem} (${qs.length} savol)`, 'moderation');
        res.json({ ok: true, key, count: qs.length });
    }));

    // ── Fanlar va savollar ───────────────────────────────────
    const slug = (s) => String(s || '').toLowerCase().replace(/[ʻʼ'`‘’]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'fan';
    function uniqueKey(base) { const S = getSubjects(); let k = base; let i = 2; while (S[k]) k = `${base}_${i++}`; return k; }
    function addSubjectToConfig(cfg, dir, sem, entry) {
        cfg.subjectsByDirection ||= {};
        let d2 = cfg.subjectsByDirection[dir];
        if (!d2 || Array.isArray(d2)) d2 = cfg.subjectsByDirection[dir] = { '1-semestr': Array.isArray(d2) ? d2 : [], '2-semestr': [] };
        (d2[sem] ||= []).push(entry);
    }

    r.get('/content', h((req, res) => {
        const cfg = getConfig();
        const S = getSubjects();
        const sbd = {};
        for (const [dir, val] of Object.entries(cfg.subjectsByDirection || {})) {
            const semMap = Array.isArray(val) ? { '1-semestr': val } : val;
            sbd[dir] = {};
            for (const [sem, list] of Object.entries(semMap)) sbd[dir][sem] = (list || []).map((s) => ({ ...s, questions: S[s.key]?.questions?.length || 0 }));
        }
        res.json({ universities: cfg.universities || [], directionsByUniv: cfg.directionsByUniv || {}, subjectsByDirection: sbd, semesters: cfg.semesters || ['1-semestr', '2-semestr'], activeSemesters: cfg.activeSemesters || [] });
    }));
    r.post('/content/univ', h((req, res) => {
        const name = String(req.body.name || '').trim();
        if (!name) return res.status(400).json({ error: 'Nomi kerak' });
        const cfg = getConfig(); cfg.universities ||= [];
        if (cfg.universities.includes(name)) return res.status(409).json({ error: 'Bunday universitet bor' });
        cfg.universities.push(name); cfg.directionsByUniv ||= {}; cfg.directionsByUniv[name] ||= {};
        saveConfig(cfg); audit(req.admin.name, "Universitet qo'shdi", name, 'content'); res.json({ ok: true });
    }));
    r.delete('/content/univ', h((req, res) => {
        const cfg = getConfig(); const name = req.body.name;
        cfg.universities = (cfg.universities || []).filter((u) => u !== name);
        if (cfg.directionsByUniv) delete cfg.directionsByUniv[name];
        saveConfig(cfg); audit(req.admin.name, "Universitetni o'chirdi", name, 'content'); res.json({ ok: true });
    }));
    r.post('/content/direction', h((req, res) => {
        const { univ, kurs, name } = req.body;
        if (!univ || !kurs || !String(name || '').trim()) return res.status(400).json({ error: "Universitet, kurs va nom kerak" });
        const cfg = getConfig(); cfg.directionsByUniv ||= {}; cfg.directionsByUniv[univ] ||= {};
        const list = (cfg.directionsByUniv[univ][kurs] ||= []);
        if (!list.includes(name.trim())) list.push(name.trim());
        cfg.subjectsByDirection ||= {}; cfg.subjectsByDirection[name.trim()] ||= { '1-semestr': [], '2-semestr': [] };
        saveConfig(cfg); audit(req.admin.name, "Yo'nalish qo'shdi", `${univ} · ${kurs} · ${name}`, 'content'); res.json({ ok: true });
    }));
    r.delete('/content/direction', h((req, res) => {
        const { univ, kurs, name } = req.body;
        const cfg = getConfig();
        if (cfg.directionsByUniv?.[univ]?.[kurs]) cfg.directionsByUniv[univ][kurs] = cfg.directionsByUniv[univ][kurs].filter((x) => x !== name);
        saveConfig(cfg); audit(req.admin.name, "Yo'nalishni o'chirdi", `${univ} · ${kurs} · ${name}`, 'content'); res.json({ ok: true });
    }));
    r.post('/content/subject', h((req, res) => {
        const { dir, sem, name, icon } = req.body;
        if (!dir || !sem || !String(name || '').trim()) return res.status(400).json({ error: "Yo'nalish, semestr va nom kerak" });
        const cfg = getConfig();
        const key = uniqueKey(`${slug(dir)}_${slug(name)}`);
        addSubjectToConfig(cfg, dir, sem, { name: name.trim(), icon: icon || '📘', key });
        saveConfig(cfg);
        getSubjects()[key] ||= { name: `${icon || '📘'} ${name.trim()}`, questions: [] };
        persistSubject(key);
        audit(req.admin.name, "Fan qo'shdi", `${name} (${dir}, ${sem})`, 'content'); res.json({ ok: true, key });
    }));
    r.delete('/content/subject', h((req, res) => {
        const { dir, sem, key } = req.body;
        const cfg = getConfig();
        const d2 = cfg.subjectsByDirection?.[dir];
        if (Array.isArray(d2)) cfg.subjectsByDirection[dir] = d2.filter((s) => s.key !== key);
        else if (d2?.[sem]) d2[sem] = d2[sem].filter((s) => s.key !== key);
        saveConfig(cfg); audit(req.admin.name, "Fanni menyudan olib tashladi", `${key} (${dir}, ${sem})`, 'content'); res.json({ ok: true });
    }));
    r.put('/content/semesters', h((req, res) => {
        const cfg = getConfig();
        if (Array.isArray(req.body.semesters)) cfg.semesters = req.body.semesters;
        if (Array.isArray(req.body.activeSemesters)) cfg.activeSemesters = req.body.activeSemesters;
        saveConfig(cfg); audit(req.admin.name, 'Semestrlarni yangiladi', (cfg.activeSemesters || []).join(', '), 'content'); res.json({ ok: true });
    }));
    r.get('/content/subject/:key/questions', h((req, res) => {
        const subj = getSubjects()[req.params.key];
        if (!subj) return res.status(404).json({ error: 'Fan topilmadi' });
        const page = Math.max(0, parseInt(req.query.page) || 0);
        const q = String(req.query.q || '').toLowerCase();
        const list = (subj.questions || []).map((x, i) => ({ ...x, i })).filter((x) => !q || x.q.toLowerCase().includes(q));
        res.json({ name: subj.name, total: list.length, questions: list.slice(page * 20, page * 20 + 20) });
    }));
    r.post('/content/subject/:key/import', h(async (req, res) => {
        const S = getSubjects();
        if (!S[req.params.key]) S[req.params.key] = { name: req.params.key, questions: [] };
        const buf = Buffer.from(String(req.body.dataBase64 || ''), 'base64');
        if (!buf.length) return res.status(400).json({ error: "Fayl bo'sh" });
        const content = await parser.extractContent(buf, req.body.fileName || 'fayl.txt');
        const parsed = parser.parseContent(content).filter((q) => q.correct !== null);
        if (!parsed.length) return res.status(400).json({ error: "Javobi belgilangan savol topilmadi" });
        const qs = parsed.map((q) => ({ q: q.q, options: q.options, a: q.options[q.correct] }));
        const subj = S[req.params.key];
        if (req.body.mode === 'replace') subj.questions = qs;
        else { const seen = new Set((subj.questions || []).map((x) => x.q)); subj.questions = [...(subj.questions || []), ...qs.filter((x) => !seen.has(x.q))]; }
        persistSubject(req.params.key);
        audit(req.admin.name, 'Savollarni import qildi', `${req.params.key}: ${qs.length} ta (${req.body.mode === 'replace' ? 'almashtirish' : "qo'shish"})`, 'content');
        res.json({ ok: true, imported: qs.length, total: subj.questions.length });
    }));
    r.delete('/content/subject/:key/questions/:i', h((req, res) => {
        const subj = getSubjects()[req.params.key];
        const i = parseInt(req.params.i);
        if (!subj?.questions?.[i]) return res.status(404).json({ error: 'topilmadi' });
        const [removed] = subj.questions.splice(i, 1);
        persistSubject(req.params.key);
        audit(req.admin.name, "Savolni o'chirdi", `${req.params.key}: ${removed.q.slice(0, 60)}`, 'content');
        res.json({ ok: true });
    }));

    // ── Musobaqa ─────────────────────────────────────────────
    r.get('/tournament', h((req, res) => {
        const db = getDb();
        const t = db.tournament || { isActive: false, participants: [] };
        const board = (t.participants || []).map((id) => { const u = db.users[id]; return u ? { id, name: u.name || 'Foydalanuvchi', univ: u.univ || '', tourScore: u.tourScore || 0, finished: !!u.tourFinished } : null; })
            .filter(Boolean).sort((a, b) => b.tourScore - a.tourScore);
        res.json({ isActive: !!t.isActive, started: !!t.started, date: t.date || '', time: t.time || '', count: t.count || 30, participants: (t.participants || []).length, leaderboard: board.slice(0, 50), questionsReady: (t.questions || []).length });
    }));
    r.post('/tournament', h(async (req, res) => {
        const { date, time, count } = req.body;
        const n = parseInt(count);
        if (!date || !/^\d{1,2}:\d{2}$/.test(time || '') || !(n >= 5 && n <= 200)) return res.status(400).json({ error: "Sana, vaqt (HH:MM) va 5–200 savol kerak" });
        clearTourDeadline();
        const db = getDb();
        Object.keys(db.users).forEach((id) => { db.users[id].tourScore = 0; db.users[id].tourFinished = false; });
        db.tournament = { isActive: true, started: false, startedAt: null, deadlineTime: null, date, time, count: n, participants: [], questions: prepareTournamentQuestions(n) };
        saveDb(db);
        audit(req.admin.name, "Musobaqa e'lon qildi", `${date} ${time} · ${n} savol`, 'tournament');
        if (req.body.announce !== false) {
            const ids = Object.keys(db.users).filter((id) => /^\d+$/.test(id) && !isBlocked(id));
            (async () => {
                for (let i = 0; i < ids.length; i++) {
                    await send(ids[i], `📣 <b>YANGI MUSOBAQA!</b>\n\n📅 Sana: <b>${esc(date)}</b>\n🕒 Vaqt: <b>${esc(time)}</b>\n📝 Savollar: <b>${n} ta</b>\n\nQatnashish uchun tugmani bosing:`, Markup.keyboard([["🏆 Musobaqaga o'tish"]]).resize()).catch(() => {});
                    if (i % 20 === 19) await new Promise((r2) => setTimeout(r2, 1100));
                }
            })();
        }
        res.json({ ok: true });
    }));
    r.post('/tournament/cancel', h(async (req, res) => {
        clearTourDeadline();
        const db = getDb();
        const parts = db.tournament?.participants || [];
        db.tournament = { isActive: false, date: null, time: null, participants: [] };
        saveDb(db);
        for (const id of parts) await send(id, "🚫 <b>E'lon:</b> Rejalashtirilgan musobaqa bekor qilindi.").catch(() => {});
        audit(req.admin.name, 'Musobaqani bekor qildi', '', 'tournament');
        res.json({ ok: true });
    }));
    r.post('/tournament/participants', h(async (req, res) => {
        const db = getDb(); const t = db.tournament;
        if (!t?.isActive) return res.status(400).json({ error: 'Musobaqa faol emas' });
        let ids = [];
        if (req.body.mode === 'all') ids = Object.keys(db.users).filter((id) => /^\d+$/.test(id));
        else if (req.body.mode === 'vip') ids = Object.keys(db.users).filter((id) => /^\d+$/.test(id) && isVip(id, db.users[id]));
        else { const id = String(parseInt(req.body.userId)); if (!db.users[id]) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' }); ids = [id]; }
        let added = 0;
        for (const id of ids.map(Number)) if (!t.participants.includes(id)) { t.participants.push(id); added++; }
        saveDb(db);
        (async () => { for (const id of ids) await send(id, `🏆 <b>Musobaqaga qo'shildingiz!</b>\n\n📅 ${esc(t.date || '—')} · 🕒 ${esc(t.time || '—')}\n📝 ${t.count} ta savol`).catch(() => {}); })();
        audit(req.admin.name, "Musobaqaga qo'shdi", `${req.body.mode || 'id'} · ${added} kishi`, 'tournament');
        res.json({ ok: true, added, total: t.participants.length });
    }));
    r.post('/tournament/start', h(async (req, res) => {
        const db = getDb(); const t = db.tournament;
        if (!t?.isActive) return res.status(400).json({ error: 'Faol musobaqa yo\'q' });
        if (!t.participants?.length) return res.status(400).json({ error: "Qatnashchilar yo'q" });
        t.started = true; t.startedAt = now(); saveDb(db);
        let sent = 0;
        for (const id of t.participants) {
            try { await send(id, '🔔 <b>MUSOBAQA BOSHLANDI!</b>\n\nAdmin tomonidan start berildi. Pastdagi tugmani bosing:', Markup.inlineKeyboard([[Markup.button.callback('🏁 TESTNI BOSHLASH ▶️', 'start_actual_tour')]])); sent++; } catch { /* ignore */ }
        }
        audit(req.admin.name, 'Musobaqaga start berdi', `${sent} kishi`, 'tournament');
        res.json({ ok: true, sent });
    }));
    r.post('/tournament/announce', h(async (req, res) => {
        const report = [];
        const fakeCtx = { telegram: bot.telegram, reply: async (t) => { report.push(t); }, replyWithHTML: async (t) => { report.push(t); } };
        await finalizeTournament(fakeCtx);
        audit(req.admin.name, "Musobaqa natijalarini e'lon qildi", '', 'tournament');
        res.json({ ok: true, report: report.join('\n') });
    }));

    // ── Majburiy kanallar ────────────────────────────────────
    r.get('/channels', h(async (req, res) => {
        const list = getRequiredChannels();
        const out = await Promise.all(list.map(async (c, i) => {
            let members = null;
            if (c.id && String(c.id).match(/^(@|-?\d)/)) members = await bot.telegram.getChatMembersCount(c.id).catch(() => null);
            return { ...c, idx: i, members };
        }));
        res.json({ channels: out });
    }));
    r.post('/channels', h(async (req, res) => {
        const parsed = parseChannelInput(req.body.input);
        if (!parsed) return res.status(400).json({ error: "Kanal havolasi yoki @username noto'g'ri" });
        const type = req.body.type === 'link' ? 'link' : 'verify';
        let name = String(req.body.name || '').trim() || parsed.name;
        let link = parsed.link;
        let warning = null;
        if (parsed.id) {
            try { const chat = await bot.telegram.getChat(parsed.id); if (!req.body.name && chat?.title) name = chat.title; if (chat?.username) link = `https://t.me/${chat.username}`; }
            catch { if (type === 'verify') warning = "Bot kanalga ulana olmadi. Tekshiruv ishlashi uchun botni kanalga admin qiling."; }
        }
        if (type === 'verify' && !parsed.id) return res.status(400).json({ error: "Maxfiy havolali kanalni tekshirib bo'lmaydi — @username yoki -100... ID kiriting yoki 'faqat link' turini tanlang" });
        const chs = getRequiredChannels();
        chs.push({ id: parsed.id || link, name: name || 'Kanal', link: link || (parsed.id ? `https://t.me/${String(parsed.id).replace('@', '')}` : ''), type });
        saveRequiredChannels(chs);
        audit(req.admin.name, "Kanal qo'shdi", `${name} (${type === 'link' ? 'faqat link' : 'tekshiriladi'})`, 'channel');
        res.json({ ok: true, warning });
    }));
    r.delete('/channels/:idx', h((req, res) => {
        const chs = getRequiredChannels();
        const i = parseInt(req.params.idx);
        if (!chs[i]) return res.status(404).json({ error: 'topilmadi' });
        const [removed] = chs.splice(i, 1);
        saveRequiredChannels(chs);
        audit(req.admin.name, "Kanalni o'chirdi", removed.name, 'channel');
        res.json({ ok: true });
    }));

    // ── Faoliyat logi ────────────────────────────────────────
    r.get('/activity', h((req, res) => res.json({ log: auditDb.get().slice(0, 300) })));

    // ── Sozlamalar ───────────────────────────────────────────
    r.get('/settings', h((req, res) => {
        const db = getDb();
        const s = aiSettings();
        res.json({
            isMaintenance: !!db.settings?.isMaintenance, isPaidMode: getPaidMode(), turboMode: !!db.settings?.turboMode,
            timeLimit: botSettings.timeLimit || 30, vipPrice: getConfig().vipPrice || 10000,
            ai: {
                enabled: ai.isEnabled(),
                models: { extract: ai.modelFor('extract'), solve: ai.modelFor('solve'), explain: ai.modelFor('explain') },
                limits: Object.fromEntries(d.LIMIT_KEYS.map((k) => [k, d.LIMITS[k]])),
                monthlyBudgetUsd: Number(s.monthlyBudgetUsd || 0),
                costMonth: aiCostThisMonth(),
            },
            admins: [...ADMIN_IDS],
        });
    }));
    const MODEL_IDS = new Set(Object.keys(ai.PRICES));
    r.put('/settings', h((req, res) => {
        const b = req.body || {};
        const db = getDb(); db.settings ||= {};
        const changes = [];
        if (typeof b.isMaintenance === 'boolean' && b.isMaintenance !== !!db.settings.isMaintenance) { db.settings.isMaintenance = b.isMaintenance; changes.push(b.isMaintenance ? "Botni to'xtatdi" : 'Botni yoqdi'); }
        if (typeof b.turboMode === 'boolean' && b.turboMode !== !!db.settings.turboMode) { db.settings.turboMode = b.turboMode; changes.push(`Turbo: ${b.turboMode ? 'yoqildi' : "o'chirildi"}`); }
        saveDb(db);
        const st = getSettings();
        if (typeof b.isPaidMode === 'boolean' && b.isPaidMode !== getPaidMode()) { setPaidMode(b.isPaidMode); st.isPaidMode = b.isPaidMode; changes.push(b.isPaidMode ? 'Pullik rejim' : 'Bepul rejim'); }
        if (b.timeLimit !== undefined) { const t = parseInt(b.timeLimit); if (t >= 5 && t <= 300 && t !== botSettings.timeLimit) { botSettings.timeLimit = t; st.timeLimit = t; changes.push(`Savol vaqti: ${t}s`); } }
        if (b.ai) {
            st.ai ||= {};
            if (b.ai.models) { st.ai.models ||= {}; for (const [k, v] of Object.entries(b.ai.models)) if (['extract', 'solve', 'explain'].includes(k) && MODEL_IDS.has(v)) st.ai.models[k] = v; changes.push('AI modellari'); }
            if (b.ai.limits) { st.ai.limits ||= {}; for (const [k, v] of Object.entries(b.ai.limits)) if (d.LIMIT_KEYS.includes(k) && Number(v) >= 0) st.ai.limits[k] = Number(v); changes.push('AI limitlari'); }
            if (b.ai.monthlyBudgetUsd !== undefined && Number(b.ai.monthlyBudgetUsd) >= 0) { st.ai.monthlyBudgetUsd = Number(b.ai.monthlyBudgetUsd); changes.push(`AI budjet: $${st.ai.monthlyBudgetUsd}`); }
        }
        saveSettings(st);
        Object.assign(botSettings, st); // xotiradagi nusxa ham yangilansin
        if (changes.length) audit(req.admin.name, "Sozlamalarni o'zgartirdi", changes.join(', '), 'settings');
        res.json({ ok: true, changes });
    }));
    r.post('/danger/:action', h(async (req, res) => {
        const action = req.params.action;
        const db = getDb();
        if (action === 'clear-rating') {
            Object.values(db.users).forEach((u) => { u.score = 0; u.totalTests = 0; u.totalCorrect = 0; u.totalWrong = 0; u.subjects = {}; });
            saveDb(db);
            const wu = getWebUsers(); Object.values(wu).forEach((u) => { u.score = 0; u.totalTests = 0; u.totalCorrect = 0; u.totalWrong = 0; u.subjects = {}; }); saveWebUsers(wu);
            const ws = getWebScores(); Object.values(ws).forEach((u) => { u.score = 0; u.totalTests = 0; u.totalCorrect = 0; u.totalWrong = 0; }); saveWebScores(ws);
            audit(req.admin.name, 'Reytingni tozaladi', '', 'settings');
            return res.json({ ok: true, message: 'Reyting tozalandi' });
        }
        if (action === 'clear-expired-vip') {
            let n = 0;
            const keep = [];
            for (const [id, u] of Object.entries(db.users)) if (u.isVip && u.vipEnd && u.vipEnd < now()) { u.isVip = false; n++; } else if (isVip(id, u)) keep.push(Number(id));
            saveDb(db);
            const before = getVipUsers().length;
            setVipUsers(getVipUsers().filter((v) => { const u = db.users[v]; return !(u?.vipEnd && u.vipEnd < now()); }));
            saveVip();
            audit(req.admin.name, "Muddati o'tgan VIP'larni tozaladi", `${n + Math.max(0, before - getVipUsers().length)} ta`, 'vip');
            return res.json({ ok: true, message: `${n} ta muddati o'tgan VIP tozalandi` });
        }
        if (action === 'reset-tournament-scores') {
            Object.values(db.users).forEach((u) => { u.tourScore = 0; u.tourFinished = false; });
            saveDb(db);
            audit(req.admin.name, 'Musobaqa ballarini tozaladi', '', 'tournament');
            return res.json({ ok: true, message: 'Musobaqa ballari tozalandi' });
        }
        res.status(400).json({ error: "Noma'lum amal" });
    }));

    return { router: r, recordPayment, decidePayment, recordReport, closeReportsOf, persistSubject, giveVip, removeVip, setBlock, audit, isPanelAdmin };
};
