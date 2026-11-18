'use strict';
// ============================================================
// ESKI SERVER (Railway) MA'LUMOTLARINI HOZIRGISIGA QO'SHISH
// Qoida: hech narsa o'chirilmaydi. Ikkala joyda ham bor narsada:
//   • foydalanuvchi: profil — ro'yxatdan o'tgan tomondan; ball/testlar — kattasi; VIP — uzoqrog'i
//   • obyektli fayllar — yo'q kalitlar qo'shiladi (hozirgisi ustun)
//   • ro'yxatlar — birlashtiriladi (takrorlarsiz)
// ============================================================

const fs = require('fs');
const path = require('path');

// Ko'chirilmaydigan fayllar: sessiyalar, sozlamalar va texnik fayllar
const SKIP = new Set([
    'session.json', 'settings.json', 'bot_config.json', 'subjects.json', 'stats.json',
    'admin_sessions.json', 'admin_credentials.json', 'app_version.json', 'ai_usage.json',
]);
const NUMERIC_MAX = ['score', 'totalTests', 'totalCorrect', 'totalWrong', 'referralCount', 'uploadsUsed', 'tourScore'];
const PROFILE = ['name', 'username', 'univ', 'kurs', 'yonalish', 'semester', 'isRegistered', 'step'];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function mergeUser(cur, old, semesterForKurs) {
    if (!cur) {
        const u = { ...old };
        if (u.kurs && semesterForKurs) u.semester = semesterForKurs(u.kurs) || u.semester;
        return { user: u, added: true };
    }
    const out = { ...old, ...cur };
    for (const k of NUMERIC_MAX) if (k in cur || k in old) out[k] = Math.max(num(cur[k]), num(old[k]));
    // Fanlar bo'yicha statistika — har bir fanda kattasi
    if (isObj(old.subjects) || isObj(cur.subjects)) {
        out.subjects = { ...(old.subjects || {}) };
        for (const [k, v] of Object.entries(cur.subjects || {})) {
            const o = out.subjects[k];
            out.subjects[k] = isObj(o) && isObj(v) ? Object.fromEntries([...new Set([...Object.keys(o), ...Object.keys(v)])].map((f) => [f, Math.max(num(o[f]), num(v[f]))])) : v;
        }
    }
    // Hozirgi tomonda ro'yxatdan o'tmagan bo'lsa — profil eskisidan
    if (!cur.isRegistered && old.isRegistered) for (const k of PROFILE) if (old[k] !== undefined) out[k] = old[k];
    // VIP — qaysi biri uzoqroq bo'lsa
    if (num(old.vipEnd) > num(cur.vipEnd)) { out.isVip = old.isVip; out.vipStart = old.vipStart; out.vipEnd = old.vipEnd; }
    if (out.kurs && semesterForKurs && !cur.isRegistered) out.semester = semesterForKurs(out.kurs) || out.semester;
    return { user: out, added: false };
}

function unionArray(cur, old) {
    const key = (x) => (isObj(x) && x.id !== undefined ? `id:${x.id}` : typeof x === 'number' || /^\d+$/.test(String(x)) ? `n:${Number(x)}` : `j:${JSON.stringify(x)}`);
    const seen = new Set(cur.map(key));
    const out = [...cur];
    let added = 0;
    for (const x of old) if (!seen.has(key(x))) { seen.add(key(x)); out.push(x); added++; }
    return { value: out, added };
}

function addMissingKeys(cur, old) {
    const out = { ...cur };
    let added = 0;
    for (const [k, v] of Object.entries(old)) if (!(k in out)) { out[k] = v; added++; }
    return { value: out, added };
}

/**
 * @param files    [{ rel, content: Buffer }] — eksport qilingan fayllar
 * @param dataDir  hozirgi DATA_DIR
 * @param semesterForKurs (kurs) => semestr
 * @returns hisobot
 */
function mergeImport({ files, dataDir, semesterForKurs }) {
    const report = { usersAdded: 0, usersMerged: 0, usersTotal: 0, files: [], skipped: [] };
    const readCur = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, rel), 'utf8')); } catch { return undefined; } };
    const write = (rel, data) => {
        const full = path.join(dataDir, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2));
    };

    for (const f of files) {
        const rel = f.rel;
        if (!rel || rel.includes('..') || path.isAbsolute(rel)) continue;
        if (SKIP.has(rel)) { report.skipped.push(rel); continue; }
        const curExists = fs.existsSync(path.join(dataDir, rel));

        if (!rel.endsWith('.json')) { if (!curExists) { write(rel, f.content); report.files.push(`${rel}: ko'chirildi`); } continue; }
        let old;
        try { old = JSON.parse(f.content.toString('utf8')); } catch { report.skipped.push(`${rel} (buzuq)`); continue; }
        if (!curExists) { write(rel, old); report.files.push(`${rel}: ko'chirildi`); if (rel === 'ranking_db.json') report.usersAdded += Object.keys(old.users || {}).length; continue; }
        const cur = readCur(rel);
        if (cur === undefined) { report.skipped.push(`${rel} (hozirgisi buzuq)`); continue; }

        if (rel === 'ranking_db.json') {
            const users = { ...(cur.users || {}) };
            for (const [id, ou] of Object.entries(old.users || {})) {
                const r = mergeUser(users[id], ou, semesterForKurs);
                users[id] = r.user;
                if (r.added) report.usersAdded++; else report.usersMerged++;
            }
            write(rel, { ...cur, users });
            report.files.push(`${rel}: +${report.usersAdded} yangi, ${report.usersMerged} birlashtirildi`);
            continue;
        }
        if (rel === 'user_tests/_index.json') {
            const byOwner = { ...(cur.byOwner || {}) };
            for (const [o, ids] of Object.entries(old.byOwner || {})) byOwner[o] = [...new Set([...(byOwner[o] || []), ...ids])];
            write(rel, { ...cur, byOwner });
            report.files.push(`${rel}: birlashtirildi`);
            continue;
        }
        if (Array.isArray(cur) && Array.isArray(old)) {
            const r = unionArray(cur, old);
            if (r.added) { write(rel, r.value); report.files.push(`${rel}: +${r.added}`); }
            continue;
        }
        if (isObj(cur) && isObj(old)) {
            const r = addMissingKeys(cur, old);
            if (r.added) { write(rel, r.value); report.files.push(`${rel}: +${r.added}`); }
            continue;
        }
        report.skipped.push(`${rel} (turi mos emas)`);
    }

    const finalDb = readCur('ranking_db.json');
    report.usersTotal = Object.keys(finalDb?.users || {}).length;
    return report;
}

// Import qilinmasdan oldin ko'rib chiqish uchun: nechta foydalanuvchi bor, nechtasi yangi
function previewImport({ files, dataDir }) {
    const f = files.find((x) => x.rel === 'ranking_db.json');
    let oldUsers = {};
    try { oldUsers = JSON.parse(f.content.toString('utf8')).users || {}; } catch { /* yo'q */ }
    let cur = {};
    try { cur = JSON.parse(fs.readFileSync(path.join(dataDir, 'ranking_db.json'), 'utf8')).users || {}; } catch { /* yo'q */ }
    const ids = Object.keys(oldUsers);
    return {
        files: files.length,
        oldUsers: ids.length,
        newUsers: ids.filter((id) => !cur[id]).length,
        bothUsers: ids.filter((id) => cur[id]).length,
        currentUsers: Object.keys(cur).length,
        oldVip: Object.values(oldUsers).filter((u) => u.isVip).length,
        exportedAt: Math.max(0, ...files.map((x) => x.updatedAt || 0)) || null,
    };
}

module.exports = { mergeImport, previewImport, mergeUser };
