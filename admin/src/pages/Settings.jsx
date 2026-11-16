import { useState } from 'react';
import { Power, Zap, Timer, Cpu, Gift, Save, RotateCcw, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Card, PageHeader, Toggle, Modal, som } from '../components/ui.jsx';
import { useToast } from '../components/Layout.jsx';
import { botSettings } from '../data/mock.js';

const MODELS = [
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5 — eng arzon, tez' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5 — muvozanat' },
  { id: 'claude-opus-5-5', label: 'Opus 5.5 — eng aqlli, qimmat' },
];
const AI_TASKS = [
  { key: 'parse', label: "Fayl o'qish (parser ishlamasa)" },
  { key: 'explain', label: '"Nega?" tushuntirish' },
  { key: 'referat', label: 'Referat' },
  { key: 'slides', label: 'Slayd' },
];

function Section({ icon: Icon, title, children }) {
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center gap-2"><Icon size={18} className="text-sky-600" /><h3 className="font-semibold">{title}</h3></div>
      <div className="divide-y divide-white/70">{children}</div>
    </Card>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const [s, setS] = useState(botSettings);
  const [danger, setDanger] = useState(null);
  const set = (patch, msg) => { setS((x) => ({ ...x, ...patch })); if (msg) toast(msg); };

  return (
    <>
      <PageHeader
        title="Sozlamalar"
        subtitle="Bot rejimlari, AI limitlari va xavfli amallar"
        actions={<button className="btn-dark" onClick={() => toast('💾 Sozlamalar saqlandi')}><Save size={16} /> Saqlash</button>}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Section icon={Power} title="Bot rejimi">
          <Toggle label="Bot ishlayapti" hint="O'chirilsa, hamma uchun texnik ishlar xabari chiqadi" checked={!s.isMaintenance} onChange={(v) => set({ isMaintenance: !v }, v ? '🟢 Bot yoqildi' : "🔴 Bot to'xtatildi")} />
          <Toggle label="Pullik rejim" hint="Yoqilsa, faqat VIP foydalanuvchilar test ishlay oladi" checked={s.isPaidMode} onChange={(v) => set({ isPaidMode: v }, v ? '💰 Pullik rejim' : '🆓 Bepul rejim')} />
          <Toggle label="Turbo rejim" hint="Savollar taymersiz, javobdan keyin darhol keyingisi" checked={s.turboMode} onChange={(v) => set({ turboMode: v }, v ? '🚀 Turbo yoqildi' : "Turbo o'chirildi")} />
        </Section>

        <Section icon={Timer} title="Test sozlamalari">
          <div className="py-3">
            <div className="flex items-center justify-between text-sm"><span className="font-medium">Savol vaqti</span><span className="font-semibold text-sky-700">{s.timeLimit} s</span></div>
            <input type="range" min={10} max={120} step={5} value={s.timeLimit} onChange={(e) => set({ timeLimit: Number(e.target.value) })} className="mt-2 w-full accent-sky-600" />
            <div className="flex justify-between text-[11px] text-slate-500"><span>10 s</span><span>120 s</span></div>
          </div>
        </Section>

        <Section icon={Gift} title="Bepul limitlar (AI)">
          <div className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-2">
            <label className="text-sm"><span className="mb-1 block text-slate-600">Bepul fayl yuklash</span><input type="number" className="input" value={s.freeUploads} onChange={(e) => set({ freeUploads: Number(e.target.value) })} /></label>
            <label className="text-sm"><span className="mb-1 block text-slate-600">Bepul faylda max savol</span><input type="number" className="input" value={s.freeUploadMaxQuestions} onChange={(e) => set({ freeUploadMaxQuestions: Number(e.target.value) })} /></label>
            <label className="text-sm"><span className="mb-1 block text-slate-600">Kunlik AI so'rov (oddiy)</span><input type="number" className="input" value={s.dailyAiLimitFree} onChange={(e) => set({ dailyAiLimitFree: Number(e.target.value) })} /></label>
            <label className="text-sm"><span className="mb-1 block text-slate-600">Kunlik AI so'rov (VIP)</span><input type="number" className="input" value={s.dailyAiLimitVip} onChange={(e) => set({ dailyAiLimitVip: Number(e.target.value) })} /></label>
          </div>
        </Section>

        <Section icon={Cpu} title="AI modellari (Anthropic)">
          {AI_TASKS.map((t) => (
            <div key={t.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium">{t.label}</span>
              <select className="input sm:!w-64" value={s.models[t.key]} onChange={(e) => set({ models: { ...s.models, [t.key]: e.target.value } })}>
                {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm font-medium">Oylik AI budjet ($)</span>
            <input type="number" className="input !w-28" value={s.monthlyAiBudgetUsd} onChange={(e) => set({ monthlyAiBudgetUsd: Number(e.target.value) })} />
          </div>
          <p className="pt-3 text-xs text-slate-500">Budjetning 90% i sarflansa, AI funksiyalari faqat VIP uchun qoladi va sizga bot orqali ogohlantirish keladi.</p>
        </Section>

        <Card className="border-rose-300/70 p-5 xl:col-span-2">
          <div className="mb-3 flex items-center gap-2"><ShieldAlert size={18} className="text-rose-600" /><h3 className="font-semibold text-rose-700">Xavfli amallar</h3></div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <button className="btn-light justify-center text-rose-600" onClick={() => setDanger({ title: 'Reytingni tozalash', text: "Barcha foydalanuvchilar bali 0 ga tushiriladi. Bu amalni qaytarib bo'lmaydi.", icon: RotateCcw })}><RotateCcw size={15} /> Reytingni tozalash</button>
            <button className="btn-light justify-center text-rose-600" onClick={() => setDanger({ title: "Muddati o'tgan VIP'larni tozalash", text: "Muddati tugagan barcha VIP obunalar o'chiriladi.", icon: Trash2 })}><Trash2 size={15} /> VIP'larni tozalash</button>
            <button className="btn-light justify-center text-rose-600" onClick={() => setDanger({ title: 'Botni to\'liq restart', text: 'Sessiyalar, musobaqa va vaqtinchalik holatlar tozalanadi.', icon: Power })}><Power size={15} /> To'liq restart</button>
          </div>
        </Card>
      </div>

      <Modal
        open={!!danger}
        onClose={() => setDanger(null)}
        title={danger?.title}
        footer={<><button className="btn-light" onClick={() => setDanger(null)}>Bekor qilish</button><button className="btn-red" onClick={() => { toast(`✅ ${danger.title} bajarildi`); setDanger(null); }}>Tasdiqlayman</button></>}
      >
        <div className="flex gap-3">
          <AlertTriangle className="shrink-0 text-rose-500" />
          <p className="text-sm">{danger?.text}</p>
        </div>
      </Modal>
      <p className="mt-4 text-center text-xs text-white/70">VIP narxi: {som(10000)} — "VIP va to'lovlar" sahifasida o'zgartiriladi. <Zap size={11} className="inline" /></p>
    </>
  );
}
