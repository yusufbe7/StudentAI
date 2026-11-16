'use strict';
// ============================================================
// FOYDALANUVCHI YUKLAGAN TESTLAR — saqlash
// Har bir test alohida faylda: <DATA_DIR>/user_tests/<id>.json
// Indeks: <DATA_DIR>/user_tests/_index.json  { byOwner: { userId: [id, ...] } }
// (Keyinchalik PostgreSQL'ga ko'chirish oson bo'lishi uchun API kichik)
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function createStore(dataDir) {
    const dir = path.join(dataDir, 'user_tests');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const indexPath = path.join(dir, '_index.json');
    const fileOf = (id) => path.join(dir, `${id}.json`);

    const readIndex = () => {
        try { return JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch { return { byOwner: {} }; }
    };
    const writeIndex = (idx) => fs.writeFileSync(indexPath, JSON.stringify(idx));

    function get(id) {
        if (!/^[a-z0-9]{6,20}$/.test(String(id))) return null;
        try { return JSON.parse(fs.readFileSync(fileOf(id), 'utf8')); } catch { return null; }
    }

    function save(test) {
        test.updatedAt = Date.now();
        fs.writeFileSync(fileOf(test.id), JSON.stringify(test));
        return test;
    }

    function create({ ownerId, fileName, questions, lang, source }) {
        const id = crypto.randomBytes(5).toString('hex');
        const test = {
            id, ownerId: String(ownerId), subject: null, fileName, lang, source,
            status: 'draft', createdAt: Date.now(), questions, wrongIdx: [], solveUsed: false, stats: { runs: 0, best: null },
        };
        save(test);
        const idx = readIndex();
        (idx.byOwner[test.ownerId] ||= []).unshift(id);
        writeIndex(idx);
        return test;
    }

    function listByOwner(ownerId) {
        const ids = readIndex().byOwner[String(ownerId)] || [];
        return ids.map(get).filter((t) => t && t.status === 'ready');
    }

    function remove(id) {
        const t = get(id);
        if (!t) return false;
        try { fs.unlinkSync(fileOf(id)); } catch { /* ignore */ }
        const idx = readIndex();
        idx.byOwner[t.ownerId] = (idx.byOwner[t.ownerId] || []).filter((x) => x !== id);
        writeIndex(idx);
        return true;
    }

    function allTests() {
        const idx = readIndex();
        return Object.values(idx.byOwner).flat().map(get).filter(Boolean);
    }

    return { get, save, create, listByOwner, remove, allTests };
}

module.exports = { createStore };
