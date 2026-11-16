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

async function main() {
    const url = process.env.SYNC_DATABASE_URL;
    if (!url) return require('./index.js');

    // Railway Volume (/data) bo'lsa — o'sha papka (mavjud ma'lumotlar Neon'ga ko'chadi), aks holda ./data (Render)
    if (!process.env.DATA_DIR) process.env.DATA_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, 'data');
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: url,
        ssl: /sslmode=disable/.test(url) || /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
        max: 3,
    });
    const { createPgSync } = require('./lib/pgSync');
    const sync = createPgSync({ dataDir: process.env.DATA_DIR, pool });
    await sync.restore();
    require('./index.js');
    sync.start();
    global.__beforeExit = (sig) => sync.stop(sig);
}

main().catch((err) => {
    console.error("❌ Ishga tushirishda xato (Postgres'ga ulanib bo'lmadi?):", err.message);
    process.exit(1);
});
