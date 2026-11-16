import { useState } from 'react';
import { Plus, Trash2, ShieldCheck, Link2, ExternalLink, Radio } from 'lucide-react';
import { Card, PageHeader, Badge, Modal, fmt } from '../components/ui.jsx';
import { useToast } from '../components/Layout.jsx';
import { channels as initial } from '../data/mock.js';

export default function Channels() {
  const toast = useToast();
  const [list, setList] = useState(initial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', link: '', type: 'verify' });
  const [confirm, setConfirm] = useState(null);

  const add = () => {
    if (!form.id || !form.name) return;
    setList((l) => [...l, { ...form, members: 0 }]);
    toast(`📡 "${form.name}" qo'shildi`);
    setOpen(false);
    setForm({ id: '', name: '', link: '', type: 'verify' });
  };

  return (
    <>
      <PageHeader
        title="Majburiy kanallar"
        subtitle="Botdan foydalanishdan oldin obuna bo'lish kerak bo'lgan kanallar"
        actions={<button className="btn-dark" onClick={() => setOpen(true)}><Plus size={16} /> Kanal qo'shish</button>}
      />

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="flex items-start gap-3 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600"><ShieldCheck size={18} /></span>
          <div><p className="font-semibold">Majburiy (tekshiriladi)</p><p className="text-sm text-slate-600">Bot obunani tekshiradi. Bot kanalda admin bo'lishi shart.</p></div>
        </Card>
        <Card className="flex items-start gap-3 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-600"><Link2 size={18} /></span>
          <div><p className="font-semibold">Majburiy emas (faqat link)</p><p className="text-sm text-slate-600">Bir marta ko'rsatiladi. Yangi kanal qo'shilsa, qayta so'raladi.</p></div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <Card hover key={c.id} className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white"><Radio size={20} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="truncate text-xs text-slate-500">{c.id}</p>
              </div>
              {c.type === 'verify' ? <Badge tone="green">Tekshiriladi</Badge> : <Badge tone="blue">Faqat link</Badge>}
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-slate-600"><b>{fmt(c.members)}</b> obunachi</span>
              <div className="flex gap-1">
                <a href={c.link} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-slate-500 hover:bg-white/80"><ExternalLink size={16} /></a>
                <button onClick={() => setConfirm(c)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/80 hover:text-rose-500"><Trash2 size={16} /></button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Kanal qo'shish" footer={<><button className="btn-light" onClick={() => setOpen(false)}>Bekor qilish</button><button className="btn-dark" onClick={add}>Qo'shish</button></>}>
        <div className="space-y-3">
          <input className="input" placeholder="@kanal_username yoki -100... ID" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
          <input className="input" placeholder="Ko'rinadigan nomi" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="https://t.me/..." value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            {[{ v: 'verify', l: '✅ Tekshiriladi' }, { v: 'link', l: '🔗 Faqat link' }].map((o) => (
              <button key={o.v} onClick={() => setForm({ ...form, type: o.v })} className={`rounded-xl border px-3 py-2 text-sm ${form.type === o.v ? 'border-sky-500 bg-white' : 'border-white/80 bg-white/50'}`}>{o.l}</button>
            ))}
          </div>
        </div>
      </Modal>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Kanalni o'chirish" footer={<><button className="btn-light" onClick={() => setConfirm(null)}>Yo'q</button><button className="btn-red" onClick={() => { setList((l) => l.filter((x) => x.id !== confirm.id)); toast("Kanal o'chirildi"); setConfirm(null); }}>Ha, o'chirish</button></>}>
        <p className="text-sm"><b>{confirm?.name}</b> majburiy kanallar ro'yxatidan o'chirilsinmi?</p>
      </Modal>
    </>
  );
}
