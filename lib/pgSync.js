'use strict';
// ============================================================
// MA'LUMOTLARNI POSTGRES'DA SAQLASH (Render bepul tarifi uchun)
//
// Render'ning bepul serveri uxlab qolganda yoki qayta ishga tushganda diskdagi
// fayllar o'chadi. Bu modul DATA_DIR ichidagi barcha fayllarni (JSON bazalar,
// sessiyalar, foydalanuvchi testlari) Postgres'dagi bitta jadvalga ko'chiradi:
//   • ishga tushishda — bazadan diskka tiklaydi (restore)
//   • ishlash davomida — har 10 soniyada o'zgargan fayllarni yozadi (sync)
//   • to'xtashda (SIGTERM) — oxirgi o'zgarishlarni yozib, keyin chiqadi
// Bot kodi o'zgarmaydi: u avvalgidek fayllar bilan ishlayveradi.
// ============================================================

const fs = require('fs');
const path = require('path');

const TABLE = 'studentai_files';
// Boshqa serverdan (masalan Railway) eksport qilingan nusxalar shu prefiks ostida turadi
// va oddiy tiklashda diskka yozilmaydi — faqat admin "birlashtirish"ni bosganda ishlatiladi
const IMPORT_PREFIX = 'import/';
const MAX_FILE_BYTES = 50 * 1024 * 1024;

function listFiles(dir, base = dir, out = []) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) listFiles(full, base, out);
        else if (e.isFile()) out.push(path.relative(base, full).split(path.sep).join('/'));
    }
    return out;
}

function createPgSync({ dataDir, pool, intervalMs = 10000, log = console.log }) {
    const known = new Map(); // relPath → "mtime:size" (bazadagi holat)
    let timer = null;
    let running = Promise.resolve();

    async function init() {
        await pool.query(`CREATE TABLE IF NOT EXISTS ${TABLE} (path TEXT PRIMARY KEY, content BYTEA NOT NULL, updated_at BIGINT NOT NULL)`);
    }

    async function restore() {
        await init();
        fs.mkdirSync(dataDir, { recursive: true });
        const { rows: all } = await pool.query(`SELECT path, content FROM ${TABLE}`);
        const rows = all.filter((r) => !String(r.path).startsWith(IMPORT_PREFIX));
        let bytes = 0;
        for (const r of rows) {
            const rel = String(r.path);
            if (rel.includes('..') || path.isAbsolute(rel)) continue; // xavfsizlik
            const full = path.join(dataDir, rel);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            const buf = Buffer.isBuffer(r.content) ? r.content : Buffer.from(r.content);
            fs.writeFileSync(full, buf);
            bytes += buf.length;
            const st = fs.statSync(full);
            known.set(rel, `${st.mtimeMs}:${st.size}`);
        }
        log(`🗄 [pgSync] ${rows.length} ta fayl bazadan tiklandi (${(bytes / 1024).toFixed(0)} KB)`);
        return rows.length;
    }

    async function syncOnce() {
        const files = listFiles(dataDir);
        const seen = new Set(files);
        let up = 0, del = 0;
        for (const rel of files) {
            const full = path.join(dataDir, rel);
            let st;
            try { st = fs.statSync(full); } catch { continue; }
            if (st.size > MAX_FILE_BYTES) continue;
            const sig = `${st.mtimeMs}:${st.size}`;
            if (known.get(rel) === sig) continue;
            let buf;
            try { buf = fs.readFileSync(full); } catch { continue; }
            // Yozilayotgan (yarim) JSON faylni saqlamaslik
            if (rel.endsWith('.json')) { try { JSON.parse(buf.toString('utf8') || 'null'); } catch { continue; } }
            await pool.query(
                `INSERT INTO ${TABLE} (path, content, updated_at) VALUES ($1, $2, $3)
                 ON CONFLICT (path) DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at`,
                [rel, buf, Date.now()],
            );
            known.set(rel, sig);
            up++;
        }
        for (const rel of [...known.keys()]) {
            if (seen.has(rel)) continue;
            await pool.query(`DELETE FROM ${TABLE} WHERE path = $1`, [rel]);
            known.delete(rel);
            del++;
        }
        if (up || del) log(`🗄 [pgSync] saqlandi: ${up} ta yangilandi${del ? `, ${del} ta o'chirildi` : ''}`);
        return { up, del };
    }

    // Bir vaqtda faqat bitta sync ishlaydi
    const sync = () => (running = running.then(syncOnce).catch((e) => { console.error('[pgSync] xato:', e.message); return { up: 0, del: 0, error: e }; }));

    function start() {
        timer = setInterval(sync, intervalMs);
        timer.unref?.();
    }

    // To'xtashdan oldin chaqiriladi (index.js → shutdown)
    async function stop(sig = 'stop') {
        clearInterval(timer);
        log(`🗄 [pgSync] ${sig}: oxirgi o'zgarishlar saqlanmoqda...`);
        await sync();
        await pool.end().catch(() => {});
    }

    // Bazadagi "jonli" (import emas) fayllar soni
    async function countLive() {
        await init();
        const { rows } = await pool.query(`SELECT path FROM ${TABLE}`);
        return rows.filter((r) => !String(r.path).startsWith(IMPORT_PREFIX)).length;
    }

    // Diskdagi hamma fayllarni prefiks ostida yuklash (tiklamasdan, o'chirmasdan)
    async function exportAll(prefix) {
        await init();
        const files = listFiles(dataDir);
        let n = 0, bytes = 0;
        for (const rel of files) {
            const full = path.join(dataDir, rel);
            let buf;
            try { buf = fs.readFileSync(full); } catch { continue; }
            if (buf.length > MAX_FILE_BYTES) continue;
            await pool.query(
                `INSERT INTO ${TABLE} (path, content, updated_at) VALUES ($1, $2, $3)
                 ON CONFLICT (path) DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at`,
                [prefix + rel, buf, Date.now()],
            );
            n++; bytes += buf.length;
        }
        return { files: n, bytes };
    }

    // Prefiks ostidagi fayllarni o'qish: [{ rel, content: Buffer, updatedAt }]
    async function readPrefix(prefix) {
        await init();
        const { rows } = await pool.query(`SELECT path, content, updated_at FROM ${TABLE}`);
        return rows.filter((r) => String(r.path).startsWith(prefix)).map((r) => ({
            rel: String(r.path).slice(prefix.length),
            content: Buffer.isBuffer(r.content) ? r.content : Buffer.from(r.content),
            updatedAt: Number(r.updated_at),
        }));
    }

    return { restore, sync, start, stop, init, countLive, exportAll, readPrefix };
}

module.exports = { createPgSync, TABLE, IMPORT_PREFIX, listFiles };
