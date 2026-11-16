import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { Wallet, Cpu, TrendingUp, Gem, Download } from 'lucide-react';
import { Card, CardHeader, StatCard, PageHeader, Badge, Avatar, som, usd, fmt, ago } from '../components/ui.jsx';
import { finance12, aiUsage, payments, USD_UZS, botSettings } from '../data/mock.js';

export default function Finance() {
  const last = finance12.at(-1);
  const prev = finance12.at(-2);
  const aiSom = last.aiCostUsd * USD_UZS;
  const profit = last.revenue - aiSom;
  const ratio = Math.round((aiSom / last.revenue) * 100);
  const totalAi = aiUsage.reduce((s, a) => s + a.costUsd, 0);
  const budgetPct = Math.round((totalAi / botSettings.monthlyAiBudgetUsd) * 100);
  const chart = finance12.map((m) => ({ ...m, revenueK: Math.round(m.revenue / 1000), aiK: Math.round((m.aiCostUsd * USD_UZS) / 1000) }));
  const approved = payments.filter((p) => p.status !== 'pending');

  return (
    <>
      <PageHeader
        title="Moliya va AI"
        subtitle="Daromad, Anthropic API xarajati va sof foyda"
        actions={<button className="btn-light"><Download size={16} /> CSV eksport</button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Wallet} tone="emerald" title="Oylik daromad" value={som(last.revenue)} change={Math.round(((last.revenue - prev.revenue) / prev.revenue) * 100)} hint="VIP + referat + slayd" />
        <StatCard icon={Cpu} tone="rose" title="AI xarajati" value={usd(last.aiCostUsd)} hint={`≈ ${som(aiSom)}`} change={-4} />
        <StatCard icon={TrendingUp} tone="sky" title="Sof foyda" value={som(profit)} hint={`AI daromadning ${ratio}% i`} change={15} />
        <StatCard icon={Gem} tone="amber" title="Faol VIP obunalar" value="342" hint={`Narx: ${som(10000)} / 30 kun`} change={6} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Daromad va AI xarajati" subtitle="Ming so'mda, oylar bo'yicha" right={<Badge tone="green">2026</Badge>} />
          <div className="h-72 px-2 pb-3 pt-4">
            <ResponsiveContainer>
              <ComposedChart data={chart}>
                <CartesianGrid vertical={false} stroke="rgba(100,116,139,.15)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" width={44} />
                <Tooltip formatter={(v) => `${fmt(v)} ming`} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }} />
                <Bar dataKey="revenueK" name="Daromad" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                <Line dataKey="aiK" name="AI xarajati" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="AI budjeti" subtitle="Shu oy, Anthropic Console limiti" />
          <div className="relative mx-auto h-48 w-48">
            <ResponsiveContainer>
              <RadialBarChart innerRadius="78%" outerRadius="100%" data={[{ v: budgetPct }]} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="v" cornerRadius={20} fill={budgetPct > 85 ? '#f43f5e' : '#0ea5e9'} background={{ fill: 'rgba(255,255,255,.5)' }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-3xl font-bold">{budgetPct}%</p>
                <p className="text-xs text-slate-500">sarflandi</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 px-5 pb-5 text-center">
            <div className="rounded-xl bg-white/60 py-2"><p className="text-sm font-bold">{usd(totalAi)}</p><p className="text-[11px] text-slate-500">Sarflangan</p></div>
            <div className="rounded-xl bg-white/60 py-2"><p className="text-sm font-bold">{usd(botSettings.monthlyAiBudgetUsd - totalAi)}</p><p className="text-[11px] text-slate-500">Qolgan</p></div>
            <div className="rounded-xl bg-white/60 py-2"><p className="text-sm font-bold">{fmt(aiUsage.reduce((s, a) => s + a.requests, 0))}</p><p className="text-[11px] text-slate-500">So'rov</p></div>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="AI xarajati ishlar bo'yicha" subtitle="Qaysi funksiya qancha sarflayapti" />
          <div className="overflow-x-auto p-2">
            <table className="w-full">
              <thead><tr><th className="th">Ish</th><th className="th">Model</th><th className="th text-right">So'rov</th><th className="th text-right">Xarajat</th></tr></thead>
              <tbody>
                {aiUsage.map((a) => (
                  <tr key={a.task} className="border-t border-white/60">
                    <td className="td font-medium">{a.task}</td>
                    <td className="td"><Badge tone={a.model.startsWith('Haiku') ? 'green' : 'violet'}>{a.model}</Badge></td>
                    <td className="td text-right">{fmt(a.requests)}</td>
                    <td className="td text-right">
                      <span className="font-semibold">{usd(a.costUsd)}</span>
                      <div className="ml-auto mt-1 h-1 w-20 overflow-hidden rounded-full bg-white/70">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${(a.costUsd / totalAi) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Oxirgi to'lovlar" subtitle="Tasdiqlangan va rad etilgan" />
          <div className="overflow-x-auto p-2">
            <table className="w-full">
              <thead><tr><th className="th">Foydalanuvchi</th><th className="th">Tarif</th><th className="th text-right">Summa</th><th className="th">Holat</th></tr></thead>
              <tbody>
                {approved.map((p) => (
                  <tr key={p.id} className="border-t border-white/60">
                    <td className="td"><div className="flex items-center gap-2"><Avatar name={p.name} size={28} /><div><p className="font-medium">{p.name}</p><p className="text-xs text-slate-500">{ago(p.createdAt)}</p></div></div></td>
                    <td className="td text-slate-600">{p.plan}</td>
                    <td className="td text-right font-semibold">{som(p.amount)}</td>
                    <td className="td">{p.status === 'approved' ? <Badge tone="green">To'landi</Badge> : <Badge tone="red">Rad etildi</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
