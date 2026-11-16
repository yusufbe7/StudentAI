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
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await sync.restore();
            lastErr = null;
            break;
        } catch (e) {
            lastErr = e;
            console.error(`🗄 [pgSync] ${attempt}/3 urinish muvaffaqiyatsiz: ${e.message}`);
            if (attempt < 3) await sleep(5000);
        }
    }
    if (lastErr) throw lastErr;

    require('./index.js');
    sync.start();
    global.__beforeExit = (sig) => sync.stop(sig);
}

main().catch((err) => {
    console.error(`❌ Ishga tushirishda xato: ${err.message}`);
    console.error("   Tekshiring: Render → Environment → SYNC_DATABASE_URL (Neon'dagi to'liq manzil, parol bilan).");
    process.exit(1);
});
