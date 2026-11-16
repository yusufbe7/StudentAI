import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Wallet, Cpu, TrendingUp, Gem, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, StatCard, PageHeader, Badge, Avatar, Loading, ErrorBox, Empty, som, usd, fmt, ago } from '../components/ui.jsx';
import { useApi } from '../data/api.js';

const TASKS = { extract: "Fayl o'qish (AI)", solve: 'Javobsiz savollar', explain: '"Tushuntirish"' };
const modelName = (m = '') => m.replace('claude-', '').replace(/-(\d)-(\d)/, ' $1.$2').replace(/^\w/, (c) => c.toUpperCase());
const USD_UZS = 12800;

export default function Finance() {
  const { data: d, error, loading, reload } = useApi('/finance');
  if (loading && !d) return <Loading />;
  if (error && !d) return <ErrorBox error={error} onRetry={reload} />;

  const cur = d.series.at(-1);
  const prev = d.series.at(-2);
  const profit = cur.revenue - cur.aiCostUsd * USD_UZS;
  const chart = d.series.map((m) => ({ month: m.month, Daromad: Math.round(m.revenue / 1000), 'AI xarajati': Math.round((m.aiCostUsd * USD_UZS) / 1000) }));
  const totalAi = d.aiByTask.reduce((s, a) => s + a.costUsd, 0) || 1;
  const budgetPct = d.aiBudget ? Math.min(100, Math.round((d.aiCostMonth / d.aiBudget) * 100)) : null;

  return (
    <>
      <PageHeader title="Moliya va AI" subtitle="Tasdiqlangan to'lovlar, Anthropic API xarajati va sof foyda" />

      {!d.aiEnabled && (
        <Card className="mb-5 flex items-center gap-3 border-amber-300/70 p-4">
          <AlertTriangle className="shrink-0 text-amber-600" />
          <p className="text-sm">AI o'chiq: serverda <code className="rounded bg-white/70 px-1">ANTHROPIC_API_KEY</code> o'rnatilmagan. Parser ishlaydi, AI tugmalari yashirilgan.</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Wallet} tone="emerald" title="Shu oy daromad" value={som(cur.revenue)} change={prev.revenue ? Math.round(((cur.revenue - prev.revenue) / prev.revenue) * 100) : undefined} hint={`O'tgan oy: ${som(prev.revenue)}`} />
        <StatCard icon={Cpu} tone="rose" title="AI xarajati (oy)" value={usd(cur.aiCostUsd)} hint={`≈ ${som(Math.round(cur.aiCostUsd * USD_UZS))}`} />
        <StatCard icon={TrendingUp} tone="sky" title="Sof foyda (taxminiy)" value={som(Math.round(profit))} hint="Daromad − AI (1$ ≈ 12 800 so'm)" />
        <StatCard icon={Gem} tone="amber" title="Faol VIP'lar" value={fmt(d.activeVips)} hint={`Narx: ${som(d.vipPrice)} / 30 kun`} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Daromad va AI xarajati" subtitle="Ming so'mda, oxirgi 12 oy" />
          <div className="h-72 px-2 pb-3 pt-4">
            <ResponsiveContainer>
              <ComposedChart data={chart}>
                <CartesianGrid vertical={false} stroke="rgba(100,116,139,.15)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" width={44} />
                <Tooltip formatter={(v) => `${fmt(v)} ming so'm`} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Daromad" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                <Line dataKey="AI xarajati" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-[15px] font-semibold">AI budjeti (shu oy)</h3>
          {budgetPct !== null ? (
            <>
              <p className="mt-4 text-3xl font-bold">{budgetPct}%</p>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/70">
                <div className={`h-full rounded-full ${budgetPct > 85 ? 'bg-rose-500' : 'bg-sky-500'}`} style={{ width: `${budgetPct}%` }} />
              </div>
              <p className="mt-2 text-sm text-slate-600">{usd(d.aiCostMonth)} / {usd(d.aiBudget)} sarflandi</p>
              <p className="mt-3 text-xs text-slate-500">Budjet tugasa AI funksiyalari keyingi oygacha to'xtaydi. "Sozlamalar"dan o'zgartiriladi.</p>
            </>
          ) : (
            <>
              <p className="mt-4 text-3xl font-bold">{usd(d.aiCostMonth)}</p>
              <p className="mt-2 text-sm text-slate-600">Oylik budjet belgilanmagan.</p>
              <p className="mt-3 text-xs text-slate-500">Xavfsizlik uchun "Sozlamalar"da oylik limit qo'ying va Anthropic Console'da ham limit o'rnating.</p>
            </>
          )}
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="AI xarajati funksiyalar bo'yicha" subtitle="Shu oy" />
          {d.aiByTask.length ? (
            <div className="overflow-x-auto p-2">
              <table className="w-full">
                <thead><tr><th className="th">Funksiya</th><th className="th">Model</th><th className="th text-right">So'rov</th><th className="th text-right">Xarajat</th></tr></thead>
                <tbody>
                  {d.aiByTask.map((a) => (
                    <tr key={a.task + a.model} className="border-t border-white/60">
                      <td className="td font-medium">{TASKS[a.task] || a.task}</td>
                      <td className="td"><Badge tone={a.model.includes('haiku') ? 'green' : a.model.includes('sonnet') ? 'blue' : 'violet'}>{modelName(a.model)}</Badge></td>
                      <td className="td text-right">{fmt(a.requests)}</td>
                      <td className="td text-right">
                        <span className="font-semibold">{usd(a.costUsd)}</span>
                        <div className="ml-auto mt-1 h-1 w-20 overflow-hidden rounded-full bg-white/70"><div className="h-full rounded-full bg-sky-500" style={{ width: `${(a.costUsd / totalAi) * 100}%` }} /></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty icon="🤖" text="Shu oy AI so'rovlari bo'lmagan" />}
        </Card>

        <Card>
          <CardHeader title="Oxirgi to'lovlar" subtitle="Tasdiqlangan va rad etilgan" />
          {d.recentPayments.length ? (
            <div className="overflow-x-auto p-2">
              <table className="w-full">
                <thead><tr><th className="th">Foydalanuvchi</th><th className="th">Tarif</th><th className="th text-right">Summa</th><th className="th">Holat</th></tr></thead>
                <tbody>
                  {d.recentPayments.map((p) => (
                    <tr key={p.id} className="border-t border-white/60">
                      <td className="td"><div className="flex items-center gap-2"><Avatar name={p.name || '?'} size={28} /><div><p className="font-medium">{p.name || p.userId}</p><p className="text-xs text-slate-500">{ago(p.decidedAt || p.createdAt)}</p></div></div></td>
                      <td className="td text-slate-600">{p.plan}</td>
                      <td className="td text-right font-semibold">{som(p.amount)}</td>
                      <td className="td">{p.status === 'approved' ? <Badge tone="green">To'landi</Badge> : <Badge tone="red">Rad etildi</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty text="Hali to'lov yo'q" />}
        </Card>
      </div>
    </>
  );
}
