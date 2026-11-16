import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend } from 'recharts';
import { Users, Activity, Gem, ClipboardCheck, Wallet, Cpu, Clock, ShieldCheck, Megaphone, Crown, FileUp } from 'lucide-react';
import { Card, CardHeader, StatCard, PageHeader, Badge, Avatar, Loading, ErrorBox, Empty, fmt, som, usd, ago } from '../components/ui.jsx';
import { useApi } from '../data/api.js';

const COLORS = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#a855f7', '#84cc16'];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Xayrli tun';
  if (h < 12) return 'Xayrli tong';
  if (h < 18) return 'Xayrli kun';
  return 'Xayrli kech';
}
const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : undefined);

export default function Dashboard() {
  const nav = useNavigate();
  const { data: d, error, loading, reload } = useApi('/dashboard', { refreshMs: 60000 });
  if (loading && !d) return <Loading />;
  if (error && !d) return <ErrorBox error={error} onRetry={reload} />;

  const vipRate = d.totalUsers ? Math.round((d.vipCount / d.totalUsers) * 100) : 0;
  const univ = d.byUniv.slice(0, 7).map((u, i) => ({ ...u, short: u.name.replace(/ Universiteti$/, '').replace('Toshkent Davlat Iqtisodiyot', 'TDIU'), color: COLORS[i % COLORS.length] }));
  const restCount = d.byUniv.slice(7).reduce((s, u) => s + u.value, 0);
  if (restCount) univ.push({ name: 'Boshqalar', short: 'Boshqalar', value: restCount, color: '#94a3b8' });
  const weekTests = d.activity.slice(-7).reduce((s, x) => s + x.tests, 0);

  return (
    <>
      <PageHeader
        title={`${greeting()}! 👋`}
        subtitle="StudentAI bot va web ilovasining bugungi holati"
        actions={<button className="btn-dark" onClick={() => nav('/broadcast')}><Megaphone size={16} /> Xabar yuborish</button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} tone="sky" title="Foydalanuvchilar" value={fmt(d.totalUsers)} hint={`${fmt(d.registered)} ta ro'yxatdan o'tgan`} />
        <StatCard icon={Activity} tone="violet" title="Bugun faol" value={fmt(d.activeToday)} hint="Botdan foydalanganlar" />
        <StatCard icon={Gem} tone="amber" title="Faol VIP'lar" value={fmt(d.vipCount)} hint={`${vipRate}% konversiya`} />
        <StatCard icon={ClipboardCheck} tone="emerald" title="Bugungi testlar" value={fmt(d.todayTests)} hint={`Shu hafta: ${fmt(weekTests)}`} />
        <StatCard icon={Wallet} tone="emerald" title="Shu oy daromad" value={som(d.monthRevenue)} change={pct(d.monthRevenue, d.prevRevenue)} hint="Tasdiqlangan to'lovlar" />
        <StatCard icon={Cpu} tone="rose" title="AI xarajati (oy)" value={usd(d.aiCostMonth)} hint={d.aiBudget ? `Budjet: ${usd(d.aiBudget)}` : 'Budjet belgilanmagan'} />
        <button className="text-left" onClick={() => nav('/payments')}><StatCard icon={Clock} tone="amber" title="Kutilayotgan to'lovlar" value={d.pendingPayments} hint="Tasdiqlash kerak" /></button>
        <button className="text-left" onClick={() => nav('/moderation')}><StatCard icon={ShieldCheck} tone="violet" title="Ochiq shikoyatlar" value={d.openReports} hint={`${d.uploadsCount} ta yuklangan test`} /></button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Faollik" subtitle="Oxirgi 14 kun: testlar, faol va yangi foydalanuvchilar" />
          <div className="h-64 px-2 pb-3 pt-4">
            <ResponsiveContainer>
              <BarChart data={d.activity} barGap={3}>
                <CartesianGrid vertical={false} stroke="rgba(100,116,139,.15)" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" width={36} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,.35)' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="tests" name="Testlar" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="active" name="Faol" fill="#6366f1" radius={[6, 6, 0, 0]} />
                <Bar dataKey="newUsers" name="Yangi" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="px-5 pb-4 text-xs text-slate-500">Statistika shu yangilanishdan boshlab yig'iladi — oldingi kunlar bo'sh ko'rinadi.</p>
        </Card>

        <Card>
          <CardHeader title="Universitetlar" subtitle="Foydalanuvchilar taqsimoti" />
          {univ.length ? (
            <>
              <div className="relative mx-auto h-44 w-44">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={univ} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none" isAnimationActive={false}>
                      {univ.map((u) => <Cell key={u.name} fill={u.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, n, p) => [v, p.payload.name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div><p className="text-2xl font-bold">{fmt(d.totalUsers)}</p><p className="text-[11px] text-slate-500">jami</p></div>
                </div>
              </div>
              <ul className="space-y-1.5 px-5 pb-5 pt-2">
                {univ.map((u) => (
                  <li key={u.name} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: u.color }} />
                    <span className="flex-1 truncate text-slate-600" title={u.name}>{u.short}</span>
                    <span className="font-semibold">{fmt(u.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : <Empty text="Hali foydalanuvchi yo'q" />}
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Kutilayotgan to'lovlar" subtitle="Chek yuborgan foydalanuvchilar" right={<button className="btn-light !py-1.5 text-xs" onClick={() => nav('/payments')}>Barchasi</button>} />
          {d.pending.length ? (
            <ul className="px-2 pb-2 pt-3">
              {d.pending.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/40">
                  <Avatar name={p.name || '?'} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name || p.userId}</p>
                    <p className="text-xs text-slate-500">{p.plan} · {ago(p.createdAt)}</p>
                  </div>
                  <span className="text-sm font-semibold">{som(p.amount)}</span>
                  <Badge tone="amber">Kutilmoqda</Badge>
                </li>
              ))}
            </ul>
          ) : <Empty icon="✅" text="Kutilayotgan to'lov yo'q" />}
        </Card>

        <Card>
          <CardHeader title="Reyting TOP-5" subtitle="Umumiy ball bo'yicha" right={<Crown size={18} className="text-amber-500" />} />
          {d.top.length ? (
            <ul className="px-2 pb-2 pt-3">
              {d.top.map((u, i) => (
                <li key={u.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/40">
                  <span className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-orange-300 text-white' : 'bg-white/70 text-slate-500'}`}>{i + 1}</span>
                  <Avatar name={u.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.name} {u.isVip && <Gem size={12} className="inline text-amber-500" />}</p>
                    <p className="truncate text-xs text-slate-500">{[u.univ, u.kurs].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                  <span className="text-sm font-bold text-sky-700">{fmt(Math.round(u.score))}</span>
                </li>
              ))}
            </ul>
          ) : <Empty text="Hali reyting yo'q" />}
        </Card>
      </div>

      <Card className="mt-5 flex items-center gap-3 p-4">
        <FileUp size={18} className="text-sky-600" />
        <p className="text-sm text-slate-700">Talabalar yuklagan testlar: <b>{d.uploadsCount}</b> ta. Sifatlilarini "Moderatsiya" bo'limida bot menyusidagi fanga aylantirishingiz mumkin.</p>
      </Card>
    </>
  );
}
