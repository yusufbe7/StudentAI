'use strict';
// ============================================================
// ISHGA TUSHIRISH NUQTASI
// SYNC_DATABASE_URL bo'lsa (masalan Render + Neon): avval ma'lumotlar Postgres'dan
// tiklanadi, keyin bot ishga tushadi va fayllar avtomatik sinxronlanadi.
// Bo'lmasa (masalan Railway Volume /data): to'g'ridan-to'g'ri index.js — hech narsa o'zgarmaydi.
// (Ataylab DATABASE_URL emas: boshqa maqsaddagi baza tasodifan yoqib yubormasligi uchun.)
// ============================================================
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Logda parolni ko'rsatmasdan bazani aniqlash uchun: faqat host va baza nomi
function describeUrl(url) {
    try {
        const u = new URL(url);
        return `${u.hostname}/${u.pathname.replace(/^\//, '') || '?'}`;
    } catch {
        return "noto'g'ri formatdagi manzil";
    }
}

async function main() {
    const url = (process.env.SYNC_DATABASE_URL || '').trim();
    if (!url) return require('./index.js');

    // Railway Volume (/data) bo'lsa — o'sha papka (mavjud ma'lumotlar Neon'ga ko'chadi), aks holda ./data (Render)
    if (!process.env.DATA_DIR) process.env.DATA_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, 'data');

    if (!/^postgres(ql)?:\/\//.test(url)) {
        throw new Error("SYNC_DATABASE_URL 'postgresql://' bilan boshlanishi kerak. Neon → Connect → Show password → Copy snippet");
    }
    if (url.includes('****')) {
        throw new Error("SYNC_DATABASE_URL ichida parol o'rniga **** turibdi. Neon'da avval 'Show password' ni bosib, keyin nusxalang");
    }

    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: url,
        ssl: /sslmode=disable/.test(url) || /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
        max: 3,
        connectionTimeoutMillis: 15000, // ulanish osilib qolmasin
        query_timeout: 60000,
        idleTimeoutMillis: 30000,
    });
    pool.on('error', (e) => console.error('[pgSync] ulanish xatosi:', e.message));

    const { createPgSync } = require('./lib/pgSync');
    const sync = createPgSync({ dataDir: process.env.DATA_DIR, pool });

    console.log(`🗄 [pgSync] Bazaga ulanmoqda: ${describeUrl(url)} ...`);
    const mode = String(process.env.SYNC_MODE || '').trim().toLowerCase();
    const withRetry = async (fn) => {
        let lastErr;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try { return await fn(); } catch (e) {
                lastErr = e;
                console.error(`🗄 [pgSync] ${attempt}/3 urinish muvaffaqiyatsiz: ${e.message}`);
                if (attempt < 3) await sleep(5000);
            }
        }
        throw lastErr;
    };

    // ── EKSPORT: eski serverdagi (masalan Railway /data) ma'lumotlarni Neon'ga
    //    alohida joyga yuklash. Hech narsa tiklanmaydi va o'chirilmaydi, bot ishga tushmaydi.
    if (mode === 'export') {
        const { IMPORT_PREFIX } = require('./lib/pgSync');
        const source = (process.env.EXPORT_NAME || 'railway').replace(/[^a-z0-9_-]/gi, '') || 'railway';
        const prefix = `${IMPORT_PREFIX}${source}/`;
        const r = await withRetry(() => sync.exportAll(prefix));
        let users = 0;
        try { users = Object.keys(JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR, 'ranking_db.json'), 'utf8')).users || {}).length; } catch { /* yo'q */ }
        console.log(`✅ [EKSPORT] ${r.files} ta fayl (${(r.bytes / 1024).toFixed(0)} KB), ${users} ta foydalanuvchi → Neon "${prefix}"`);
        console.log("✅ [EKSPORT] Tayyor. Endi bu servisni to'xtating va Render'dagi admin panelda (yoki botda /import_railway) birlashtiring.");
        await pool.end().catch(() => {});
        // Bot ishga tushmaydi (Render'dagi bot bilan to'qnashmasligi uchun); servis qayta-qayta ishga tushmasin deb kutib turadi
        setInterval(() => {}, 1 << 30);
        return;
    }

    // ── HIMOYA: diskda allaqachon ma'lumot bo'lsa (masalan Railway Volume) va bazada ham bo'lsa —
    //    ustidan yozib yubormaymiz. Bilib turib tiklash kerak bo'lsa: SYNC_MODE=restore
    const localDb = path.join(process.env.DATA_DIR, 'ranking_db.json');
    let localUsers = 0;
    try { localUsers = Object.keys(JSON.parse(fs.readFileSync(localDb, 'utf8')).users || {}).length; } catch { /* yo'q */ }
    if (localUsers > 0 && mode !== 'restore') {
        const live = await withRetry(() => sync.countLive());
        if (live > 0) {
            throw new Error(
                `Diskda ${localUsers} ta foydalanuvchi bor, bazada ham ma'lumot bor — ustidan yozilmadi (ma'lumot yo'qolmasligi uchun).\n` +
                "   Eski ma'lumotni ko'chirish uchun: SYNC_MODE=export qo'shing (Render'da birlashtiriladi).\n" +
                "   Bazadagini diskka yozish kerak bo'lsa (ehtiyot bo'ling!): SYNC_MODE=restore",
            );
        }
    }

    await withRetry(() => sync.restore());

    global.__pgSync = sync; // admin panel: Railway importini birlashtirish uchun
    require('./index.js');
    sync.start();
    global.__beforeExit = (sig) => sync.stop(sig);
}

main().catch((err) => {
    console.error(`❌ Ishga tushirishda xato: ${err.message}`);
    console.error("   Tekshiring: Render → Environment → SYNC_DATABASE_URL (Neon'dagi to'liq manzil, parol bilan).");
    process.exit(1);
});
