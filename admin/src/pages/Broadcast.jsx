import { useState } from 'react';
import { Send, Clock, Image as ImageIcon, Users, Gem, GraduationCap, Moon, CheckCircle2, Bold, Italic, Link2 } from 'lucide-react';
import { Card, CardHeader, PageHeader, Badge, fmt, ago } from '../components/ui.jsx';
import { useToast } from '../components/Layout.jsx';
import { broadcasts as initial, UNIVERSITIES } from '../data/mock.js';

const SEGMENTS = [
  { id: 'all', label: 'Hammaga', icon: Users, count: 4206 },
  { id: 'vip', label: "Faqat VIP'lar", icon: Gem, count: 342 },
  { id: 'nonvip', label: 'VIP emaslar', icon: Users, count: 3864 },
  { id: 'inactive', label: '7 kundan beri kirmaganlar', icon: Moon, count: 1170 },
  { id: 'univ', label: 'Universitet bo\'yicha', icon: GraduationCap, count: null },
];

export default function Broadcast() {
  const toast = useToast();
  const [list, setList] = useState(initial);
  const [segment, setSegment] = useState('all');
  const [univ, setUniv] = useState(UNIVERSITIES[0]);
  const [text, setText] = useState("🎉 Yangi funksiya! Endi test faylingizni botga tashlang — AI uni avtomatik testga aylantiradi.\n\n👉 /start");
  const [schedule, setSchedule] = useState(false);
  const [when, setWhen] = useState('');
  const seg = SEGMENTS.find((s) => s.id === segment);
  const reach = seg.count ?? 820;

  const send = () => {
    const item = { id: `b${Date.now()}`, text, segment: segment === 'univ' ? univ : seg.label, sent: schedule ? undefined : reach, failed: schedule ? undefined : Math.round(reach * 0.02), status: schedule ? 'scheduled' : 'sent', at: schedule && when ? new Date(when).getTime() : Date.now() };
    setList((l) => [item, ...l]);
    toast(schedule ? '🕒 Xabar rejalashtirildi' : `📤 ${fmt(reach)} kishiga yuborilmoqda...`);
  };

  return (
    <>
      <PageHeader title="Xabar tarqatish" subtitle="Bot orqali segmentlangan xabarlar va rejalashtirish" />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <Card className="p-5 xl:col-span-3">
          <h3 className="font-semibold">Kimga?</h3>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SEGMENTS.map(({ id, label, icon: Icon, count }) => (
              <button key={id} onClick={() => setSegment(id)} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${segment === id ? 'border-sky-500 bg-white/90 shadow-sm' : 'border-white/70 bg-white/45 hover:bg-white/70'}`}>
                <Icon size={17} className={segment === id ? 'text-sky-600' : 'text-slate-400'} />
                <span className="flex-1 font-medium">{label}</span>
                {count && <span className="text-xs text-slate-500">{fmt(count)}</span>}
              </button>
            ))}
          </div>
          {segment === 'univ' && (
            <select className="input mt-3" value={univ} onChange={(e) => setUniv(e.target.value)}>
              {UNIVERSITIES.map((u) => <option key={u}>{u}</option>)}
            </select>
          )}

          <h3 className="mt-6 font-semibold">Xabar</h3>
          <div className="mt-2 overflow-hidden rounded-xl border border-white/80 bg-white/70">
            <div className="flex gap-1 border-b border-white/80 px-2 py-1.5 text-slate-500">
              {[Bold, Italic, Link2, ImageIcon].map((I, i) => <button key={i} className="rounded-md p-1.5 hover:bg-white"><I size={15} /></button>)}
              <span className="ml-auto self-center text-xs">{text.length} / 4096</span>
            </div>
            <textarea className="min-h-40 w-full resize-y bg-transparent p-3 text-sm outline-none" value={text} onChange={(e) => setText(e.target.value)} />
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} className="h-4 w-4 accent-sky-600" />
            Keyinroq yuborish
          </label>
          {schedule && <input type="datetime-local" className="input mt-2 !w-auto" value={when} onChange={(e) => setWhen(e.target.value)} />}

          <div className="mt-5 flex items-center justify-between">
            <p className="text-sm text-slate-600">Qabul qiluvchilar: <b>{fmt(reach)}</b> · taxminan {Math.ceil(reach / 25 * 0.6 / 60)} daqiqa</p>
            <button className="btn-dark" onClick={send}>{schedule ? <><Clock size={16} /> Rejalashtirish</> : <><Send size={16} /> Yuborish</>}</button>
          </div>
        </Card>

        <div className="space-y-5 xl:col-span-2">
          <Card className="p-5">
            <p className="mb-3 text-sm font-semibold">Telegram'da ko'rinishi</p>
            <div className="rounded-2xl bg-[#8fb6d9] p-4">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm shadow-sm">
                {text}
                <p className="mt-1 text-right text-[10px] text-slate-400">12:00 ✓✓</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Tarix" subtitle="Oxirgi xabarlar" />
            <ul className="space-y-2 p-3">
              {list.map((b) => (
                <li key={b.id} className="rounded-xl bg-white/50 p-3">
                  <p className="line-clamp-2 text-sm">{b.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Badge tone="blue">{b.segment}</Badge>
                    {b.status === 'sent' ? (
                      <><Badge tone="green"><CheckCircle2 size={11} /> {fmt(b.sent)}</Badge>{b.failed > 0 && <Badge tone="red">{b.failed} xato</Badge>}<span className="ml-auto">{ago(b.at)}</span></>
                    ) : (
                      <><Badge tone="amber"><Clock size={11} /> Rejalashtirilgan</Badge><span className="ml-auto">{ago(b.at)}</span></>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
