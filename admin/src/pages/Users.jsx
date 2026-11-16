import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Gem, Ban, Unlock, Trash2, Send, PlusCircle, MinusCircle } from 'lucide-react';
import { Card, PageHeader, Badge, Avatar, Tabs, Modal, Loading, ErrorBox, Empty, fmt, date, ago } from '../components/ui.jsx';
import { useAction } from '../components/Layout.jsx';
import { api, useApi } from '../data/api.js';

const PER = 20;

export default function UsersPage() {
  const act = useAction();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [tab, setTab] = useState('all');
  const [univ, setUniv] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const [delta, setDelta] = useState(10);
  const [vipDays, setVipDays] = useState(30);
  const [msg, setMsg] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  // Yuqoridagi qidiruvdan kelgan so'rov
  useEffect(() => { const p = params.get('q'); if (p !== null && p !== q) { setQ(p); setPage(0); } }, [params]); // eslint-disable-line

  const query = `/users?tab=${tab}&univ=${encodeURIComponent(univ)}&q=${encodeURIComponent(q)}&page=${page}&per=${PER}`;
  const { data, error, loading, reload } = useApi(query);

  const refresh = async (id) => {
    await reload();
    if (id) {
      const r = await api(`/users?q=${id}&per=1`).catch(() => null);
      const u = r?.users?.find((x) => x.id === String(id));
      setSelected(u || null);
    }
  };
  const vip = (u, on) => act(() => api(`/users/${u.id}/vip`, { method: 'POST', body: { on, days: vipDays } }), on ? `💎 ${u.name}: ${vipDays} kunlik VIP berildi` : `${u.name} VIP dan chiqarildi`).then((r) => r && refresh(u.id));
  const block = (u, on) => act(() => api(`/users/${u.id}/block`, { method: 'POST', body: { on } }), on ? `🚫 ${u.name} bloklandi` : `🔓 ${u.name} blokdan chiqarildi`).then((r) => r && refresh(u.id));
  const score = (u, d) => act(() => api(`/users/${u.id}/score`, { method: 'POST', body: { delta: d } }), `${d > 0 ? '+' : ''}${d} ball`).then((r) => r && refresh(u.id));
  const sendMsg = (u) => act(() => api(`/users/${u.id}/message`, { method: 'POST', body: { text: msg } }), '📩 Xabar yuborildi').then((r) => r && setMsg(''));
  const remove = (u) => act(() => api(`/users/${u.id}`, { method: 'DELETE' }), `🗑 ${u.name} o'chirildi`).then((r) => { if (r) { setSelected(null); setConfirmDel(false); reload(); } });

  const pages = data ? Math.max(1, Math.ceil(data.total / PER)) : 1;

  return (
    <>
      <PageHeader title="Foydalanuvchilar" subtitle="Bot foydalanuvchilari: VIP, blok, ball va shaxsiy xabar" />
      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Tabs
            value={tab}
            onChange={(v) => { setTab(v); setPage(0); }}
            items={[
              { value: 'all', label: 'Barchasi', count: data?.counts.all },
              { value: 'vip', label: 'VIP', count: data?.counts.vip },
              { value: 'blocked', label: 'Bloklangan', count: data?.counts.blocked },
            ]}
          />
          <select className="input !w-auto max-w-[220px]" value={univ} onChange={(e) => { setUniv(e.target.value); setPage(0); }}>
            <option value="">Barcha universitetlar</option>
            {(data?.universities || []).map((u) => <option key={u}>{u}</option>)}
          </select>
          <div className="relative ml-auto w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Ism, ID yoki @username" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); if (params.get('q')) setParams({}); }} />
          </div>
        </div>

        {loading && !data ? <Loading /> : error && !data ? <div className="p-4"><ErrorBox error={error} onRetry={reload} /></div> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-y border-white/60">
                    <th className="th">Foydalanuvchi</th><th className="th">Universitet</th><th className="th text-right">Ball</th><th className="th text-right">Testlar</th>
                    <th className="th">Aniqlik</th><th className="th">Holat</th><th className="th">Faollik</th><th className="th text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => {
                    const answered = u.totalCorrect + u.totalWrong;
                    const acc = answered > 0 ? Math.round((u.totalCorrect / answered) * 100) : null;
                    return (
                      <tr key={u.id} className="cursor-pointer border-b border-white/50 transition hover:bg-white/40" onClick={() => { setSelected(u); setConfirmDel(false); }}>
                        <td className="td">
                          <div className="flex items-center gap-3">
                            <Avatar name={u.name || '?'} size={34} />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{u.name || <i className="text-slate-400">ism yo'q</i>}</p>
                              <p className="truncate text-xs text-slate-500">{u.username && !/yopiq|Noma/.test(u.username) ? `@${u.username.replace('@', '')} · ` : ''}{u.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="td"><p className="max-w-[180px] truncate">{u.univ || '—'}</p><p className="text-xs text-slate-500">{[u.kurs, u.yonalish].filter(Boolean).join(' · ')}</p></td>
                        <td className="td text-right font-semibold text-sky-700">{fmt(Math.round(u.score))}</td>
                        <td className="td text-right">{u.totalTests}</td>
                        <td className="td">
                          {acc === null ? <span className="text-xs text-slate-400">—</span> : (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/70"><div className={`h-full rounded-full ${acc >= 75 ? 'bg-emerald-500' : acc >= 55 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${acc}%` }} /></div>
                              <span className="text-xs text-slate-600">{acc}%</span>
                            </div>
                          )}
                        </td>
                        <td className="td">
                          <div className="flex flex-wrap gap-1">
                            {u.isBlocked ? <Badge tone="red">Bloklangan</Badge> : u.isVip ? <Badge tone="amber"><Gem size={11} /> VIP</Badge> : <Badge>Oddiy</Badge>}
                            {!u.isRegistered && <Badge tone="slate">Ro'yxatdan o'tmagan</Badge>}
                          </div>
                        </td>
                        <td className="td text-xs text-slate-500">{u.lastSeen ? ago(u.lastSeen) : '—'}</td>
                        <td className="td" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <button title={u.isVip ? 'VIP dan chiqarish' : 'VIP berish'} onClick={() => vip(u, !u.isVip)} className={`rounded-lg p-1.5 hover:bg-white/80 ${u.isVip ? 'text-amber-500' : 'text-slate-400'}`}><Gem size={16} /></button>
                            <button title={u.isBlocked ? 'Blokdan chiqarish' : 'Bloklash'} onClick={() => block(u, !u.isBlocked)} className={`rounded-lg p-1.5 hover:bg-white/80 ${u.isBlocked ? 'text-emerald-600' : 'text-slate-400 hover:text-rose-500'}`}>{u.isBlocked ? <Unlock size={16} /> : <Ban size={16} />}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!data.users.length && <Empty icon="🔍" text="Hech kim topilmadi" />}
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-500">
              <span>{data.total ? `${page * PER + 1}–${Math.min((page + 1) * PER, data.total)} / ${fmt(data.total)}` : '0'}</span>
              <div className="flex items-center gap-1">
                <button className="btn-light !px-2.5 !py-1 text-xs disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)}>Oldingi</button>
                <span className="px-2">{page + 1} / {pages}</span>
                <button className="btn-light !px-2.5 !py-1 text-xs disabled:opacity-40" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Keyingi</button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Foydalanuvchi profili"
        footer={selected && (confirmDel ? (
          <>
            <span className="mr-auto self-center text-sm text-rose-700">Rostdan o'chirilsinmi?</span>
            <button className="btn-light" onClick={() => setConfirmDel(false)}>Yo'q</button>
            <button className="btn-red" onClick={() => remove(selected)}>Ha, o'chirish</button>
          </>
        ) : (
          <>
            <button className="btn-light text-rose-600" onClick={() => setConfirmDel(true)}><Trash2 size={15} /> O'chirish</button>
            <button className="btn-light" onClick={() => block(selected, !selected.isBlocked)}>{selected.isBlocked ? <><Unlock size={15} /> Blokdan chiqarish</> : <><Ban size={15} /> Bloklash</>}</button>
            {selected.isVip ? <button className="btn-dark" onClick={() => vip(selected, false)}>VIP ni olish</button> : <button className="btn-dark" onClick={() => vip(selected, true)}><Gem size={15} /> VIP berish</button>}
          </>
        ))}
      >
        {selected && (
          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            <div className="flex items-center gap-3">
              <Avatar name={selected.name || '?'} size={52} />
              <div>
                <p className="text-lg font-semibold">{selected.name || "Ism yo'q"}</p>
                <p className="text-sm text-slate-500">ID: {selected.id}{selected.username && !/yopiq|Noma/.test(selected.username) ? ` · @${selected.username.replace('@', '')}` : ''}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/70 p-2"><p className="font-bold text-sky-700">{fmt(Math.round(selected.score))}</p><p className="text-[11px] text-slate-500">Ball</p></div>
              <div className="rounded-xl bg-white/70 p-2"><p className="font-bold">{selected.totalTests}</p><p className="text-[11px] text-slate-500">Test</p></div>
              <div className="rounded-xl bg-white/70 p-2"><p className="font-bold">{selected.uploadsUsed}</p><p className="text-[11px] text-slate-500">Yuklagan</p></div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">Universitet</dt><dd>{selected.univ || '—'}</dd>
              <dt className="text-slate-500">Kurs / yo'nalish</dt><dd>{[selected.kurs, selected.yonalish].filter(Boolean).join(' · ') || '—'}</dd>
              <dt className="text-slate-500">Semestr</dt><dd>{selected.semester || '—'}</dd>
              <dt className="text-slate-500">VIP</dt><dd>{selected.isVip ? (selected.vipEnd ? `${date(selected.vipEnd)} gacha` : 'Ha') : "Yo'q"}</dd>
              <dt className="text-slate-500">Oxirgi faollik</dt><dd>{selected.lastSeen ? ago(selected.lastSeen) : '—'}</dd>
              <dt className="text-slate-500">Taklif qilganlar</dt><dd>{selected.referralCount}</dd>
              {selected.fakeCheckCount > 0 && <><dt className="text-slate-500">Soxta cheklar</dt><dd className="text-rose-600">{selected.fakeCheckCount}/3</dd></>}
            </dl>
            {!selected.isVip && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-600">VIP muddati:</span>
                {[7, 30, 90].map((dd) => <button key={dd} onClick={() => setVipDays(dd)} className={`rounded-full px-2.5 py-1 text-xs ${vipDays === dd ? 'bg-slate-900 text-white' : 'bg-white/70'}`}>{dd} kun</button>)}
              </div>
            )}
            <div className="rounded-xl bg-white/60 p-3">
              <p className="mb-2 text-sm font-medium">Ballni tuzatish</p>
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" min={1} className="input !w-24" value={delta} onChange={(e) => setDelta(Math.abs(Number(e.target.value)))} />
                <button className="btn-light" onClick={() => score(selected, delta)}><PlusCircle size={15} /> Qo'shish</button>
                <button className="btn-light" onClick={() => score(selected, -delta)}><MinusCircle size={15} /> Ayirish</button>
              </div>
            </div>
            <div className="rounded-xl bg-white/60 p-3">
              <p className="mb-2 text-sm font-medium">Shaxsiy xabar (bot orqali)</p>
              <textarea className="input min-h-20" placeholder="Xabar matni..." value={msg} onChange={(e) => setMsg(e.target.value)} />
              <button className="btn-dark mt-2" disabled={!msg.trim()} onClick={() => sendMsg(selected)}><Send size={15} /> Yuborish</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
