'use strict';
// ============================================================
// FAOLLIK STATISTIKASI (admin panel dashboard uchun)
//  • lastSeen[userId]  — oxirgi faollik vaqti
//  • days[YYYY-MM-DD]  — { active: [userId...], tests, newUsers }  (oxirgi 60 kun)
// Xotirada yuritiladi, har 60 soniyada <DATA_DIR>/stats.json ga yoziladi.
// ============================================================

const fs = require('fs');
const path = require('path');

const dayKey = (ts = Date.now()) => {
    // O'zbekiston vaqti (UTC+5) bo'yicha kun
    const d = new Date(ts + 5 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
};

function createStats(dataDir) {
    const file = path.join(dataDir, 'stats.json');
    let data = { lastSeen: {}, days: {} };
    try { data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch { /* yangi */ }
    const activeSets = {};
    for (const [k, v] of Object.entries(data.days)) activeSets[k] = new Set(v.active || []);
    let dirty = false;

    const day = (k = dayKey()) => {
        if (!data.days[k]) data.days[k] = { active: [], tests: 0, newUsers: 0 };
        if (!activeSets[k]) activeSets[k] = new Set(data.days[k].active);
        return data.days[k];
    };

    function flush() {
        if (!dirty) return;
        // Faqat oxirgi 60 kun
        const keys = Object.keys(data.days).sort();
        for (const k of keys.slice(0, Math.max(0, keys.length - 60))) { delete data.days[k]; delete activeSets[k]; }
        for (const k of Object.keys(data.days)) data.days[k].active = [...(activeSets[k] || [])];
        try { fs.writeFileSync(file, JSON.stringify(data)); dirty = false; } catch (e) { console.error('[stats]', e.message); }
    }
    const timer = setInterval(flush, 60 * 1000);
    timer.unref?.();
    process.once('beforeExit', flush);

    return {
        touch(userId) {
            if (!userId) return;
            const id = String(userId);
            data.lastSeen[id] = Date.now();
            const d = day();
            if (!activeSets[dayKey()].has(id)) { activeSets[dayKey()].add(id); d.active.length = 0; }
            dirty = true;
        },
        testFinished() { day().tests++; dirty = true; },
        newUser() { day().newUsers++; dirty = true; },
        lastSeen: (userId) => data.lastSeen[String(userId)] || null,
        activeOn: (k = dayKey()) => activeSets[k]?.size || 0,
        series(n = 14) {
            const out = [];
            for (let i = n - 1; i >= 0; i--) {
                const k = dayKey(Date.now() - i * 86400000);
                const d = data.days[k] || { tests: 0, newUsers: 0 };
                out.push({ day: `${k.slice(8, 10)}.${k.slice(5, 7)}`, date: k, tests: d.tests || 0, newUsers: d.newUsers || 0, active: activeSets[k]?.size || 0 });
            }
            return out;
        },
        flush,
        dayKey,
    };
}

module.exports = { createStats, dayKey };
