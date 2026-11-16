import { useState } from 'react';
import { Plus, Trash2, Building2, GraduationCap, BookOpen, Upload, ChevronRight, CalendarRange, ListChecks, Search, X } from 'lucide-react';
import { Card, CardHeader, PageHeader, Badge, Tabs, Modal, Loading, ErrorBox, Empty, fmt } from '../components/ui.jsx';
import { useAction } from '../components/Layout.jsx';
import { api, useApi, fileToBase64 } from '../data/api.js';

const KURS = ['1-kurs', '2-kurs', '3-kurs', '4-kurs'];

function QuestionsModal({ subject, onClose, onChanged }) {
  const act = useAction();
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('append');
  const [busy, setBusy] = useState(false);
  const { data, loading, reload } = useApi(`/content/subject/${encodeURIComponent(subject.key)}/questions?page=${page}&q=${encodeURIComponent(q)}`);

  const importFile = async (file) => {
    if (!file) return;
    if (file.size > 7 * 1024 * 1024) return act(async () => { throw new Error('Fayl 7 MB dan oshmasin'); });
    setBusy(true);
    const dataBase64 = await fileToBase64(file);
    await act(() => api(`/content/subject/${encodeURIComponent(subject.key)}/import`, { method: 'POST', body: { fileName: file.name, dataBase64, mode } }), (r) => `📥 ${r.imported} ta savol import qilindi (jami ${r.total})`);
    setBusy(false); reload(); onChanged();
  };
  const remove = (i) => act(() => api(`/content/subject/${encodeURIComponent(subject.key)}/questions/${i}`, { method: 'DELETE' }), "🗑 Savol o'chirildi").then(() => { reload(); onChanged(); });

  const pages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;
  return (
    <Modal open onClose={onClose} title={`${subject.icon} ${subject.name} — savollar`}>
      <div className="space-y-3">
        <div className="rounded-xl bg-white/60 p-3">
          <p className="text-sm font-medium">📥 Fayldan import</p>
          <p className="mt-0.5 text-xs text-slate-500">.doc .docx .pdf .xlsx .xls .csv .txt — to'g'ri javob * bilan yoki Excel shablon (Savol | To'g'ri | Xato...)</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Tabs value={mode} onChange={setMode} items={[{ value: 'append', label: "Qo'shish" }, { value: 'replace', label: 'Almashtirish' }]} />
            <label className={`btn-dark cursor-pointer ${busy ? 'pointer-events-none opacity-60' : ''}`}>
              <Upload size={15} /> {busy ? 'Yuklanmoqda...' : 'Fayl tanlash'}
              <input type="file" className="hidden" accept=".doc,.docx,.pdf,.xlsx,.xls,.csv,.tsv,.txt" onChange={(e) => { importFile(e.target.files[0]); e.target.value = ''; }} />
            </label>
          </div>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Savol qidirish..." value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        </div>
        <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
          {loading && !data ? <p className="py-6 text-center text-sm text-slate-500">Yuklanmoqda...</p> : data?.questions.length ? data.questions.map((x) => (
            <div key={x.i} className="group rounded-xl bg-white/70 p-3 text-sm">
              <div className="flex gap-2">
                <p className="flex-1 font-medium">{x.i + 1}. {x.q}</p>
                <button title="O'chirish" className="text-slate-300 hover:text-rose-500" onClick={() => remove(x.i)}><Trash2 size={15} /></button>
              </div>
              <p className="mt-1 text-xs text-emerald-700">✅ {x.a}</p>
              <p className="text-xs text-slate-500">{x.options.filter((o) => o !== x.a).join(' · ')}</p>
            </div>
          )) : <Empty text="Savol yo'q" />}
        </div>
        {data && data.total > 20 && (
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Jami: {fmt(data.total)}</span>
            <div className="flex items-center gap-1">
              <button className="btn-light !px-2.5 !py-1 text-xs disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)}>Oldingi</button>
              <span className="px-2">{page + 1}/{pages}</span>
              <button className="btn-light !px-2.5 !py-1 text-xs disabled:opacity-40" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Keyingi</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Content() {
  const act = useAction();
  const { data, error, loading, reload } = useApi('/content');
  const [univ, setUniv] = useState(null);
  const [dir, setDir] = useState(null);
  const [sem, setSem] = useState(null);
  const [adding, setAdding] = useState(null);
  const [form, setForm] = useState({ name: '', icon: '📘', kurs: '1-kurs' });
  const [questions, setQuestions] = useState(null);
  const [confirm, setConfirm] = useState(null);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;

  const curUniv = univ ?? data.universities[0];
  const kursMap = data.directionsByUniv[curUniv] || {};
  const allDirs = Object.keys(data.subjectsByDirection);
  const curDir = dir ?? (Object.values(kursMap).flat()[0] || allDirs[0]);
  const curSem = sem ?? data.activeSemesters[0] ?? data.semesters[0];
  const subjList = data.subjectsByDirection[curDir]?.[curSem] || [];

  const save = () => {
    const name = form.name.trim(); if (!name) return;
    const call = adding === 'univ' ? api('/content/univ', { method: 'POST', body: { name } })
      : adding === 'dir' ? api('/content/direction', { method: 'POST', body: { univ: curUniv, kurs: form.kurs, name } })
        : api('/content/subject', { method: 'POST', body: { dir: curDir, sem: curSem, name, icon: form.icon } });
    act(() => call, `✅ "${name}" qo'shildi`).then((r) => { if (r) { setAdding(null); setForm({ name: '', icon: '📘', kurs: '1-kurs' }); reload(); } });
  };
  const doDelete = () => {
    const { type, payload, label } = confirm;
    act(() => api(`/content/${type}`, { method: 'DELETE', body: payload }), `🗑 "${label}" o'chirildi`).then((r) => { if (r) { setConfirm(null); reload(); } });
  };
  const toggleSem = (s) => {
    const on = data.activeSemesters.includes(s);
    const next = on ? data.activeSemesters.filter((x) => x !== s) : [...data.activeSemesters, s];
    act(() => api('/content/semesters', { method: 'PUT', body: { activeSemesters: next } }), `${s} ${on ? "o'chirildi" : 'yoqildi'}`).then(reload);
  };

  return (
    <>
      <PageHeader title="Fanlar va savollar" subtitle="Universitet → yo'nalish → semestr → fan. Bot menyusi shu yerdan quriladi." />

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <CalendarRange size={18} className="text-sky-600" />
          <span className="text-sm font-medium">Botda faol semestrlar:</span>
          {data.semesters.map((s) => {
            const on = data.activeSemesters.includes(s);
            return <button key={s} onClick={() => toggleSem(s)} className={`rounded-full px-3 py-1 text-sm font-medium transition ${on ? 'bg-emerald-500 text-white' : 'bg-white/70 text-slate-500'}`}>{on ? '✓ ' : ''}{s}</button>;
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Universitetlar" subtitle={`${data.universities.length} ta`} right={<button className="btn-light !p-1.5" title="Qo'shish" onClick={() => setAdding('univ')}><Plus size={16} /></button>} />
          <ul className="space-y-1 p-3">
            {data.universities.map((u) => (
              <li key={u} className="group flex items-center">
                <button onClick={() => { setUniv(u); setDir(null); }} className={`flex flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${curUniv === u ? 'bg-white/85 font-semibold shadow-sm' : 'hover:bg-white/40'}`}>
                  <Building2 size={16} className="shrink-0 text-sky-600" />
                  <span className="flex-1 truncate">{u}</span>
                  <ChevronRight size={15} className="text-slate-400" />
                </button>
                <button className="ml-1 rounded-lg p-1 text-slate-300 opacity-0 hover:text-rose-500 group-hover:opacity-100" onClick={() => setConfirm({ type: 'univ', payload: { name: u }, label: u })}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Yo'nalishlar" subtitle={curUniv || '—'} right={curUniv && <button className="btn-light !p-1.5" title="Qo'shish" onClick={() => setAdding('dir')}><Plus size={16} /></button>} />
          <div className="space-y-4 p-4">
            {KURS.filter((k) => kursMap[k]?.length).map((kurs) => (
              <div key={kurs}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{kurs}</p>
                <div className="flex flex-wrap gap-1.5">
                  {kursMap[kurs].map((d) => (
                    <span key={d} className={`group inline-flex items-center rounded-full text-sm transition ${curDir === d ? 'bg-slate-900 text-white' : 'bg-white/70 hover:bg-white'}`}>
                      <button className="flex items-center gap-1.5 py-1 pl-3 pr-2" onClick={() => setDir(d)}><GraduationCap size={13} /> {d}</button>
                      <button className="pr-2 opacity-40 hover:opacity-100" title="Olib tashlash" onClick={() => setConfirm({ type: 'direction', payload: { univ: curUniv, kurs, name: d }, label: `${d} (${kurs})` })}><X size={12} /></button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {!Object.values(kursMap).flat().length && <Empty text="Hali yo'nalish yo'q" />}
          </div>
        </Card>

        <Card>
          <CardHeader title="Fanlar" subtitle={curDir || '—'} right={curDir && <button className="btn-light !p-1.5" title="Qo'shish" onClick={() => setAdding('subject')}><Plus size={16} /></button>} />
          <div className="px-4 pt-3"><Tabs value={curSem} onChange={setSem} items={data.semesters.map((s) => ({ value: s, label: s }))} /></div>
          <ul className="space-y-1.5 p-3">
            {subjList.map((s) => (
              <li key={s.key} className="group flex items-center gap-3 rounded-xl bg-white/50 px-3 py-2.5">
                <span className="text-xl">{s.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="truncate text-[11px] text-slate-500">{s.key}</p>
                </div>
                <button onClick={() => setQuestions(s)}><Badge tone={s.questions ? 'blue' : 'amber'}><ListChecks size={11} /> {s.questions ? `${fmt(s.questions)} savol` : "Savol yo'q"}</Badge></button>
                <button onClick={() => setConfirm({ type: 'subject', payload: { dir: curDir, sem: curSem, key: s.key }, label: s.name })} className="rounded-lg p-1 text-slate-300 opacity-0 transition hover:text-rose-500 group-hover:opacity-100"><Trash2 size={15} /></button>
              </li>
            ))}
            {!subjList.length && <li><Empty icon="📚" text="Bu semestrda fan yo'q" /></li>}
          </ul>
        </Card>
      </div>
      <p className="mt-3 text-center text-xs text-white/75"><BookOpen size={12} className="inline" /> Fan ustidagi "savol" belgisini bosib savollarni ko'rish, o'chirish va fayldan import qilish mumkin.</p>

      <Modal
        open={!!adding}
        onClose={() => setAdding(null)}
        title={adding === 'univ' ? "Universitet qo'shish" : adding === 'dir' ? `Yo'nalish qo'shish — ${curUniv}` : `Fan qo'shish — ${curDir}, ${curSem}`}
        footer={<><button className="btn-light" onClick={() => setAdding(null)}>Bekor qilish</button><button className="btn-dark" onClick={save}>Qo'shish</button></>}
      >
        <div className="space-y-3">
          {adding === 'dir' && (
            <>
              <select className="input" value={form.kurs} onChange={(e) => setForm({ ...form, kurs: e.target.value })}>{KURS.map((k) => <option key={k}>{k}</option>)}</select>
              {allDirs.length > 0 && <p className="text-xs text-slate-500">Mavjud yo'nalishlar: {allDirs.join(', ')}</p>}
            </>
          )}
          <div className="flex gap-2">
            {adding === 'subject' && <input className="input !w-16 text-center" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />}
            <input autoFocus className="input" placeholder="Nomi" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} />
          </div>
        </div>
      </Modal>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="O'chirishni tasdiqlang" footer={<><button className="btn-light" onClick={() => setConfirm(null)}>Yo'q</button><button className="btn-red" onClick={doDelete}>Ha, o'chirish</button></>}>
        <p className="text-sm"><b>{confirm?.label}</b> bot menyusidan olib tashlanadi.{confirm?.type === 'subject' && ' Savollar o\'chmaydi — qayta qo\'shsangiz tiklanadi.'}</p>
      </Modal>

      {questions && <QuestionsModal subject={questions} onClose={() => setQuestions(null)} onChanged={reload} />}
    </>
  );
}
