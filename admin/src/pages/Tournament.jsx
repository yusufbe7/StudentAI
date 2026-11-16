import { useEffect, useState } from 'react';
import { Trophy, Play, Users, UserPlus, Megaphone, Calendar, Clock, ListOrdered, Gem, Ban, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, PageHeader, Avatar, StatCard, Modal, Loading, ErrorBox, Empty, Badge } from '../components/ui.jsx';
import { useAction } from '../components/Layout.jsx';
import { api, useApi } from '../data/api.js';

const todayStr = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; };

export default function Tournament() {
  const act = useAction();
  const { data: t, error, loading, reload } = useApi('/tournament', { refreshMs: 15000 });
  const [form, setForm] = useState(null);
  const [userId, setUserId] = useState('');
  const [confirm, setConfirm] = useState(null);

  useEffect(() => { if (t && !form) setForm({ date: t.date || todayStr(), time: t.time || '20:00', count: t.count || 30 }); }, [t]); // eslint-disable-line
  if (loading && !t) return <Loading />;
  if (error && !t) return <ErrorBox error={error} onRetry={reload} />;

  const run = (fn, msg) => act(fn, msg).then((r) => { reload(); setConfirm(null); return r; });
  const ACTIONS = {
    create: { title: "Musobaqani e'lon qilish", text: `${form?.date} soat ${form?.time} da ${form?.count} ta savollik musobaqa e'lon qilinadi. Barcha foydalanuvchilarga xabar boradi va eski musobaqa ballari tozalanadi.`, go: () => run(() => api('/tournament', { method: 'POST', body: form }), "📣 Musobaqa e'lon qilindi") },
    start: { title: 'Start berish', text: `${t.participants} ta qatnashchiga "🏁 Testni boshlash" tugmasi yuboriladi.`, go: () => run(() => api('/tournament/start', { method: 'POST' }), (r) => `🚀 ${r.sent} kishiga yuborildi`) },
    announce: { title: "Natijalarni e'lon qilish", text: "TOP-10 natijalar barcha qatnashchilarga yuboriladi va musobaqa yopiladi.", go: () => run(() => api('/tournament/announce', { method: 'POST' }), "🏆 Natijalar e'lon qilindi") },
    cancel: { title: 'Musobaqani bekor qilish', text: "Musobaqa bekor qilinadi, qatnashchilarga xabar boradi.", go: () => run(() => api('/tournament/cancel', { method: 'POST' }), '🚫 Bekor qilindi') },
  };
  const medal = (i) => ['🥇', '🥈', '🥉'][i] || `${i + 1}`;
  const status = t.isActive ? (t.started ? 'Davom etmoqda' : "E'lon qilingan") : "Faol emas";

  return (
    <>
      <PageHeader
        title="Musobaqalar"
        subtitle="Haftalik test musobaqasi: e'lon, qatnashchilar, start va natijalar"
        actions={t.isActive && (
          <>
            <button className="btn-green" onClick={() => setConfirm('start')}><Play size={16} /> Start berish</button>
            <button className="btn-dark" onClick={() => setConfirm('announce')}><Megaphone size={16} /> Natijalar</button>
          </>
        )}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Trophy} tone="amber" title="Holat" value={status} />
        <StatCard icon={Calendar} tone="sky" title="Sana va vaqt" value={t.date || '—'} hint={t.time ? `soat ${t.time}` : ''} />
        <StatCard icon={ListOrdered} tone="violet" title="Savollar" value={t.isActive ? t.count : '—'} hint="Har biriga 30 s" />
        <StatCard icon={Users} tone="emerald" title="Qatnashchilar" value={t.participants} hint={t.leaderboard.filter((x) => x.finished).length ? `${t.leaderboard.filter((x) => x.finished).length} ta yakunladi` : ''} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="p-5">
          <h3 className="font-semibold">{t.isActive ? 'Yangi musobaqa' : "Musobaqa e'lon qilish"}</h3>
          {form && (
            <div className="mt-3 space-y-3">
              <label className="block text-sm"><span className="mb-1 flex items-center gap-1 text-slate-600"><Calendar size={14} /> Sana</span><input className="input" placeholder="22.11.2026" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
              <label className="block text-sm"><span className="mb-1 flex items-center gap-1 text-slate-600"><Clock size={14} /> Vaqt</span><input type="time" className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
              <label className="block text-sm"><span className="mb-1 flex items-center gap-1 text-slate-600"><ListOrdered size={14} /> Savollar soni</span><input type="number" min={5} max={200} className="input" value={form.count} onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} /></label>
              <button className="btn-dark w-full justify-center" onClick={() => setConfirm('create')}><Megaphone size={15} /> E'lon qilish</button>
              {t.isActive && <button className="btn-light w-full justify-center text-rose-600" onClick={() => setConfirm('cancel')}><Ban size={15} /> Joriy musobaqani bekor qilish</button>}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold">Qatnashchilarni qo'shish</h3>
          <p className="mt-1 text-xs text-slate-500">Talabalar o'zi ham "🏆 Musobaqaga o'tish" orqali qo'shiladi. Qo'shilganlarga bot xabar yuboradi.</p>
          {t.isActive ? (
            <div className="mt-4 space-y-2">
              <button className="btn-light w-full justify-center" onClick={() => run(() => api('/tournament/participants', { method: 'POST', body: { mode: 'all' } }), (r) => `👥 ${r.added} kishi qo'shildi`)}><Users size={15} /> Hammani qo'shish</button>
              <button className="btn-light w-full justify-center" onClick={() => run(() => api('/tournament/participants', { method: 'POST', body: { mode: 'vip' } }), (r) => `💎 ${r.added} VIP qo'shildi`)}><Gem size={15} /> Faqat VIP'larni</button>
              <div className="flex gap-2 pt-2">
                <input className="input" placeholder="Telegram ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
                <button className="btn-dark shrink-0" disabled={!userId} onClick={() => run(() => api('/tournament/participants', { method: 'POST', body: { mode: 'id', userId } }), `➕ ${userId} qo'shildi`).then(() => setUserId(''))}><UserPlus size={15} /></button>
              </div>
            </div>
          ) : <Empty icon="🏆" text="Avval musobaqa e'lon qiling" />}
        </Card>

        <Card>
          <CardHeader title="Natijalar" subtitle="Musobaqa bali bo'yicha" />
          {t.leaderboard.length ? (
            <ul className="max-h-[420px] space-y-1 overflow-y-auto p-3">
              {t.leaderboard.map((p, i) => (
                <li key={p.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${i < 3 && p.tourScore > 0 ? 'bg-white/60' : ''}`}>
                  <span className="w-6 text-center text-sm font-bold">{medal(i)}</span>
                  <Avatar name={p.name} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-[11px] text-slate-500">{p.univ || '—'}</p>
                  </div>
                  {p.finished && <CheckCircle2 size={14} className="text-emerald-500" title="Yakunladi" />}
                  <Badge tone="blue">{p.tourScore}/{t.count}</Badge>
                </li>
              ))}
            </ul>
          ) : <Empty text="Hali qatnashchi yo'q" />}
        </Card>
      </div>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={ACTIONS[confirm]?.title} footer={<><button className="btn-light" onClick={() => setConfirm(null)}>Bekor qilish</button><button className={confirm === 'cancel' ? 'btn-red' : 'btn-dark'} onClick={() => ACTIONS[confirm].go()}>Tasdiqlayman</button></>}>
        <p className="text-sm">{ACTIONS[confirm]?.text}</p>
      </Modal>
    </>
  );
}
