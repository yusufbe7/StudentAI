import { useState, createContext, useContext, useCallback, useRef } from 'react';
import { NavLink, useLocation, useNavigate, Outlet, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Wallet, Users, Gem, Megaphone, ShieldCheck, BookOpen, Trophy,
  Radio, ScrollText, Settings, Search, Bot, Menu, X, GraduationCap, LogOut, RefreshCw,
} from 'lucide-react';
import { Avatar, Toast, usd } from './ui.jsx';
import { useApi, getSession, getAdmin, clearSession, api } from '../data/api.js';

const NAV = (c = {}) => [
  { group: 'Asosiy', items: [
    { to: '/', label: "Umumiy ko'rinish", icon: LayoutDashboard },
    { to: '/finance', label: 'Moliya va AI', icon: Wallet },
  ] },
  { group: 'Foydalanuvchilar', items: [
    { to: '/users', label: 'Foydalanuvchilar', icon: Users },
    { to: '/payments', label: "VIP va to'lovlar", icon: Gem, badge: c.pendingPayments },
    { to: '/broadcast', label: 'Xabar tarqatish', icon: Megaphone },
  ] },
  { group: 'Kontent', items: [
    { to: '/moderation', label: 'Moderatsiya', icon: ShieldCheck, badge: c.openReports },
    { to: '/content', label: 'Fanlar va savollar', icon: BookOpen },
    { to: '/tournament', label: 'Musobaqalar', icon: Trophy },
  ] },
  { group: 'Tizim', items: [
    { to: '/channels', label: 'Majburiy kanallar', icon: Radio },
    { to: '/activity', label: 'Faoliyat logi', icon: ScrollText },
    { to: '/settings', label: 'Sozlamalar', icon: Settings },
  ] },
];

// Toast va umumiy hisoblagichlar (badge) — barcha sahifalar uchun
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
const CountsCtx = createContext({ reload: () => {} });
export const useCounts = () => useContext(CountsCtx);

// Amal bajarish: muvaffaqiyat/xatolik toast'i bilan
export function useAction() {
  const toast = useToast();
  const counts = useCounts();
  return useCallback(async (fn, okMsg) => {
    try {
      const r = await fn();
      if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg);
      counts.reload?.();
      return r;
    } catch (e) {
      toast(`❌ ${e.message}`);
      return null;
    }
  }, [toast, counts]);
}

function Sidebar({ counts, onNavigate }) {
  const aiPct = counts.aiBudget ? Math.min(100, Math.round((counts.aiCostMonth / counts.aiBudget) * 100)) : null;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-3 pb-6 pt-1">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-700 text-white shadow-lg">
          <GraduationCap size={20} />
        </span>
        <div>
          <p className="text-sm font-bold text-slate-900">StudentAI Admin</p>
          <p className="text-xs text-slate-500">Boshqaruv paneli</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto pr-1">
        {NAV(counts).map((g) => (
          <div key={g.group}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500/80">{g.group}</p>
            <ul className="space-y-0.5">
              {g.items.map(({ to, label, icon: Icon, badge }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${isActive ? 'font-semibold text-slate-900' : 'text-slate-600 hover:bg-white/40 hover:text-slate-900'}`}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-white/80 shadow-sm" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                        <Icon size={17} className="relative" />
                        <span className="relative flex-1">{label}</span>
                        {badge > 0 && <span className="relative rounded-full bg-sky-500 px-1.5 text-[11px] font-semibold text-white">{badge}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-4 rounded-xl bg-white/60 p-3">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-sky-600" />
          <p className="text-xs font-semibold text-slate-800">Bot holati</p>
          <span className={`ml-auto h-2 w-2 rounded-full ${counts.isMaintenance ? 'bg-rose-500' : 'bg-emerald-500'}`} />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {counts.loaded ? `${counts.isMaintenance ? "To'xtatilgan" : 'Ishlayapti'} · ${counts.isPaidMode ? 'Pullik' : 'Bepul'} rejim` : '...'}
        </p>
        {aiPct !== null && (
          <>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/80">
              <div className={`h-full rounded-full ${aiPct > 85 ? 'bg-rose-500' : 'bg-gradient-to-r from-sky-400 to-blue-600'}`} style={{ width: `${aiPct}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">AI budjet: {usd(counts.aiCostMonth)} / {usd(counts.aiBudget)} (oy)</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [q, setQ] = useState('');
  const toastTimer = useRef();
  const dash = useApi(getSession() ? '/dashboard' : null, { refreshMs: 60000 });
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  if (!getSession()) return <Navigate to="/login" replace />;
  const admin = getAdmin() || { name: 'Admin' };
  const counts = { ...(dash.data || {}), loaded: !!dash.data, reload: dash.reload };

  const logout = async () => {
    await api('/logout', { method: 'POST' }).catch(() => {});
    clearSession();
    navigate('/login');
  };

  return (
    <ToastCtx.Provider value={showToast}>
      <CountsCtx.Provider value={counts}>
        <div className="flex min-h-full gap-5 p-3 sm:p-5">
          <aside className="glass sticky top-5 hidden h-[calc(100vh-2.5rem)] w-64 shrink-0 rounded-2xl p-4 lg:block">
            <Sidebar counts={counts} />
          </aside>

          <AnimatePresence>
            {mobileOpen && (
              <motion.div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)}>
                <motion.aside className="glass-strong h-full w-72 rounded-r-2xl p-4" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} onClick={(e) => e.stopPropagation()}>
                  <button className="absolute right-3 top-3 rounded-lg p-1 text-slate-500" onClick={() => setMobileOpen(false)}><X size={18} /></button>
                  <Sidebar counts={counts} onNavigate={() => setMobileOpen(false)} />
                </motion.aside>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="min-w-0 flex-1">
            <header className="glass mb-6 flex items-center gap-3 rounded-2xl px-3 py-2.5 sm:px-4">
              <button className="rounded-lg p-1.5 text-slate-600 hover:bg-white/60 lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
              <form className="relative max-w-xl flex-1" onSubmit={(e) => { e.preventDefault(); navigate(`/users?q=${encodeURIComponent(q)}`); }}>
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-9" placeholder="Foydalanuvchi ismi, ID yoki @username..." value={q} onChange={(e) => setQ(e.target.value)} />
              </form>
              <div className="ml-auto flex items-center gap-2">
                <button title="Yangilash" className="rounded-xl bg-white/60 p-2 text-slate-600 hover:bg-white" onClick={() => { dash.reload(); window.dispatchEvent(new Event('panel:refresh')); }}><RefreshCw size={18} /></button>
                <div className="hidden items-center gap-2 rounded-xl bg-white/60 py-1 pl-1 pr-3 sm:flex">
                  <Avatar name={admin.name || 'Admin'} size={30} />
                  <div className="leading-tight">
                    <p className="text-sm font-semibold">{admin.name || 'Admin'}</p>
                    <p className="text-[11px] text-slate-500">Admin</p>
                  </div>
                </div>
                <button title="Chiqish" className="rounded-xl bg-white/60 p-2 text-slate-600 hover:bg-white hover:text-rose-600" onClick={logout}><LogOut size={18} /></button>
              </div>
            </header>

            <motion.main key={location.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
              <Outlet />
            </motion.main>
          </div>
        </div>
        <Toast message={toast} />
      </CountsCtx.Provider>
    </ToastCtx.Provider>
  );
}
