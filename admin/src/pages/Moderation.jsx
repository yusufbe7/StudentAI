import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Trash2, Eye, Flag, Upload, Cpu, Bot, AlertTriangle, Pencil, Plus, X } from 'lucide-react';
import { Card, PageHeader, Badge, Avatar, Tabs, Modal, Loading, ErrorBox, Empty, ago } from '../components/ui.jsx';
import { useAction } from '../components/Layout.jsx';
import { api, useApi } from '../data/api.js';

const COLORS = ['from-sky-400 to-blue-600', 'from-violet-400 to-indigo-600', 'from-amber-400 to-orange-600', 'from-emerald-400 to-teal-600', 'from-rose-400 to-pink-600', 'from-cyan-400 to-sky-600'];
const L = 'ABCDEF';

function QuestionEditor({ report, onClose, onSaved }) {
  const act = useAction();
  const { data, error, loading } = useApi(`/subjects/${encodeURIComponent(report.subject)}/question?q=${encodeURIComponent(report.q)}`);
  const [form, setForm] = useState(null);
  if (data && !form) setForm({ q: data.question.q, options: [...data.question.options], a: data.question.a, hint: data.question.hint || '' });

  const save = () => act(
    () => api(`/subjects/${encodeURIComponent(report.subject)}/question`, { method: 'PUT', body: { originalQ: report.q, ...form, options: form.options.filter((o) => o.trim()) } }),
    '✏️ Savol tuzatildi',
  ).then((r) => r && onSaved());

  return (
    <Modal
      open
      onClose={onClose}
      title="Savolni tahrirlash"
      footer={form && <><button className="btn-light" onClick={onClose}>Bekor qilish</button><button className="btn-dark" onClick={save}>Saqlash va shikoyatni yopish</button></>}
    >
      {loading ? <p className="py-8 text-center text-sm text-slate-500">Yuklanmoqda...</p> : error ? <p className="text-sm text-rose-600">{error}</p> : form && (
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          <label className="block text-sm"><span className="mb-1 block text-slate-600">Savol</span><textarea className="input min-h-20" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></label>
          <div>
            <p className="mb-1 text-sm text-slate-600">Variantlar (to'g'ri javobni belgilang)</p>
            {form.options.map((o, i) => (
              <div key={i} className="mb-1.5 flex items-center gap-2">
                <input type="radio" name="correct" className="h-4 w-4 accent-emerald-600" checked={form.a === o && o !== ''} onChange={() => setForm({ ...form, a: o })} />
                <input className="input" value={o} onChange={(e) => { const opts = [...form.options]; const wasA = form.a === opts[i]; opts[i] = e.target.value; setForm({ ...form, options: opts, a: wasA ? e.target.value : form.a }); }} />
                {form.options.length > 2 && <button className="text-slate-400 hover:text-rose-500" onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })}><X size={16} /></button>}
              </div>
            ))}
            {form.options.length < 6 && <button className="btn-light !py-1 text-xs" onClick={() => setForm({ ...form, options: [...form.options, ''] })}><Plus size={13} /> Variant</button>}
          </div>
          <label className="block text-sm"><span className="mb-1 block text-slate-600">Tushuntirish (ixtiyoriy)</span><textarea className="input min-h-16" value={form.hint} onChange={(e) => setForm({ ...form, hint: e.target.value })} /></label>
        </div>
      )}
    </Modal>
  );
}

export default function Moderation() {
  const act = useAction();
  const [tab, setTab] = useState('reports');
  const reports = useApi('/reports', { refreshMs: 60000 });
  const uploads = useApi('/uploads');
  const content = useApi('/content');
  const [preview, setPreview] = useState(null);
  const [publish, setPublish] = useState(null);
  const [editing, setEditing] = useState(null);
  const [del, setDel] = useState(null);

  const closeReport = (r, body, msg) => act(() => api(`/reports/${r.id}/close`, { method: 'POST', body }), msg).then((x) => x && reports.reload());
  const dirs = Object.keys(content.data?.subjectsByDirection || {});

  const doPublish = () => act(
    () => api(`/uploads/${publish.u.id}/publish`, { method: 'POST', body: { dir: publish.dir, sem: publish.sem, name: publish.name, icon: publish.icon } }),
    (r) => `✅ "${publish.name}" bot menyusiga qo'shildi (${r.count} savol)`,
  ).then((r) => { if (r) { setPublish(null); uploads.reload(); } });

  return (
    <>
      <PageHeader
        title="Moderatsiya"
        subtitle="Savollardagi xatolar haqidagi shikoyatlar va talabalar yuklagan testlar"
        actions={<Tabs value={tab} onChange={setTab} items={[{ value: 'reports', label: 'Shikoyatlar', count: reports.data?.open.length }, { value: 'uploads', label: 'Yuklangan testlar', count: uploads.data?.uploads.length }]} />}
      />

      {tab === 'reports' && (reports.loading && !reports.data ? <Loading /> : reports.error && !reports.data ? <ErrorBox error={reports.error} onRetry={reports.reload} /> : (
        <Card>
          {reports.data.open.length ? (
            <ul className="space-y-2 p-3">
              <AnimatePresence>
                {reports.data.open.map((r) => {
                  const editable = r.subject && !String(r.subject).startsWith('ut_') && r.subject !== 'retry';
                  return (
                    <motion.li key={r.id} layout exit={{ opacity: 0, x: 40 }} className="rounded-xl bg-white/55 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-500/15 text-rose-600"><Flag size={18} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{r.q}</p>
                          <p className="mt-1 text-sm text-emerald-700">✅ Hozirgi javob: {r.a}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500"><Badge tone="blue">{r.subject || 'Noma\'lum fan'}</Badge> {r.userName} · {ago(r.createdAt)}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {editable && <button className="btn-dark" onClick={() => setEditing(r)}><Pencil size={15} /> Tuzatish</button>}
                          <button className="btn-light" title="Savol to'g'ri ekan — shikoyatchiga jarima (-100/-200/-300 ball)" onClick={() => closeReport(r, { fine: true }, '❌ Jarima berildi')}>Savol to'g'ri (jarima)</button>
                          <button className="btn-light" onClick={() => closeReport(r, {}, 'Shikoyat yopildi')}>Yopish</button>
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          ) : <Empty icon="🎉" text='Ochiq shikoyat yo&apos;q. Talabalar testda "⚠️ Xato bor" tugmasini bossa, shu yerga tushadi.' />}
        </Card>
      ))}

      {tab === 'uploads' && (uploads.loading && !uploads.data ? <Loading /> : uploads.error && !uploads.data ? <ErrorBox error={uploads.error} onRetry={uploads.reload} /> : (
        uploads.data.uploads.length ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {uploads.data.uploads.map((u, i) => (
              <Card hover key={u.id} className="overflow-hidden">
                <div className={`relative h-28 bg-gradient-to-br ${COLORS[i % COLORS.length]} p-4 text-white`}>
                  <Upload size={24} className="opacity-90" />
                  <p className="mt-2 truncate text-lg font-bold leading-tight">{u.subject}</p>
                  <p className="truncate text-xs text-white/80">{u.fileName}</p>
                  <span className="absolute right-3 top-3 rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-medium backdrop-blur">{u.lang === 'ru' ? 'RU' : 'UZ'}</span>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="blue">{u.questions} savol</Badge>
                    <Badge>{u.options} variant</Badge>
                    {u.missing > 0 ? <Badge tone="amber"><AlertTriangle size={11} /> {u.missing} javobsiz</Badge> : <Badge tone="green">Javoblar to'liq</Badge>}
                    {u.aiGuess > 0 && <Badge tone="violet">🤖 {u.aiGuess} AI javob</Badge>}
                    {u.source === 'ai' ? <Badge tone="violet"><Cpu size={11} /> AI o'qidi</Badge> : <Badge tone="green"><Bot size={11} /> Parser</Badge>}
                    {u.publishedAs && <Badge tone="green"><Check size={11} /> Menyuda</Badge>}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <Avatar name={u.owner.name || '?'} size={22} />
                    <span className="truncate">{u.owner.name}{u.owner.univ ? ` · ${u.owner.univ}` : ''}</span>
                    <span className="ml-auto shrink-0">{ago(u.createdAt)}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button className="btn-light justify-center !px-2" onClick={() => setPreview(u)}><Eye size={15} /> Ko'rish</button>
                    <button className="btn-light justify-center !px-2 text-rose-600" onClick={() => setDel(u)}><Trash2 size={15} /></button>
                    <button className="btn-green justify-center !px-2" disabled={!!u.publishedAs} onClick={() => setPublish({ u, dir: dirs.includes(u.owner.yonalish) ? u.owner.yonalish : dirs[0], sem: content.data?.activeSemesters?.[0] || '2-semestr', name: u.subject, icon: '📘' })}><Check size={15} /> Menyuga</button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : <Card><Empty icon="📤" text="Hali hech kim test yuklamagan" /></Card>
      ))}

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview ? `${preview.subject} — dastlabki savollar` : ''}>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {preview?.sample.map((s, i) => (
            <div key={i} className="rounded-xl bg-white/70 p-3">
              <p className="text-sm font-medium">{i + 1}. {s.q}</p>
              <ul className="mt-2 space-y-1">
                {s.options.map((o, j) => (
                  <li key={j} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${s.correct === j ? (s.aiGuess ? 'bg-violet-500/15 text-violet-800' : 'bg-emerald-500/15 text-emerald-800') : ''}`}>
                    <span className="w-4 text-xs text-slate-400">{L[j]}</span>{o}
                    {s.correct === j && <span className="ml-auto text-[11px]">{s.aiGuess ? '🤖 AI' : <Check size={14} />}</span>}
                  </li>
                ))}
                {s.correct === null && <li className="text-xs text-amber-700">⚠️ Javob belgilanmagan</li>}
              </ul>
            </div>
          ))}
          {preview && preview.questions > 5 && <p className="text-center text-xs text-slate-500">... va yana {preview.questions - 5} ta savol</p>}
        </div>
      </Modal>

      <Modal
        open={!!publish}
        onClose={() => setPublish(null)}
        title="Bot menyusiga fan sifatida qo'shish"
        footer={<><button className="btn-light" onClick={() => setPublish(null)}>Bekor qilish</button><button className="btn-green" onClick={doPublish}><Check size={15} /> Qo'shish</button></>}
      >
        {publish && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">Javobi bor <b>{publish.u.answered}</b> ta savol shu yo'nalishdagi hamma talabalarga fan sifatida chiqadi.</p>
            <div className="flex gap-2">
              <input className="input !w-16 text-center" value={publish.icon} onChange={(e) => setPublish({ ...publish, icon: e.target.value })} />
              <input className="input" value={publish.name} onChange={(e) => setPublish({ ...publish, name: e.target.value })} />
            </div>
            <select className="input" value={publish.dir} onChange={(e) => setPublish({ ...publish, dir: e.target.value })}>
              {dirs.map((d) => <option key={d}>{d}</option>)}
            </select>
            <select className="input" value={publish.sem} onChange={(e) => setPublish({ ...publish, sem: e.target.value })}>
              {(content.data?.semesters || ['1-semestr', '2-semestr']).map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        )}
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} title="Yuklangan testni o'chirish" footer={<><button className="btn-light" onClick={() => setDel(null)}>Yo'q</button><button className="btn-red" onClick={() => act(() => api(`/uploads/${del.id}`, { method: 'DELETE' }), "🗑 O'chirildi").then((r) => { if (r) { setDel(null); uploads.reload(); } })}>Ha, o'chirish</button></>}>
        <p className="text-sm"><b>{del?.subject}</b> ({del?.owner.name}) testi o'chiriladi. Talabaning "Mening testlarim" ro'yxatidan ham yo'qoladi.</p>
      </Modal>

      {editing && <QuestionEditor report={editing} onClose={() => setEditing(null)} onSaved={() => { closeReport(editing, { notify: true }, null); setEditing(null); }} />}
    </>
  );
}
