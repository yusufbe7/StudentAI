import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { Users, Activity, Gem, ClipboardCheck, Wallet, Cpu, Clock, ShieldCheck, Download, Megaphone, Crown } from 'lucide-react';
import { Card, CardHeader, StatCard, PageHeader, Badge, Avatar, fmt, som, usd, ago } from '../components/ui.jsx';
import { users, activity14, payments, uploads, reports, finance12, UNIVERSITIES } from '../data/mock.js';

const UNIV_COLORS = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#f43f5e'];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Xayrli tun';
  if (h < 12) return 'Xayrli tong';
  if (h < 18) return 'Xayrli kun';
  return 'Xayrli kech';
}

export default function Dashboard() {
  const nav = useNavigate();
  const vipCount = users.filter((u) => u.isVip).length;
  const activeToday = users.filter((u) => Date.now() - u.lastActive < 24 * 3600 * 1000).length;
  const todayTests = activity14.at(-1).tests;
  const lastMonth = finance12.at(-1);
  const prevMonth = finance12.at(-2);
  const pendingPay = payments.filter((p) => p.status === 'pending');
  const pendingMod = uploads.filter((u) => u.status === 'pending').length + reports.length;

  const byUniv = UNIVERSITIES.map((u, i) => ({ name: u.replace(' Universiteti', '').replace('Toshkent Davlat Iqtisodiyot', 'TDIU'), value: users.filter((x) => x.univ === u).length, color: UNIV_COLORS[i] }));
  const vipRate = Math.round((vipCount / users.length) * 100);
  const top = [...users].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <>
      <PageHeader
        title={`${greeting()}, Yusuf 👋`}
        subtitle="StudentAI bot va web ilovasining bugungi holati"
        actions={
          <>
            <button className="btn-light"><Download size={16} /> Hisobot (Excel)</button>
            <button className="btn-dark" onClick={() => nav('/broadcast')}><Megaphone size={16} /> Xabar yuborish</button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Faollik" subtitle="Oxirgi 14 kun: ishlangan testlar va yangi foydalanuvchilar" right={<Badge tone="blue">+18% haftalik</Badge>} />
          <div className="h-64 px-2 pb-3 pt-4">
            <ResponsiveContainer>
              <BarChart data={activity14} barGap={4}>
                <CartesianGrid vertical={false} stroke="rgba(100,116,139,.15)" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" width={36} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,.35)' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }} />
                <Bar dataKey="tests" name="Testlar" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="newUsers" name="Yangi" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Universitetlar" subtitle="Foydalanuvchilar taqsimoti" />
          <div className="relative mx-auto h-44 w-44">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byUniv} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={3} stroke="none">
                  {byUniv.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-2xl font-bold">{vipRate}%</p>
                <p className="text-[11px] text-slate-500">VIP konversiya</p>
              </div>
            </div>
          </div>
          <ul className="space-y-1.5 px-5 pb-5 pt-2">
            {byUniv.map((d) => (
              <li key={d.name} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                <span className="flex-1 truncate text-slate-600">{d.name}</span>
                <span className="font-semibold">{d.value}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} tone="sky" title="Jami foydalanuvchilar" value={fmt(4206)} change={12} hint={`${users.filter((u) => u.source === 'web').length > 0 ? '71% bot · 29% web' : ''}`} />
        <StatCard icon={Activity} tone="violet" title="Bugun faol" value={fmt(activeToday * 23)} change={8} hint="Oxirgi 24 soat" />
        <StatCard icon={Gem} tone="amber" title="VIP a'zolar" value={fmt(vipCount * 19)} change={5} hint={`${vipRate}% konversiya`} />
        <StatCard icon={ClipboardCheck} tone="emerald" title="Bugungi testlar" value={fmt(todayTests)} change={14} hint="Bot + web" />
        <StatCard icon={Wallet} tone="emerald" title="Oylik daromad" value={som(lastMonth.revenue)} change={Math.round(((lastMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100)} hint="Noyabr" />
        <StatCard icon={Cpu} tone="rose" title="AI xarajati (oy)" value={usd(lastMonth.aiCostUsd)} change={-4} hint="Budjet: $150" />
        <StatCard icon={Clock} tone="amber" title="Kutilayotgan to'lovlar" value={pendingPay.length} hint="Tasdiqlash kerak" />
        <StatCard icon={ShieldCheck} tone="violet" title="Moderatsiya navbati" value={pendingMod} hint="Fayllar va shikoyatlar" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Kutilayotgan to'lovlar" subtitle="Chek yuborgan foydalanuvchilar" right={<button className="btn-light !py-1.5 text-xs" onClick={() => nav('/payments')}>Barchasi</button>} />
          <ul className="divide-y divide-white/60 px-2 pb-2 pt-3">
            {pendingPay.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/40">
                <Avatar name={p.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.plan} · {ago(p.createdAt)}</p>
                </div>
                <span className="text-sm font-semibold">{som(p.amount)}</span>
                <Badge tone="amber">Kutilmoqda</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Reyting TOP-5" subtitle="Umumiy ball bo'yicha" right={<Crown size={18} className="text-amber-500" />} />
          <ul className="px-2 pb-2 pt-3">
            {top.map((u, i) => (
              <li key={u.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/40">
                <span className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-orange-300 text-white' : 'bg-white/70 text-slate-500'}`}>{i + 1}</span>
                <Avatar name={u.name} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.name} {u.isVip && <Gem size={12} className="inline text-amber-500" />}</p>
                  <p className="truncate text-xs text-slate-500">{u.univ} · {u.kurs}</p>
                </div>
                <span className="text-sm font-bold text-sky-700">{fmt(u.score)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
