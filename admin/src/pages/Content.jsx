import { useState } from 'react';
import { Plus, Trash2, Building2, GraduationCap, BookOpen, Upload, ChevronRight, CalendarRange } from 'lucide-react';
import { Card, CardHeader, PageHeader, Badge, Tabs, Modal, fmt } from '../components/ui.jsx';
import { useToast } from '../components/Layout.jsx';
import { config, UNIVERSITIES } from '../data/mock.js';

export default function Content() {
  const toast = useToast();
  const [univs, setUnivs] = useState(UNIVERSITIES);
  const [univ, setUniv] = useState(UNIVERSITIES[0]);
  const [dirs, setDirs] = useState(config.directionsByUniv);
  const [subjects, setSubjects] = useState(config.subjectsByDirection);
  const [dir, setDir] = useState('Dasturiy Injiniring');
  const [sem, setSem] = useState('2-semestr');
  const [active, setActive] = useState(config.activeSemesters);
  const [adding, setAdding] = useState(null); // 'univ' | 'dir' | 'subject'
  const [form, setForm] = useState({ name: '', icon: '📘', kurs: '1-kurs' });

  const kursMap = dirs[univ] || {};
  const subjList = subjects[dir]?.[sem] || [];

  const save = () => {
    if (!form.name.trim()) return;
    if (adding === 'univ') { setUnivs((l) => [...l, form.name]); setDirs((d) => ({ ...d, [form.name]: {} })); }
    if (adding === 'dir') setDirs((d) => ({ ...d, [univ]: { ...d[univ], [form.kurs]: [...(d[univ]?.[form.kurs] || []), form.name] } }));
    if (adding === 'subject') {
      const key = `${dir}_${form.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      setSubjects((s) => ({ ...s, [dir]: { ...(s[dir] || {}), [sem]: [...(s[dir]?.[sem] || []), { name: form.name, icon: form.icon, key, questions: 0 }] } }));
    }
    toast(`✅ "${form.name}" qo'shildi`);
    setAdding(null);
    setForm({ name: '', icon: '📘', kurs: '1-kurs' });
  };

  const removeSubject = (s) => {
    setSubjects((all) => ({ ...all, [dir]: { ...all[dir], [sem]: all[dir][sem].filter((x) => x.key !== s.key) } }));
    toast(`🗑 "${s.name}" o'chirildi`);
  };

  return (
    <>
      <PageHeader
        title="Fanlar va savollar"
        subtitle="Universitet → yo'nalish → semestr → fan. Bot menyusi shu yerdan quriladi."
        actions={<button className="btn-dark"><Upload size={16} /> Savollarni import (Excel)</button>}
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <CalendarRange size={18} className="text-sky-600" />
          <span className="text-sm font-medium">Botda faol semestrlar:</span>
          {config.semesters.map((s) => {
            const on = active.includes(s);
            return (
              <button
                key={s}
                onClick={() => { setActive((a) => (on ? a.filter((x) => x !== s) : [...a, s])); toast(`${s} ${on ? "o'chirildi" : 'yoqildi'}`); }}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${on ? 'bg-emerald-500 text-white' : 'bg-white/70 text-slate-500'}`}
              >
                {on ? '✓ ' : ''}{s}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Universitetlar */}
        <Card>
          <CardHeader title="Universitetlar" subtitle={`${univs.length} ta`} right={<button className="btn-light !p-1.5" onClick={() => setAdding('univ')}><Plus size={16} /></button>} />
          <ul className="space-y-1 p-3">
            {univs.map((u) => (
              <li key={u}>
                <button onClick={() => setUniv(u)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${univ === u ? 'bg-white/85 font-semibold shadow-sm' : 'hover:bg-white/40'}`}>
                  <Building2 size={16} className="shrink-0 text-sky-600" />
                  <span className="flex-1 truncate">{u}</span>
                  <ChevronRight size={15} className="text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {/* Yo'nalishlar */}
        <Card>
          <CardHeader title="Yo'nalishlar" subtitle={univ} right={<button className="btn-light !p-1.5" onClick={() => setAdding('dir')}><Plus size={16} /></button>} />
          <div className="space-y-4 p-4">
            {Object.entries(kursMap).map(([kurs, list]) => (
              <div key={kurs}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{kurs}</p>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((d) => (
                    <button key={d} onClick={() => setDir(d)} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition ${dir === d ? 'bg-slate-900 text-white' : 'bg-white/70 hover:bg-white'}`}>
                      <GraduationCap size={13} /> {d}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(kursMap).length === 0 && <p className="text-sm text-slate-500">Hali yo'nalish yo'q</p>}
          </div>
        </Card>

        {/* Fanlar */}
        <Card>
          <CardHeader title="Fanlar" subtitle={dir} right={<button className="btn-light !p-1.5" onClick={() => setAdding('subject')}><Plus size={16} /></button>} />
          <div className="px-4 pt-3"><Tabs value={sem} onChange={setSem} items={config.semesters.map((s) => ({ value: s, label: s }))} /></div>
          <ul className="space-y-1.5 p-3">
            {subjList.map((s) => (
              <li key={s.key} className="group flex items-center gap-3 rounded-xl bg-white/50 px-3 py-2.5">
                <span className="text-xl">{s.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="truncate text-[11px] text-slate-500">{s.key}</p>
                </div>
                <Badge tone={s.questions ? 'blue' : 'amber'}>{s.questions ? `${fmt(s.questions)} savol` : "Savol yo'q"}</Badge>
                <button onClick={() => removeSubject(s)} className="rounded-lg p-1 text-slate-400 opacity-0 transition hover:text-rose-500 group-hover:opacity-100"><Trash2 size={15} /></button>
              </li>
            ))}
            {subjList.length === 0 && (
              <li className="grid place-items-center rounded-xl border border-dashed border-white/80 p-8 text-center text-sm text-slate-500">
                <BookOpen size={20} className="mb-1" /> Bu semestrda fan yo'q
              </li>
            )}
          </ul>
        </Card>
      </div>

      <Modal
        open={!!adding}
        onClose={() => setAdding(null)}
        title={adding === 'univ' ? "Universitet qo'shish" : adding === 'dir' ? `Yo'nalish qo'shish — ${univ}` : `Fan qo'shish — ${dir}, ${sem}`}
        footer={<><button className="btn-light" onClick={() => setAdding(null)}>Bekor qilish</button><button className="btn-dark" onClick={save}>Qo'shish</button></>}
      >
        <div className="space-y-3">
          {adding === 'dir' && (
            <select className="input" value={form.kurs} onChange={(e) => setForm({ ...form, kurs: e.target.value })}>
              {['1-kurs', '2-kurs', '3-kurs', '4-kurs'].map((k) => <option key={k}>{k}</option>)}
            </select>
          )}
          <div className="flex gap-2">
            {adding === 'subject' && <input className="input !w-16 text-center" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />}
            <input autoFocus className="input" placeholder="Nomi" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} />
          </div>
        </div>
      </Modal>
    </>
  );
}
