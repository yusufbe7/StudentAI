import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, FileText, FileSpreadsheet, Image as ImageIcon, Bot, Cpu, AlertTriangle, Eye, Flag, Languages } from 'lucide-react';
import { Card, CardHeader, PageHeader, Badge, Avatar, Tabs, Modal, ago } from '../components/ui.jsx';
import { useToast } from '../components/Layout.jsx';
import { uploads as initialUploads, reports as initialReports } from '../data/mock.js';

const fileIcon = (f) => (f.endsWith('.xlsx') ? FileSpreadsheet : /\.(jpg|png)$/.test(f) ? ImageIcon : FileText);

// Faylning namunaviy savollari (prototip uchun)
const SAMPLE = [
  { q: 'Статья УПК РУз регламентирующая осмотр места происшествия', options: ['135', '137', '139', '141', '155'], correct: 1 },
  { q: 'Откуда берется кровь для определения наличия алкоголя:', options: ['Из периферических сосудов', 'Из полости сердца', 'Из синусов твердой мозговой оболочки', 'Из бедренной вены', 'Из печени'], correct: 0 },
  { q: 'При автомобильной травме отпечаток протектора шин колес является:', options: ['специфическим повреждением', 'характерным повреждением', 'неспецифическим', 'случайным', 'смешанным'], correct: null, ai: 0 },
];

export default function Moderation() {
  const toast = useToast();
  const [uploads, setUploads] = useState(initialUploads);
  const [reports, setReports] = useState(initialReports);
  const [tab, setTab] = useState('files');
  const [preview, setPreview] = useState(null);

  const decide = (u, ok) => {
    setUploads((l) => l.filter((x) => x.id !== u.id));
    setPreview(null);
    toast(ok ? `✅ "${u.title}" katalogga qo'shildi` : `❌ "${u.title}" rad etildi`);
  };
  const closeReport = (r, fixed) => {
    setReports((l) => l.filter((x) => x.id !== r.id));
    toast(fixed ? '✏️ Savol tuzatildi, shikoyatchiga xabar yuborildi' : 'Shikoyat yopildi');
  };

  return (
    <>
      <PageHeader
        title="Moderatsiya"
        subtitle="Talabalar yuklagan test fayllari va savollardagi xatolar haqidagi shikoyatlar"
        actions={<Tabs value={tab} onChange={setTab} items={[{ value: 'files', label: 'Fayllar', count: uploads.length }, { value: 'reports', label: 'Shikoyatlar', count: reports.length }]} />}
      />

      {tab === 'files' && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {uploads.map((u) => {
              const Icon = fileIcon(u.file);
              return (
                <motion.div key={u.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}>
                  <Card hover className="overflow-hidden">
                    <div className={`relative h-32 bg-gradient-to-br ${u.color} p-4 text-white`}>
                      <Icon size={28} className="opacity-90" />
                      <p className="mt-2 text-lg font-bold leading-tight">{u.title}</p>
                      <p className="text-xs text-white/80">{u.file}</p>
                      <span className="absolute right-3 top-3 rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-medium backdrop-blur">{u.lang === 'ru' ? 'RU' : 'UZ'}</span>
                    </div>
                    <div className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone="blue">{u.questions} savol</Badge>
                        <Badge>{u.options} variant</Badge>
                        {u.missingAnswers > 0 ? <Badge tone="amber"><AlertTriangle size={11} /> {u.missingAnswers} javobsiz</Badge> : <Badge tone="green">Javoblar to'liq</Badge>}
                        {u.parsedBy === 'ai' ? <Badge tone="violet"><Cpu size={11} /> AI o'qidi</Badge> : <Badge tone="green"><Bot size={11} /> Parser</Badge>}
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                        <Avatar name={u.by} size={22} />
                        <span className="truncate">{u.by} · {u.univ}</span>
                        <span className="ml-auto shrink-0">{ago(u.createdAt)}</span>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <button className="btn-light justify-center !px-2" onClick={() => setPreview(u)}><Eye size={15} /> Ko'rish</button>
                        <button className="btn-light justify-center !px-2 text-rose-600" onClick={() => decide(u, false)}><X size={15} /> Rad</button>
                        <button className="btn-green justify-center !px-2" onClick={() => decide(u, true)}><Check size={15} /> Qabul</button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {uploads.length === 0 && <Card className="p-12 text-center text-sm text-slate-500 md:col-span-2">🎉 Navbat bo'sh</Card>}
        </div>
      )}

      {tab === 'reports' && (
        <Card>
          <CardHeader title="Savollardagi xatolar" subtitle='Botdagi "⚠️ Xato bor" tugmasi orqali kelgan shikoyatlar' />
          <ul className="space-y-2 p-3">
            <AnimatePresence>
              {reports.map((r) => (
                <motion.li key={r.id} layout exit={{ opacity: 0, x: 40 }} className="flex flex-col gap-3 rounded-xl bg-white/50 p-4 md:flex-row md:items-center">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-500/15 text-rose-600"><Flag size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.question}</p>
                    <p className="mt-0.5 text-xs text-slate-500"><Badge tone="blue">{r.subject}</Badge> <span className="ml-1">"{r.reason}" — {r.by}, {ago(r.createdAt)}</span></p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button className="btn-light" onClick={() => closeReport(r, false)}>Yopish</button>
                    <button className="btn-dark" onClick={() => closeReport(r, true)}>Tahrirlash</button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
            {reports.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Shikoyat yo'q</p>}
          </ul>
        </Card>
      )}

      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview ? `${preview.title} — namunaviy savollar` : ''}
        footer={preview && (
          <>
            <button className="btn-light"><Languages size={15} /> O'zbekchaga tarjima</button>
            <button className="btn-light text-rose-600" onClick={() => decide(preview, false)}>Rad etish</button>
            <button className="btn-green" onClick={() => decide(preview, true)}><Check size={15} /> Qabul qilish</button>
          </>
        )}
      >
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {SAMPLE.map((s, i) => (
            <div key={i} className="rounded-xl bg-white/70 p-3">
              <p className="text-sm font-medium">{i + 1}. {s.q}</p>
              <ul className="mt-2 space-y-1">
                {s.options.map((o, j) => {
                  const correct = s.correct === j;
                  const aiGuess = s.correct === null && s.ai === j;
                  return (
                    <li key={j} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${correct ? 'bg-emerald-500/15 text-emerald-800' : aiGuess ? 'bg-violet-500/15 text-violet-800' : ''}`}>
                      <span className="w-4 text-xs text-slate-400">{'ABCDE'[j]}</span>{o}
                      {correct && <Check size={14} className="ml-auto" />}
                      {aiGuess && <span className="ml-auto text-[11px]">🤖 AI taxmini — tekshiring</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <p className="text-center text-xs text-slate-500">... va yana {preview ? preview.questions - SAMPLE.length : 0} ta savol</p>
        </div>
      </Modal>
    </>
  );
}
