import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Receipt, CreditCard, Gem, Sparkles, Eraser } from 'lucide-react';
import { Card, CardHeader, PageHeader, Badge, Avatar, Tabs, Modal, som, ago, date } from '../components/ui.jsx';
import { useToast } from '../components/Layout.jsx';
import { payments as initial, users, config } from '../data/mock.js';

// Chek rasmi o'rnida (haqiqiy bot'da Telegram file_id orqali keladi)
function ReceiptPreview({ p }) {
  return (
    <div className="relative h-40 overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-white p-4 text-[11px] text-slate-500 shadow-inner">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-emerald-600">✓ O'tkazma bajarildi</span>
        <span>{new Date(p.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-800">{som(p.amount)}</p>
      <p className="mt-2">Qabul qiluvchi: **** 3577 · M.M</p>
      <p>Jo'natuvchi: {p.name}</p>
      <div className="absolute bottom-3 right-3 rotate-[-8deg] rounded-md border-2 border-emerald-500/60 px-2 py-0.5 font-bold text-emerald-600/70">PAYME</div>
    </div>
  );
}

export default function Payments() {
  const toast = useToast();
  const [list, setList] = useState(initial);
  const [tab, setTab] = useState('pending');
  const [price, setPrice] = useState(config.vipPrice);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("Chek aniq ko'rinmayapti");

  const decide = (p, status) => {
    setList((l) => l.map((x) => (x.id === p.id ? { ...x, status } : x)));
    toast(status === 'approved' ? `✅ ${p.name}: to'lov tasdiqlandi, VIP yoqildi` : `❌ ${p.name}: rad etildi — sabab botga yuborildi`);
  };

  const shown = list.filter((p) => (tab === 'all' ? true : p.status === tab));
  const vipUsers = users.filter((u) => u.isVip).sort((a, b) => a.vipEnd - b.vipEnd);

  return (
    <>
      <PageHeader title="VIP va to'lovlar" subtitle="Cheklarni tasdiqlash, VIP narxi va faol obunalar" />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: 'pending', label: 'Kutilmoqda', count: list.filter((p) => p.status === 'pending').length },
              { value: 'approved', label: 'Tasdiqlangan' },
              { value: 'rejected', label: 'Rad etilgan' },
              { value: 'all', label: 'Barchasi' },
            ]}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {shown.map((p) => (
                <motion.div key={p.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                  <Card hover className="p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <Avatar name={p.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="text-xs text-slate-500">@{p.username} · {ago(p.createdAt)}</p>
                      </div>
                      <Badge tone={p.plan.startsWith('VIP') ? 'amber' : 'violet'}>{p.plan}</Badge>
                    </div>
                    <ReceiptPreview p={p} />
                    {p.status === 'pending' ? (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button className="btn-light justify-center text-rose-600" onClick={() => setRejecting(p)}><X size={16} /> Rad etish</button>
                        <button className="btn-green justify-center" onClick={() => decide(p, 'approved')}><Check size={16} /> Tasdiqlash</button>
                      </div>
                    ) : (
                      <div className="mt-3 flex justify-between text-sm">
                        <span className="text-slate-500">{som(p.amount)}</span>
                        {p.status === 'approved' ? <Badge tone="green">Tasdiqlangan</Badge> : <Badge tone="red">Rad etilgan</Badge>}
                      </div>
                    )}
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {shown.length === 0 && (
            <Card className="grid place-items-center p-12 text-center">
              <Receipt className="text-slate-400" />
              <p className="mt-2 text-sm text-slate-500">Bu bo'limda to'lov yo'q</p>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-2"><CreditCard size={18} className="text-sky-600" /><h3 className="font-semibold">VIP narxi</h3></div>
            <p className="mt-1 text-xs text-slate-500">Botdagi "💰 VIP narxini o'zgartirish" o'rnida</p>
            <div className="mt-3 flex gap-2">
              <input type="number" className="input" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
              <button className="btn-dark shrink-0" onClick={() => toast(`VIP narxi: ${som(price)}`)}>Saqlash</button>
            </div>
            <div className="mt-4 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 p-4 text-white">
              <p className="text-xs text-white/60">To'lov kartasi</p>
              <p className="mt-1 font-mono tracking-widest">4073 4200 5836 3577</p>
              <p className="mt-2 text-xs text-white/60">Egasi: M.M</p>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Faol VIP'lar"
              subtitle={`${vipUsers.length} ta obuna`}
              right={<button className="btn-light !py-1.5 text-xs" onClick={() => toast("Muddati o'tgan VIP'lar tozalandi")}><Eraser size={14} /> Tozalash</button>}
            />
            <ul className="max-h-96 space-y-1 overflow-y-auto px-2 pb-3 pt-3">
              {vipUsers.map((u) => {
                const left = Math.max(0, Math.ceil((u.vipEnd - Date.now()) / 86400000));
                return (
                  <li key={u.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/40">
                    <Avatar name={u.name} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-slate-500">{date(u.vipEnd)} gacha</p>
                    </div>
                    <Badge tone={left <= 3 ? 'red' : left <= 10 ? 'amber' : 'green'}>{left} kun</Badge>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2"><Sparkles size={18} className="text-violet-600" /><h3 className="font-semibold">Keyingi bosqich</h3></div>
            <p className="mt-1 text-sm text-slate-600">Click / Payme integratsiyasi ulanganda cheklar avtomatik tasdiqlanadi.</p>
          </Card>
        </div>
      </div>

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="To'lovni rad etish"
        footer={<><button className="btn-light" onClick={() => setRejecting(null)}>Bekor qilish</button><button className="btn-red" onClick={() => { decide(rejecting, 'rejected'); setRejecting(null); }}>Rad etish</button></>}
      >
        <p className="mb-2 text-sm text-slate-600">Sabab foydalanuvchiga bot orqali yuboriladi:</p>
        <textarea className="input min-h-24" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["Chek aniq ko'rinmayapti", "Summa noto'g'ri", 'Chek takroriy', "To'lov topilmadi"].map((r) => (
            <button key={r} className="rounded-full bg-white/70 px-2.5 py-1 text-xs hover:bg-white" onClick={() => setReason(r)}>{r}</button>
          ))}
        </div>
      </Modal>
    </>
  );
}
