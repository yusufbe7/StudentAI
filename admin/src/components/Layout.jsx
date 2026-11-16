import { useState, createContext, useContext, useCallback } from 'react';
import { NavLink, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Wallet, Users, Gem, Megaphone, ShieldCheck, BookOpen, Trophy,
  Radio, ScrollText, Settings, Search, Bell, Bot, Menu, X, GraduationCap,
} from 'lucide-react';
import { Avatar, Toast } from './ui.jsx';
import { payments, uploads, reports, botSettings } from '../data/mock.js';

const pendingPayments = payments.filter((p) => p.status === 'pending').length;
const pendingModeration = uploads.filter((u) => u.status === 'pending').length + reports.length;

const NAV = [
  { group: 'Asosiy', items: [
    { to: '/', label: "Umumiy ko'rinish", icon: LayoutDashboard },
    { to: '/finance', label: 'Moliya va AI', icon: Wallet },
  ] },
  { group: 'Foydalanuvchilar', items: [
    { to: '/users', label: 'Foydalanuvchilar', icon: Users },
    { to: '/payments', label: "VIP va to'lovlar", icon: Gem, badge: pendingPayments },
    { to: '/broadcast', label: 'Xabar tarqatish', icon: Megaphone },
  ] },
  { group: 'Kontent', items: [
    { to: '/moderation', label: 'Moderatsiya', icon: ShieldCheck, badge: pendingModeration },
    { to: '/content', label: 'Fanlar va savollar', icon: BookOpen },
    { to: '/tournament', label: 'Musobaqalar', icon: Trophy },
  ] },
  { group: 'Tizim', items: [
    { to: '/channels', label: 'Majburiy kanallar', icon: Radio },
    { to: '/activity', label: 'Faoliyat logi', icon: ScrollText },
    { to: '/settings', label: 'Sozlamalar', icon: Settings },
  ] },
];

// Butun panel uchun toast
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

function Sidebar({ onNavigate }) {
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
        {NAV.map((g) => (
          <div key={g.group}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500/80">{g.group}</p>
            <ul className="space-y-0.5">
              {g.items.map(({ to, label, icon: Icon, badge }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                        isActive ? 'font-semibold text-slate-900' : 'text-slate-600 hover:bg-white/40 hover:text-slate-900'
                      }`
                    }
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

      {/* Bot holati (videodagi "Business plan" bloki o'rnida) */}
      <div className="mt-4 rounded-xl bg-white/60 p-3">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-sky-600" />
          <p className="text-xs font-semibold text-slate-800">Bot holati</p>
          <span className={`ml-auto h-2 w-2 rounded-full ${botSettings.isMaintenance ? 'bg-rose-500' : 'bg-emerald-500'} shadow-[0_0_0_3px_rgba(16,185,129,.2)]`} />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {botSettings.isMaintenance ? "To'xtatilgan" : 'Ishlayapti'} · {botSettings.isPaidMode ? 'Pullik' : 'Bepul'} rejim
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/80">
          <div className="h-full w-[57%] rounded-full bg-gradient-to-r from-sky-400 to-blue-600" />
        </div>
        <p className="mt-1 text-[11px] text-slate-500">AI budjet: $85 / $150 (oy)</p>
      </div>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(window.__toastT);
    window.__toastT = setTimeout(() => setToast(null), 2200);
  }, []);

  return (
    <ToastCtx.Provider value={showToast}>
      <div className="flex min-h-full gap-5 p-3 sm:p-5">
        {/* Desktop sidebar */}
        <aside className="glass sticky top-5 hidden h-[calc(100vh-2.5rem)] w-64 shrink-0 rounded-2xl p-4 lg:block">
          <Sidebar />
        </aside>

        {/* Mobil sidebar */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)}>
              <motion.aside
                className="glass-strong h-full w-72 rounded-r-2xl p-4"
                initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button className="absolute right-3 top-3 rounded-lg p-1 text-slate-500" onClick={() => setMobileOpen(false)}><X size={18} /></button>
                <Sidebar onNavigate={() => setMobileOpen(false)} />
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="min-w-0 flex-1">
          {/* Topbar */}
          <header className="glass mb-6 flex items-center gap-3 rounded-2xl px-3 py-2.5 sm:px-4">
            <button className="rounded-lg p-1.5 text-slate-600 hover:bg-white/60 lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
            <div className="relative flex-1 max-w-xl">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Foydalanuvchi, ID, fan yoki fayl qidirish..." />
              <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md bg-white/80 px-1.5 text-[11px] text-slate-500 sm:block">⌘K</kbd>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button className="relative rounded-xl bg-white/60 p-2 text-slate-600 hover:bg-white">
                <Bell size={18} />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
              </button>
              <div className="hidden items-center gap-2 rounded-xl bg-white/60 py-1 pl-1 pr-3 sm:flex">
                <Avatar name="Yusuf Admin" size={30} />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">Yusuf</p>
                  <p className="text-[11px] text-slate-500">Bosh admin</p>
                </div>
              </div>
            </div>
          </header>

          {/* Har sahifaga kirishda yengil animatsiya (exit animatsiyasi orqaga qaytishda sahifani yashirib qo'yardi) */}
          <motion.main key={location.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
            <Outlet />
          </motion.main>
        </div>
      </div>
      <Toast message={toast} />
    </ToastCtx.Provider>
  );
}
