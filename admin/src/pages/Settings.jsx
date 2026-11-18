import { useEffect, useState } from 'react';
import { Power, Timer, Cpu, Gift, Save, RotateCcw, Trash2, AlertTriangle, ShieldAlert, Trophy, Users, DatabaseBackup } from 'lucide-react';
import { Card, PageHeader, Toggle, Modal, Loading, ErrorBox, usd } from '../components/ui.jsx';
import { useAction } from '../components/Layout.jsx';
import { api, useApi } from '../data/api.js';

const MODELS = [
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5 — eng arzon ($0.10 / $0.50)' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5 — muvozanat ($2 / $10)' },
  { id: 'claude-opus-5-5', label: 'Opus 5.5 — eng aqlli ($4 / $20)' },
];
const AI_TASKS = [
  { key: 'extract', label: "Tartibsiz fayldan savol ajratish" },
  { key: 'solve', label: 'Javobsiz savollarga javob topish' },
  { key: 'explain', label: '"💡 Tushuntirish"' },
];
const LIMITS = [
  { key: 'freeUploads', label: 'Bepul fayl yuklash (VIP emaslar)' },
  { key: 'freeAiExtractChars', label: "Bepul AI o'qish chegarasi (belgi)" },
  { key: 'freeExplainDaily', label: 'Bepul tushuntirish / kun' },
  { key: 'vipExplainDaily', label: 'VIP tushuntirish / kun' },
  { key: 'freeSolveMax', label: 'Bepul AI javob (savolgacha)' },
  { key: 'maxFileMb', label: 'Fayl hajmi chegarasi (MB)' },
];
const DANGER = {
  'clear-rating': { title: 'Reytingni tozalash', text: "Barcha foydalanuvchilar (bot va web) bali va statistikasi 0 ga tushiriladi. Qaytarib bo'lmaydi.", icon: RotateCcw },
  'clear-expired-vip': { title: "Muddati o'tgan VIP'larni tozalash", text: "Muddati tugagan VIP obunalar o'chiriladi. Faol VIP'larga ta'sir qilmaydi.", icon: Trash2 },
  'reset-tournament-scores': { title: 'Musobaqa ballarini tozalash', text: 'Barcha foydalanuvchilarning musobaqa bali va "yakunladi" belgisi tozalanadi.', icon: Trophy },
};

// Eski server (Railway) ma'lumotlarini birlashtirish
function ImportCard() {
  const act = useAction();
  const { data, reload } = useApi('/import');
  const [confirm, setConfirm] = useState(false);
  const [report, setReport] = useState(null);
  if (!data) return null;
  return (
    <Card className="p-5 xl:col-span-2">
      <div className="mb-2 flex items-center gap-2"><DatabaseBackup size={18} className="text-sky-600" /><h3 className="font-semibold">Railway'dan foydalanuvchilarni ko'chirish</h3></div>
      {!data.available ? (
        <p className="text-sm text-slate-600">{data.reason}</p>
      ) : !data.ready ? (
        <div className="space-y-1 text-sm text-slate-600">
          <p>Railway ma'lumotlari hali yuklanmagan. Railway'da servisga ikkita o'zgaruvchi qo'shing va qayta deploy qiling:</p>
          <p><code className="rounded bg-white/70 px-1">SYNC_DATABASE_URL</code> = Neon manzili (Render'dagi bilan bir xil), <code className="rounded bg-white/70 px-1">SYNC_MODE</code> = <code className="rounded bg-white/70 px-1">export</code></p>
          <button className="btn-light mt-2" onClick={reload}>Qayta tekshirish</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid flex-1 grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div className="rounded-xl bg-white/70 p-2"><p className="text-lg font-bold">{data.oldUsers}</p><p className="text-[11px] text-slate-500">Railway'da</p></div>
            <div className="rounded-xl bg-white/70 p-2"><p className="text-lg font-bold text-emerald-600">+{data.newUsers}</p><p className="text-[11px] text-slate-500">Yangi qo'shiladi</p></div>
            <div className="rounded-xl bg-white/70 p-2"><p className="text-lg font-bold">{data.bothUsers}</p><p className="text-[11px] text-slate-500">Birlashtiriladi</p></div>
            <div className="rounded-xl bg-white/70 p-2"><p className="text-lg font-bold">{data.currentUsers}</p><p className="text-[11px] text-slate-500">Hozir botda</p></div>
          </div>
          <button className="btn-dark" onClick={() => setConfirm(true)}><DatabaseBackup size={16} /> Birlashtirish</button>
        </div>
      )}
      {report && <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-800">✅ +{report.usersAdded} yangi, {report.usersMerged} birlashtirildi. Jami: {report.usersTotal} ta foydalanuvchi.</p>}
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Railway ma'lumotlarini birlashtirish"
        footer={<><button className="btn-light" onClick={() => setConfirm(false)}>Bekor qilish</button><button className="btn-dark" onClick={() => act(() => api('/import/merge', { method: 'POST' }), '✅ Birlashtirildi').then((r) => { setConfirm(false); if (r) { setReport(r.report); reload(); } })}>Tasdiqlayman</button></>}>
        <p className="text-sm">Hech kim o'chirilmaydi. Ikkala joyda ham bor talabalarda ball va testlar — kattasi, VIP — uzoqrog'i saqlanadi. Qayta bosilsa takrorlanmaydi.</p>
      </Modal>
    </Card>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center gap-2"><Icon size={18} className="text-sky-600" /><h3 className="font-semibold">{title}</h3></div>
      <div className="divide-y divide-white/70">{children}</div>
    </Card>
  );
}

export default function SettingsPage() {
  const act = useAction();
  const { data, error, loading, reload } = useApi('/settings');
  const [s, setS] = useState(null);
  const [danger, setDanger] = useState(null);
  useEffect(() => { if (data) setS(JSON.parse(JSON.stringify(data))); }, [data]);

  if ((loading && !data) || (data && !s)) return <Loading />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;

  // Rejim tugmalari darhol saqlanadi
  const toggle = (patch, msg) => { setS({ ...s, ...patch }); act(() => api('/settings', { method: 'PUT', body: patch }), msg).then(reload); };
  const saveAll = () => act(() => api('/settings', { method: 'PUT', body: { timeLimit: s.timeLimit, ai: { models: s.ai.models, limits: s.ai.limits, monthlyBudgetUsd: s.ai.monthlyBudgetUsd } } }), '💾 Sozlamalar saqlandi').then(reload);
  const setAi = (patch) => setS({ ...s, ai: { ...s.ai, ...patch } });

  return (
    <>
      <PageHeader title="Sozlamalar" subtitle="Bot rejimlari, test vaqti, AI modellari va limitlari" actions={<button className="btn-dark" onClick={saveAll}><Save size={16} /> Saqlash</button>} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Section icon={Power} title="Bot rejimi (darhol kuchga kiradi)">
          <Toggle label="Bot ishlayapti" hint="O'chirilsa, foydalanuvchilarga texnik ishlar xabari chiqadi" checked={!s.isMaintenance} onChange={(v) => toggle({ isMaintenance: !v }, v ? '🟢 Bot yoqildi' : "🔴 Bot to'xtatildi")} />
          <Toggle label="Pullik rejim" hint="Yoqilsa, faqat VIP foydalanuvchilar test ishlay oladi" checked={s.isPaidMode} onChange={(v) => toggle({ isPaidMode: v }, v ? '💰 Pullik rejim' : '🆓 Bepul rejim')} />
          <Toggle label="Turbo rejim" hint="Fanlar menyusida 🚀 Turbo yodlash tugmasi chiqadi" checked={s.turboMode} onChange={(v) => toggle({ turboMode: v }, v ? '🚀 Turbo yoqildi' : "Turbo o'chirildi")} />
        </Section>

        <Section icon={Timer} title="Test sozlamalari">
          <div className="py-3">
            <div className="flex items-center justify-between text-sm"><span className="font-medium">Bir savolga vaqt</span><span className="font-semibold text-sky-700">{s.timeLimit} s</span></div>
            <input type="range" min={10} max={120} step={5} value={s.timeLimit} onChange={(e) => setS({ ...s, timeLimit: Number(e.target.value) })} className="mt-2 w-full accent-sky-600" />
            <div className="flex justify-between text-[11px] text-slate-500"><span>10 s</span><span>120 s</span></div>
          </div>
          <div className="flex items-start gap-2 py-3 text-sm text-slate-600">
            <Users size={16} className="mt-0.5 shrink-0" />
            <span>Panel adminlari (Telegram ID): <b>{s.admins.join(', ')}</b>. Qo'shish uchun serverda <code className="rounded bg-white/70 px-1">ADMIN_IDS</code> ni o'rnating.</span>
          </div>
        </Section>

        <Section icon={Cpu} title="AI modellari (Anthropic)">
          {!s.ai.enabled && <p className="py-3 text-sm text-amber-700">⚠️ AI o'chiq: serverda ANTHROPIC_API_KEY yo'q. Sozlamalar kalit qo'shilgach ishlaydi.</p>}
          {AI_TASKS.map((t) => (
            <div key={t.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium">{t.label}</span>
              <select className="input sm:!w-72" value={s.ai.models[t.key]} onChange={(e) => setAi({ models: { ...s.ai.models, [t.key]: e.target.value } })}>
                {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm"><span className="font-medium">Oylik AI budjet ($)</span><span className="block text-xs text-slate-500">0 — cheksiz. Shu oy: {usd(s.ai.costMonth)}</span></span>
            <input type="number" min={0} className="input !w-28" value={s.ai.monthlyBudgetUsd} onChange={(e) => setAi({ monthlyBudgetUsd: Number(e.target.value) })} />
          </div>
          <p className="pt-3 text-xs text-slate-500">Narxlar 1 million token uchun (kirish / chiqish). Budjet tugasa AI funksiyalari keyingi oygacha to'xtaydi.</p>
        </Section>

        <Section icon={Gift} title="AI limitlari">
          <div className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-2">
            {LIMITS.map((l) => (
              <label key={l.key} className="text-sm">
                <span className="mb-1 block text-slate-600">{l.label}</span>
                <input type="number" min={0} className="input" value={s.ai.limits[l.key]} onChange={(e) => setAi({ limits: { ...s.ai.limits, [l.key]: Number(e.target.value) } })} />
              </label>
            ))}
          </div>
        </Section>

        <ImportCard />

        <Card className="border-rose-300/70 p-5 xl:col-span-2">
          <div className="mb-3 flex items-center gap-2"><ShieldAlert size={18} className="text-rose-600" /><h3 className="font-semibold text-rose-700">Xavfli amallar</h3></div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {Object.entries(DANGER).map(([k, v]) => {
              const I = v.icon;
              return <button key={k} className="btn-light justify-center text-rose-600" onClick={() => setDanger(k)}><I size={15} /> {v.title}</button>;
            })}
          </div>
        </Card>
      </div>

      <Modal
        open={!!danger}
        onClose={() => setDanger(null)}
        title={DANGER[danger]?.title}
        footer={<><button className="btn-light" onClick={() => setDanger(null)}>Bekor qilish</button><button className="btn-red" onClick={() => act(() => api(`/danger/${danger}`, { method: 'POST' }), (r) => `✅ ${r.message}`).then(() => setDanger(null))}>Tasdiqlayman</button></>}
      >
        <div className="flex gap-3"><AlertTriangle className="shrink-0 text-rose-500" /><p className="text-sm">{DANGER[danger]?.text}</p></div>
      </Modal>
    </>
  );
}
