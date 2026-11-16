import { Gem, BookOpen, ShieldCheck, Ban, Megaphone, Settings, Radio } from 'lucide-react';
import { Card, PageHeader, Avatar, ago, date } from '../components/ui.jsx';
import { activityLog } from '../data/mock.js';

const ICONS = {
  vip: [Gem, 'bg-amber-500/15 text-amber-600'],
  content: [BookOpen, 'bg-sky-500/15 text-sky-600'],
  moderation: [ShieldCheck, 'bg-violet-500/15 text-violet-600'],
  block: [Ban, 'bg-rose-500/15 text-rose-600'],
  broadcast: [Megaphone, 'bg-emerald-500/15 text-emerald-600'],
  settings: [Settings, 'bg-slate-500/15 text-slate-600'],
  channel: [Radio, 'bg-cyan-500/15 text-cyan-600'],
};

export default function Activity() {
  return (
    <>
      <PageHeader title="Faoliyat logi" subtitle="Kim, qachon va nimani o'zgartirgani (admin va moderatorlar)" />
      <Card className="p-5">
        <ol className="relative space-y-1 border-l border-white/80 pl-6">
          {activityLog.map((a, i) => {
            const [Icon, cls] = ICONS[a.type];
            return (
              <li key={i} className="relative rounded-xl p-3 hover:bg-white/40">
                <span className={`absolute -left-[38px] top-3 grid h-7 w-7 place-items-center rounded-full ring-4 ring-white/60 ${cls}`}><Icon size={14} /></span>
                <div className="flex flex-wrap items-center gap-2">
                  <Avatar name={a.who} size={24} />
                  <p className="text-sm"><b>{a.who}</b> {a.action.toLowerCase()}: <span className="text-slate-700">{a.target}</span></p>
                  <span className="ml-auto text-xs text-slate-500" title={date(a.at)}>{ago(a.at)}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
    </>
  );
}
