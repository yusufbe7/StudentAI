import { useState } from 'react';
import { Trophy, Play, Square, Users, UserPlus, Megaphone, Calendar, Clock, ListOrdered, Gem, Ban } from 'lucide-react';
import { Card, CardHeader, PageHeader, Badge, Avatar, Toggle, StatCard } from '../components/ui.jsx';
import { useToast } from '../components/Layout.jsx';
import { tournament as initial } from '../data/mock.js';

export default function Tournament() {
  const toast = useToast();
  const [t, setT] = useState(initial);
  const [form, setForm] = useState({ date: initial.date, time: initial.time, count: initial.count });
  const [userId, setUserId] = useState('');

  const medal = (i) => ['🥇', '🥈', '🥉'][i] || `${i + 1}`;

  return (
    <>
      <PageHeader
        title="Musobaqalar"
        subtitle="Haftalik test musobaqasi: rejalashtirish, qatnashchilar va natijalar"
        actions={
          t.started ? (
            <button className="btn-red" onClick={() => { setT({ ...t, started: false }); toast('⏹ Musobaqa yakunlandi'); }}><Square size={16} /> Yakunlash</button>
          ) : (
            <button className="btn-green" onClick={() => { setT({ ...t, started: true, isActive: true }); toast('🚀 Musobaqa boshlandi! Qatnashchilarga xabar yuborildi'); }}><Play size={16} /> Start berish</button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Trophy} tone="amber" title="Holat" value={t.started ? 'Davom etmoqda' : t.isActive ? 'Rejalashtirilgan' : "O'chiq"} />
        <StatCard icon={Calendar} tone="sky" title="Sana va vaqt" value={`${t.date}`} hint={`soat ${t.time}`} />
        <StatCard icon={ListOrdered} tone="violet" title="Savollar soni" value={t.count} hint="Har biriga 30 s" />
        <StatCard icon={Users} tone="emerald" title="Qatnashchilar" value={t.participants.length} change={22} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="p-5">
          <h3 className="font-semibold">Sozlash</h3>
          <Toggle label="Musobaqa rejimi" hint="Bot menyusida 🏆 tugmasi ko'rinadi" checked={t.isActive} onChange={(v) => { setT({ ...t, isActive: v }); toast(v ? 'Musobaqa rejimi yoqildi' : "Musobaqa o'chirildi"); }} />
          <div className="mt-2 space-y-3">
            <label className="block text-sm"><span className="mb-1 flex items-center gap-1 text-slate-600"><Calendar size={14} /> Sana</span><input className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label className="block text-sm"><span className="mb-1 flex items-center gap-1 text-slate-600"><Clock size={14} /> Vaqt</span><input type="time" className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
            <label className="block text-sm"><span className="mb-1 flex items-center gap-1 text-slate-600"><ListOrdered size={14} /> Savollar soni</span><input type="number" className="input" value={form.count} onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} /></label>
            <button className="btn-dark w-full justify-center" onClick={() => { setT({ ...t, ...form }); toast("📅 Musobaqa rejalashtirildi, e'lon yuborildi"); }}>Saqlash va e'lon qilish</button>
            <button className="btn-light w-full justify-center text-rose-600" onClick={() => { setT({ ...t, isActive: false, started: false, participants: [] }); toast('🚫 Musobaqa bekor qilindi'); }}><Ban size={15} /> Bekor qilish</button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold">Qatnashchilarni qo'shish</h3>
          <p className="mt-1 text-xs text-slate-500">Qo'shilganlarga bot orqali xabar boradi</p>
          <div className="mt-4 space-y-2">
            <button className="btn-light w-full justify-center" onClick={() => toast("👥 Barcha foydalanuvchilar qo'shildi")}><Users size={15} /> Hammani qo'shish</button>
            <button className="btn-light w-full justify-center" onClick={() => toast("💎 Faqat VIP'lar qo'shildi")}><Gem size={15} /> Faqat VIP'larni</button>
            <div className="flex gap-2 pt-2">
              <input className="input" placeholder="Telegram ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
              <button className="btn-dark shrink-0" onClick={() => { if (userId) { toast(`➕ ${userId} qo'shildi`); setUserId(''); } }}><UserPlus size={15} /></button>
            </div>
          </div>
          <div className="mt-5 flex -space-x-2">
            {initial.leaderboard.slice(0, 7).map((p) => <span key={p.name} className="rounded-full ring-2 ring-white"><Avatar name={p.name} size={30} /></span>)}
            <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-white text-[11px] font-semibold ring-2 ring-white">+{t.participants.length - 7}</span>
          </div>
        </Card>

        <Card>
          <CardHeader title="Natijalar" subtitle="Ball, keyin vaqt bo'yicha" right={<button className="btn-light !py-1.5 text-xs" onClick={() => toast("📢 Natijalar e'lon qilindi")}><Megaphone size={14} /> E'lon qilish</button>} />
          <ul className="space-y-1 p-3">
            {t.leaderboard.map((p, i) => (
              <li key={p.name} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${i < 3 ? 'bg-white/60' : ''}`}>
                <span className="w-6 text-center text-sm font-bold">{medal(i)}</span>
                <Avatar name={p.name} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="truncate text-[11px] text-slate-500">{p.univ}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-sky-700">{p.tourScore}/{t.count}</p>
                  <p className="text-[11px] text-slate-500">{Math.floor(p.timeSec / 60)}:{String(p.timeSec % 60).padStart(2, '0')}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <p className="mt-3 text-center text-xs text-white/70"><Badge tone="slate">Eslatma</Badge> Botdagi "🏆 Haftalik musobaqa", "🚀 Start berish", "📢 Natijalar", "👥 Boshqarish" tugmalari shu sahifaga ko'chirildi.</p>
    </>
  );
}
