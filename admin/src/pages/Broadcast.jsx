import { useRef, useState } from 'react';
import { Send, Clock, Users, Gem, GraduationCap, Moon, CheckCircle2, Bold, Italic, XCircle, Loader2 } from 'lucide-react';
import { Card, CardHeader, PageHeader, Badge, Loading, ErrorBox, Empty, fmt, ago } from '../components/ui.jsx';
import { useAction } from '../components/Layout.jsx';
import { api, useApi } from '../data/api.js';

const ICONS = { all: Users, vip: Gem, nonvip: Users, inactive: Moon };
const STATUS = {
  sent: ['green', 'Yuborildi'], sending: ['blue', 'Yuborilmoqda'], queued: ['blue', 'Navbatda'],
  scheduled: ['amber', 'Rejalashtirilgan'], cancelled: ['slate', 'Bekor qilingan'], interrupted: ['red', 'Uzilib qoldi'],
};

export default function Broadcast() {
  const act = useAction();
  const { data, error, loading, reload } = useApi('/broadcasts', { refreshMs: 5000 });
  const [segment, setSegment] = useState('all');
  const [univ, setUniv] = useState('');
  const [text, setText] = useState('');
  const [schedule, setSchedule] = useState(false);
  const [when, setWhen] = useState('');
  const ta = useRef(null);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;

  const reach = segment === 'univ' ? (data.universities.find((u) => u.name === univ)?.count || 0) : (data.segments.find((s) => s.id === segment)?.count || 0);
  const wrap = (tag) => {
    const el = ta.current; if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    setText(`${text.slice(0, a)}<${tag}>${text.slice(a, b) || 'matn'}</${tag}>${text.slice(b)}`);
  };
  const send = () => act(
    () => api('/broadcasts', { method: 'POST', body: { text, segment, univ: segment === 'univ' ? univ : null, scheduleAt: schedule && when ? new Date(when).toISOString() : null } }),
    schedule ? '🕒 Xabar rejalashtirildi' : `📤 ${fmt(reach)} kishiga yuborilmoqda...`,
  ).then((r) => { if (r) { setText(''); reload(); } });

  return (
    <>
      <PageHeader title="Xabar tarqatish" subtitle="Bot orqali tanlangan guruhga xabar yuborish yoki keyinga rejalashtirish" />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <Card className="p-5 xl:col-span-3">
          <h3 className="font-semibold">Kimga?</h3>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.segments.map(({ id, label, count }) => {
              const Icon = ICONS[id] || Users;
              return (
                <button key={id} onClick={() => setSegment(id)} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${segment === id ? 'border-sky-500 bg-white/90 shadow-sm' : 'border-white/70 bg-white/45 hover:bg-white/70'}`}>
                  <Icon size={17} className={segment === id ? 'text-sky-600' : 'text-slate-400'} />
                  <span className="flex-1 font-medium">{label}</span>
                  <span className="text-xs text-slate-500">{fmt(count)}</span>
                </button>
              );
            })}
            <button onClick={() => { setSegment('univ'); if (!univ && data.universities[0]) setUniv(data.universities[0].name); }} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${segment === 'univ' ? 'border-sky-500 bg-white/90 shadow-sm' : 'border-white/70 bg-white/45 hover:bg-white/70'}`}>
              <GraduationCap size={17} className={segment === 'univ' ? 'text-sky-600' : 'text-slate-400'} />
              <span className="flex-1 font-medium">Universitet bo'yicha</span>
            </button>
          </div>
          {segment === 'univ' && (
            <select className="input mt-3" value={univ} onChange={(e) => setUniv(e.target.value)}>
              {data.universities.map((u) => <option key={u.name} value={u.name}>{u.name} ({u.count})</option>)}
            </select>
          )}

          <h3 className="mt-6 font-semibold">Xabar</h3>
          <div className="mt-2 overflow-hidden rounded-xl border border-white/80 bg-white/70">
            <div className="flex gap-1 border-b border-white/80 px-2 py-1.5 text-slate-500">
              <button title="Qalin" className="rounded-md p-1.5 hover:bg-white" onClick={() => wrap('b')}><Bold size={15} /></button>
              <button title="Qiya" className="rounded-md p-1.5 hover:bg-white" onClick={() => wrap('i')}><Italic size={15} /></button>
              <span className="ml-auto self-center text-xs">{text.length} / 4000</span>
            </div>
            <textarea ref={ta} className="min-h-40 w-full resize-y bg-transparent p-3 text-sm outline-none" placeholder="Masalan: 🏆 Shanba kuni soat 20:00 da musobaqa!" value={text} onChange={(e) => setText(e.target.value)} />
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} className="h-4 w-4 accent-sky-600" />
            Keyinroq yuborish
          </label>
          {schedule && <input type="datetime-local" className="input mt-2 !w-auto" value={when} onChange={(e) => setWhen(e.target.value)} />}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">Qabul qiluvchilar: <b>{fmt(reach)}</b> · taxminan {Math.max(1, Math.ceil(reach / 18 / 60))} daqiqa</p>
            <button className="btn-dark" disabled={!text.trim() || !reach || (schedule && !when)} onClick={send}>{schedule ? <><Clock size={16} /> Rejalashtirish</> : <><Send size={16} /> Yuborish</>}</button>
          </div>
        </Card>

        <div className="space-y-5 xl:col-span-2">
          <Card className="p-5">
            <p className="mb-3 text-sm font-semibold">Telegram'da ko'rinishi</p>
            <div className="rounded-2xl bg-[#8fb6d9] p-4">
              <div
                className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm shadow-sm"
                // Faqat <b>/<i> ko'rsatiladi, qolgan teglar matn sifatida
                dangerouslySetInnerHTML={{ __html: (text || 'Xabar matni...').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/&lt;(\/?)(b|i)&gt;/g, '<$1$2>') }}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Tarix" subtitle="Oxirgi xabarlar" />
            {data.broadcasts.length ? (
              <ul className="space-y-2 p-3">
                {data.broadcasts.map((b) => {
                  const [tone, label] = STATUS[b.status] || ['slate', b.status];
                  return (
                    <li key={b.id} className="rounded-xl bg-white/50 p-3">
                      <p className="line-clamp-2 text-sm">{b.text.replace(/<[^>]+>/g, '')}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge tone="blue">{b.label}</Badge>
                        <Badge tone={tone}>{b.status === 'sending' ? <Loader2 size={11} className="animate-spin" /> : b.status === 'sent' ? <CheckCircle2 size={11} /> : b.status === 'scheduled' ? <Clock size={11} /> : null} {label}</Badge>
                        {b.total !== undefined && <span>{fmt(b.sent)}/{fmt(b.total)}{b.failed ? ` · ${b.failed} xato` : ''}</span>}
                        <span className="ml-auto">{ago(b.at)}</span>
                        {b.status === 'scheduled' && <button title="Bekor qilish" className="text-rose-500" onClick={() => act(() => api(`/broadcasts/${b.id}`, { method: 'DELETE' }), 'Bekor qilindi').then(reload)}><XCircle size={15} /></button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <Empty icon="📣" text="Hali xabar yuborilmagan" />}
          </Card>
        </div>
      </div>
    </>
  );
}
