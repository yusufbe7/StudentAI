import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, CreditCard, Eraser, ImageOff, ZoomIn } from 'lucide-react';
import { Card, CardHeader, PageHeader, Badge, Avatar, Tabs, Modal, Loading, ErrorBox, Empty, som, ago, date } from '../components/ui.jsx';
import { useAction } from '../components/Layout.jsx';
import { api, apiBlobUrl, useApi } from '../data/api.js';

function Receipt({ id, onZoom }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url;
    apiBlobUrl(`/payments/${id}/receipt`).then((u) => { url = u; setSrc(u); }).catch(() => setFailed(true));
    return () => url && URL.revokeObjectURL(url);
  }, [id]);
  if (failed) return <div className="grid h-44 place-items-center rounded-xl bg-white/50 text-sm text-slate-500"><ImageOff /> Rasm yuklanmadi</div>;
  if (!src) return <div className="h-44 animate-pulse rounded-xl bg-white/50" />;
  return (
    <button className="group relative block h-44 w-full overflow-hidden rounded-xl bg-white" onClick={() => onZoom(src)}>
      <img src={src} alt="Chek" className="h-full w-full object-cover object-top" />
      <span className="absolute inset-0 grid place-items-center bg-slate-900/0 text-white opacity-0 transition group-hover:bg-slate-900/30 group-hover:opacity-100"><ZoomIn /></span>
    </button>
  );
}

const REASONS = ["Chek aniq ko'rinmayapti", "Summa noto'g'ri", 'Chek takroriy', "To'lov topilmadi"];

export default function Payments() {
  const act = useAction();
  const [tab, setTab] = useState('pending');
  const { data, error, loading, reload } = useApi(`/payments?status=${tab}`, { refreshMs: 30000 });
  const [price, setPrice] = useState('');
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [fake, setFake] = useState(false);
  const [zoom, setZoom] = useState(null);

  useEffect(() => { if (data && price === '') setPrice(String(data.vipPrice)); }, [data]); // eslint-disable-line

  const decide = (p, approve) => act(
    () => api(`/payments/${p.id}/decide`, { method: 'POST', body: approve ? { approve: true } : { approve: false, reason, fake } }),
    approve ? `✅ ${p.name}: tasdiqlandi, VIP yoqildi` : `❌ ${p.name}: rad etildi, sabab yuborildi`,
  ).then((r) => { if (r) { setRejecting(null); reload(); } });

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;

  return (
    <>
      <PageHeader title="VIP va to'lovlar" subtitle="Botga yuborilgan cheklar — tasdiqlansa VIP avtomatik yoqiladi va foydalanuvchiga xabar boradi" />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: 'pending', label: 'Kutilmoqda', count: data.counts.pending },
              { value: 'approved', label: 'Tasdiqlangan', count: data.counts.approved },
              { value: 'rejected', label: 'Rad etilgan', count: data.counts.rejected },
              { value: 'all', label: 'Barchasi', count: data.counts.all },
            ]}
          />
          {data.payments.length ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {data.payments.map((p) => (
                  <motion.div key={p.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                    <Card className="p-4">
                      <div className="mb-3 flex items-center gap-3">
                        <Avatar name={p.name || '?'} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{p.name || p.userId}</p>
                          <p className="truncate text-xs text-slate-500">{p.username ? `@${p.username} · ` : ''}ID {p.userId} · {ago(p.createdAt)}</p>
                        </div>
                        <span className="text-sm font-bold">{som(p.amount)}</span>
                      </div>
                      {p.fileId ? <Receipt id={p.id} onZoom={setZoom} /> : <div className="grid h-20 place-items-center rounded-xl bg-white/50 text-sm text-slate-500">Rasm yo'q</div>}
                      {p.status === 'pending' ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button className="btn-light justify-center text-rose-600" onClick={() => { setRejecting(p); setReason(REASONS[0]); setFake(false); }}><X size={16} /> Rad etish</button>
                          <button className="btn-green justify-center" onClick={() => decide(p, true)}><Check size={16} /> Tasdiqlash</button>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                          <span className="truncate text-slate-500">{p.reason || p.plan}</span>
                          {p.status === 'approved' ? <Badge tone="green">Tasdiqlangan</Badge> : <Badge tone="red">Rad etilgan</Badge>}
                        </div>
                      )}
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : <Card><Empty icon="🧾" text={tab === 'pending' ? "Kutilayotgan to'lov yo'q" : "Bu bo'limda to'lov yo'q"} /></Card>}
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-2"><CreditCard size={18} className="text-sky-600" /><h3 className="font-semibold">VIP narxi</h3></div>
            <p className="mt-1 text-xs text-slate-500">Botdagi "💎 VIP sotib olish" xabarida ko'rinadi</p>
            <div className="mt-3 flex gap-2">
              <input type="number" className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
              <button className="btn-dark shrink-0" onClick={() => act(() => api('/vip-price', { method: 'POST', body: { price: Number(price) } }), `VIP narxi: ${som(price)}`)}>Saqlash</button>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Faol VIP'lar"
              subtitle={`${data.vips.length} ta obuna`}
              right={<button className="btn-light !py-1.5 text-xs" onClick={() => act(() => api('/danger/clear-expired-vip', { method: 'POST' }), (r) => r.message).then(reload)}><Eraser size={14} /> Muddati o'tganlar</button>}
            />
            {data.vips.length ? (
              <ul className="max-h-96 space-y-1 overflow-y-auto px-2 pb-3 pt-3">
                {data.vips.map((u) => {
                  const left = u.vipEnd ? Math.max(0, Math.ceil((u.vipEnd - Date.now()) / 86400000)) : null;
                  return (
                    <li key={u.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/40">
                      <Avatar name={u.name || '?'} size={30} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{u.name || u.id}</p>
                        <p className="text-xs text-slate-500">{u.vipEnd ? `${date(u.vipEnd)} gacha` : 'Muddatsiz'}</p>
                      </div>
                      {left !== null && <Badge tone={left <= 3 ? 'red' : left <= 10 ? 'amber' : 'green'}>{left} kun</Badge>}
                    </li>
                  );
                })}
              </ul>
            ) : <Empty icon="💎" text="Faol VIP yo'q" />}
          </Card>
        </div>
      </div>

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="To'lovni rad etish"
        footer={<><button className="btn-light" onClick={() => setRejecting(null)}>Bekor qilish</button><button className="btn-red" onClick={() => decide(rejecting, false)}>Rad etish</button></>}
      >
        <p className="mb-2 text-sm text-slate-600">Sabab foydalanuvchiga bot orqali yuboriladi:</p>
        <textarea className="input min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {REASONS.map((r) => <button key={r} className="rounded-full bg-white/70 px-2.5 py-1 text-xs hover:bg-white" onClick={() => setReason(r)}>{r}</button>)}
        </div>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-rose-600" checked={fake} onChange={(e) => setFake(e.target.checked)} />
          <span>Soxta chek deb belgilash <span className="block text-xs text-slate-500">3 ta soxta chekdan keyin foydalanuvchi avtomatik bloklanadi</span></span>
        </label>
      </Modal>

      <Modal open={!!zoom} onClose={() => setZoom(null)} title="Chek">
        {zoom && <img src={zoom} alt="Chek" className="max-h-[70vh] w-full rounded-xl object-contain" />}
      </Modal>
    </>
  );
}
