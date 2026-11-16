import { Gem, BookOpen, ShieldCheck, Ban, Megaphone, Settings, Radio, Trophy, LogIn, PlusCircle, Circle } from 'lucide-react';
import { Card, PageHeader, Avatar, Loading, ErrorBox, Empty, ago, date } from '../components/ui.jsx';
import { useApi } from '../data/api.js';

const ICONS = {
  vip: [Gem, 'bg-amber-500/15 text-amber-600'],
  content: [BookOpen, 'bg-sky-500/15 text-sky-600'],
  moderation: [ShieldCheck, 'bg-violet-500/15 text-violet-600'],
  block: [Ban, 'bg-rose-500/15 text-rose-600'],
  broadcast: [Megaphone, 'bg-emerald-500/15 text-emerald-600'],
  settings: [Settings, 'bg-slate-500/15 text-slate-600'],
  channel: [Radio, 'bg-cyan-500/15 text-cyan-600'],
  tournament: [Trophy, 'bg-orange-500/15 text-orange-600'],
  auth: [LogIn, 'bg-indigo-500/15 text-indigo-600'],
  score: [PlusCircle, 'bg-teal-500/15 text-teal-600'],
};

export default function Activity() {
  const { data, error, loading, reload } = useApi('/activity', { refreshMs: 30000 });
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;

  return (
    <>
      <PageHeader title="Faoliyat logi" subtitle="Panel va bot orqali qilingan admin amallari: kim, qachon, nima" />
      <Card className="p-5">
        {data.log.length ? (
          <ol className="relative ml-3 space-y-1 border-l border-white/80 pl-6">
            {data.log.map((a, i) => {
              const [Icon, cls] = ICONS[a.type] || [Circle, 'bg-slate-500/15 text-slate-600'];
              return (
                <li key={i} className="relative rounded-xl p-3 hover:bg-white/40">
                  <span className={`absolute -left-[38px] top-3 grid h-7 w-7 place-items-center rounded-full ring-4 ring-white/60 ${cls}`}><Icon size={14} /></span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Avatar name={a.who || 'Admin'} size={24} />
                    <p className="text-sm"><b>{a.who}</b> — {a.action}{a.target && <>: <span className="text-slate-700">{a.target}</span></>}</p>
                    <span className="ml-auto text-xs text-slate-500" title={date(a.at)}>{ago(a.at)}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : <Empty icon="📜" text="Hali amal bajarilmagan" />}
      </Card>
    </>
  );
}
