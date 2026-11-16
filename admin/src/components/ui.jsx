import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, X } from 'lucide-react';

// ─── Formatlash ───────────────────────────────────────────
export const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
export const som = (n) => `${fmt(n)} so'm`;
export const usd = (n) => `$${Number(n || 0).toFixed(n < 10 ? 2 : 0)}`;
export const date = (ts) => new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
export function ago(ts) {
  const diff = Date.now() - ts;
  const m = Math.round(Math.abs(diff) / 60000);
  const future = diff < 0;
  const t = m < 60 ? `${m} daq` : m < 1440 ? `${Math.round(m / 60)} soat` : `${Math.round(m / 1440)} kun`;
  return future ? `${t} dan keyin` : `${t} oldin`;
}

// ─── Kartochka ────────────────────────────────────────────
export function Card({ className = '', children, hover = false, ...rest }) {
  const Comp = hover ? motion.div : 'div';
  const motionProps = hover ? { whileHover: { y: -4 }, transition: { type: 'spring', stiffness: 300, damping: 22 } } : {};
  return (
    <Comp className={`glass rounded-2xl ${className}`} {...motionProps} {...rest}>
      {children}
    </Comp>
  );
}

export function CardHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div>
        <h3 className="text-[15px] font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

// ─── Statistik kartochka (videodagi StatsCard) ────────────
export function StatCard({ title, value, change, hint, icon: Icon, tone = 'sky' }) {
  const tones = {
    sky: 'bg-sky-500/15 text-sky-600',
    violet: 'bg-violet-500/15 text-violet-600',
    emerald: 'bg-emerald-500/15 text-emerald-600',
    amber: 'bg-amber-500/15 text-amber-600',
    rose: 'bg-rose-500/15 text-rose-600',
  };
  const up = change >= 0;
  return (
    <Card hover className="p-5">
      <div className="flex items-center justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon size={18} />
        </span>
        {change !== undefined && (
          <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${up ? 'bg-emerald-500/15 text-emerald-700' : 'bg-rose-500/15 text-rose-700'}`}>
            {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

// ─── Sahifa sarlavhasi ────────────────────────────────────
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-white/80">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ─── Kichik elementlar ────────────────────────────────────
export function Badge({ tone = 'slate', children }) {
  const tones = {
    slate: 'bg-slate-500/10 text-slate-600',
    green: 'bg-emerald-500/15 text-emerald-700',
    red: 'bg-rose-500/15 text-rose-700',
    amber: 'bg-amber-500/20 text-amber-700',
    blue: 'bg-sky-500/15 text-sky-700',
    violet: 'bg-violet-500/15 text-violet-700',
  };
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}
      >
        <motion.span layout className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${checked ? 'right-0.5' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

const AVATAR_COLORS = ['from-sky-400 to-blue-600', 'from-violet-400 to-indigo-600', 'from-emerald-400 to-teal-600', 'from-amber-400 to-orange-500', 'from-rose-400 to-pink-600', 'from-cyan-400 to-sky-600'];
export function Avatar({ name = '?', size = 36 }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const color = AVATAR_COLORS[(name.charCodeAt(0) + name.length) % AVATAR_COLORS.length];
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br ${color} font-semibold text-white`} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </span>
  );
}

export function Tabs({ value, onChange, items }) {
  return (
    <div className="inline-flex rounded-xl bg-white/50 p-1">
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={`relative rounded-lg px-3 py-1.5 text-xs font-medium transition ${value === it.value ? 'text-white' : 'text-slate-600 hover:text-slate-900'}`}
        >
          {value === it.value && <motion.span layoutId={`tab-${items.map((i) => i.value).join()}`} className="absolute inset-0 rounded-lg bg-slate-900" />}
          <span className="relative">{it.label}{it.count !== undefined && <span className="ml-1 opacity-60">{it.count}</span>}</span>
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="glass-strong w-full max-w-lg rounded-2xl"
            initial={{ y: 20, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 20, scale: 0.97 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/60 px-5 py-4">
              <h3 className="font-semibold">{title}</h3>
              <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-white/60"><X size={18} /></button>
            </div>
            <div className="px-5 py-4">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-white/60 px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Oddiy toast — har sahifa amallarini tasdiqlash uchun
export function Toast({ message }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const pageMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25 },
};

// ─── Yuklanish / xatolik holatlari ────────────────────────
export function Loading({ label = 'Yuklanmoqda...' }) {
  return (
    <div className="grid place-items-center py-20 text-white/90">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      <p className="mt-3 text-sm">{label}</p>
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  return (
    <Card className="mx-auto max-w-lg p-6 text-center">
      <p className="text-3xl">⚠️</p>
      <p className="mt-2 font-semibold">Ma'lumotni yuklab bo'lmadi</p>
      <p className="mt-1 text-sm text-slate-600">{error}</p>
      {onRetry && <button className="btn-dark mx-auto mt-4" onClick={onRetry}>Qayta urinish</button>}
    </Card>
  );
}

export function Empty({ icon = '📭', text }) {
  return (
    <div className="grid place-items-center px-6 py-12 text-center text-sm text-slate-500">
      <span className="text-3xl">{icon}</span>
      <p className="mt-2">{text}</p>
    </div>
  );
}
