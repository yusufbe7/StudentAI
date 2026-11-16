import { useMemo, useState } from 'react';
import { Search, Gem, Ban, Unlock, Trash2, Download, UserPlus, Send, PlusCircle, MinusCircle } from 'lucide-react';
import { Card, PageHeader, Badge, Avatar, Tabs, Modal, fmt, date, ago } from '../components/ui.jsx';
import { useToast } from '../components/Layout.jsx';
import { users as initialUsers, UNIVERSITIES } from '../data/mock.js';

const DAY = 24 * 3600 * 1000;

export default function UsersPage() {
  const toast = useToast();
  const [list, setList] = useState(initialUsers);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [univ, setUniv] = useState('');
  const [selected, setSelected] = useState(null);
  const [scoreDelta, setScoreDelta] = useState(10);
  const [page, setPage] = useState(0);
  const PER_PAGE = 15;

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return list.filter((u) => {
      if (tab === 'vip' && !u.isVip) return false;
      if (tab === 'blocked' && !u.isBlocked) return false;
      if (tab === 'web' && u.source !== 'web') return false;
      if (univ && u.univ !== univ) return false;
      if (!s) return true;
      return u.name.toLowerCase().includes(s) || String(u.id).includes(s) || u.username.toLowerCase().includes(s);
    });
  }, [list, q, tab, univ]);
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const cur = Math.min(page, pages - 1);
  const rows = filtered.slice(cur * PER_PAGE, (cur + 1) * PER_PAGE);

  const update = (id, patch, msg) => {
    setList((l) => l.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    setSelected((s) => (s && s.id === id ? { ...s, ...patch } : s));
    if (msg) toast(msg);
  };

  const giveVip = (u) => update(u.id, { isVip: true, vipStart: Date.now(), vipEnd: Date.now() + 30 * DAY }, `💎 ${u.name} ga 30 kunlik VIP berildi`);
  const removeVip = (u) => update(u.id, { isVip: false, vipStart: null, vipEnd: null }, `${u.name} VIP dan chiqarildi`);
  const toggleBlock = (u) => update(u.id, { isBlocked: !u.isBlocked }, u.isBlocked ? `🔓 ${u.name} blokdan chiqarildi` : `🚫 ${u.name} bloklandi`);
  const remove = (u) => { setList((l) => l.filter((x) => x.id !== u.id)); setSelected(null); toast(`🗑 ${u.name} o'chirildi`); };

  const counts = {
    all: list.length,
    vip: list.filter((u) => u.isVip).length,
    blocked: list.filter((u) => u.isBlocked).length,
    web: list.filter((u) => u.source === 'web').length,
  };

  return (
    <>
      <PageHeader
        title="Foydalanuvchilar"
        subtitle="Bot va web foydalanuvchilari: VIP, blok, ball va profil"
        actions={
          <>
            <button className="btn-light"><Download size={16} /> Excel</button>
            <button className="btn-dark"><UserPlus size={16} /> Qo'lda qo'shish</button>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Tabs
            value={tab}
            onChange={(v) => { setTab(v); setPage(0); }}
            items={[
              { value: 'all', label: 'Barchasi', count: counts.all },
              { value: 'vip', label: 'VIP', count: counts.vip },
              { value: 'blocked', label: 'Bloklangan', count: counts.blocked },
              { value: 'web', label: 'Web', count: counts.web },
            ]}
          />
          <select className="input !w-auto" value={univ} onChange={(e) => { setUniv(e.target.value); setPage(0); }}>
            <option value="">Barcha universitetlar</option>
            {UNIVERSITIES.map((u) => <option key={u}>{u}</option>)}
          </select>
          <div className="relative ml-auto w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Ism, ID yoki @username" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-y border-white/60">
                <th className="th">Foydalanuvchi</th>
                <th className="th">Universitet</th>
                <th className="th text-right">Ball</th>
                <th className="th text-right">Testlar</th>
                <th className="th">Aniqlik</th>
                <th className="th">Holat</th>
                <th className="th">Faollik</th>
                <th className="th text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const acc = u.totalCorrect + u.totalWrong > 0 ? Math.round((u.totalCorrect / (u.totalCorrect + u.totalWrong)) * 100) : 0;
                return (
                  <tr key={u.id} className="cursor-pointer border-b border-white/50 transition hover:bg-white/40" onClick={() => setSelected(u)}>
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size={34} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{u.name}</p>
                          <p className="truncate text-xs text-slate-500">{u.username.startsWith('Lichka') ? u.username : `@${u.username}`} · {u.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      <p className="max-w-[180px] truncate">{u.univ}</p>
                      <p className="text-xs text-slate-500">{u.kurs} · {u.yonalish}</p>
                    </td>
                    <td className="td text-right font-semibold text-sky-700">{fmt(u.score)}</td>
                    <td className="td text-right">{u.totalTests}</td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/70">
                          <div className={`h-full rounded-full ${acc >= 75 ? 'bg-emerald-500' : acc >= 55 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${acc}%` }} />
                        </div>
                        <span className="text-xs text-slate-600">{acc}%</span>
                      </div>
                    </td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1">
                        {u.isBlocked ? <Badge tone="red">Bloklangan</Badge> : u.isVip ? <Badge tone="amber"><Gem size={11} /> VIP</Badge> : <Badge>Oddiy</Badge>}
                        <Badge tone={u.source === 'web' ? 'violet' : 'blue'}>{u.source === 'web' ? 'Web' : 'Bot'}</Badge>
                      </div>
                    </td>
                    <td className="td text-xs text-slate-500">{ago(u.lastActive)}</td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button title={u.isVip ? 'VIP dan chiqarish' : 'VIP berish'} onClick={() => (u.isVip ? removeVip(u) : giveVip(u))} className={`rounded-lg p-1.5 hover:bg-white/80 ${u.isVip ? 'text-amber-500' : 'text-slate-400'}`}><Gem size={16} /></button>
                        <button title={u.isBlocked ? 'Blokdan chiqarish' : 'Bloklash'} onClick={() => toggleBlock(u)} className={`rounded-lg p-1.5 hover:bg-white/80 ${u.isBlocked ? 'text-emerald-600' : 'text-slate-400 hover:text-rose-500'}`}>{u.isBlocked ? <Unlock size={16} /> : <Ban size={16} />}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="p-10 text-center text-sm text-slate-500">Hech kim topilmadi</p>}
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-500">
          <span>{filtered.length ? cur * PER_PAGE + 1 : 0}–{Math.min((cur + 1) * PER_PAGE, filtered.length)} / {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button className="btn-light !px-2.5 !py-1 text-xs disabled:opacity-40" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Oldingi</button>
            <span className="px-2">{cur + 1} / {pages}</span>
            <button className="btn-light !px-2.5 !py-1 text-xs disabled:opacity-40" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Keyingi</button>
          </div>
        </div>
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Foydalanuvchi profili"
        footer={selected && (
          <>
            <button className="btn-light text-rose-600" onClick={() => remove(selected)}><Trash2 size={15} /> O'chirish</button>
            <button className="btn-light" onClick={() => toggleBlock(selected)}>{selected.isBlocked ? <><Unlock size={15} /> Blokdan chiqarish</> : <><Ban size={15} /> Bloklash</>}</button>
            {selected.isVip ? <button className="btn-dark" onClick={() => removeVip(selected)}>VIP ni olish</button> : <button className="btn-dark" onClick={() => giveVip(selected)}><Gem size={15} /> VIP berish</button>}
          </>
        )}
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={selected.name} size={52} />
              <div>
                <p className="text-lg font-semibold">{selected.name}</p>
                <p className="text-sm text-slate-500">ID: {selected.id} · {selected.username.startsWith('Lichka') ? selected.username : `@${selected.username}`}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/70 p-2"><p className="font-bold text-sky-700">{fmt(selected.score)}</p><p className="text-[11px] text-slate-500">Ball</p></div>
              <div className="rounded-xl bg-white/70 p-2"><p className="font-bold">{selected.totalTests}</p><p className="text-[11px] text-slate-500">Test</p></div>
              <div className="rounded-xl bg-white/70 p-2"><p className="font-bold">{fmt(selected.totalWrong)}</p><p className="text-[11px] text-slate-500">Xato</p></div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">Universitet</dt><dd>{selected.univ}</dd>
              <dt className="text-slate-500">Kurs / yo'nalish</dt><dd>{selected.kurs} · {selected.yonalish}</dd>
              <dt className="text-slate-500">Semestr</dt><dd>{selected.semester}</dd>
              <dt className="text-slate-500">Qo'shilgan</dt><dd>{date(selected.joinedAt)}</dd>
              <dt className="text-slate-500">VIP</dt><dd>{selected.isVip ? `${date(selected.vipEnd)} gacha` : "Yo'q"}</dd>
            </dl>
            <div className="rounded-xl bg-white/60 p-3">
              <p className="mb-2 text-sm font-medium">Ballni tuzatish</p>
              <div className="flex items-center gap-2">
                <input type="number" className="input !w-24" value={scoreDelta} onChange={(e) => setScoreDelta(Number(e.target.value))} />
                <button className="btn-light" onClick={() => update(selected.id, { score: selected.score + scoreDelta }, `+${scoreDelta} ball qo'shildi`)}><PlusCircle size={15} /> Qo'shish</button>
                <button className="btn-light" onClick={() => update(selected.id, { score: Math.max(0, selected.score - scoreDelta) }, `−${scoreDelta} ball ayirildi`)}><MinusCircle size={15} /> Ayirish</button>
              </div>
            </div>
            <button className="btn-light w-full justify-center"><Send size={15} /> Shaxsiy xabar yuborish (bot orqali)</button>
          </div>
        )}
      </Modal>
    </>
  );
}
