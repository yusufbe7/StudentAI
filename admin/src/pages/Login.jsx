import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, User, Lock, Eye, EyeOff, Server, Send, ChevronDown } from 'lucide-react';
import { api, getApiBase, setApiBase, setSession, getSession } from '../data/api.js';

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const params = new URLSearchParams(loc.search);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState(params.get('t') || '');
  const [apiUrl, setApiUrl] = useState(params.get('api') || getApiBase());
  const [mode, setMode] = useState(params.get('t') ? 'code' : 'password');
  const [showServer, setShowServer] = useState(!getApiBase());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const tried = useRef('');

  const finish = (r) => { setSession(r.session, r.admin); nav('/', { replace: true }); };

  const loginPassword = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password) return setError('Login va parolni kiriting');
    setBusy(true); setError('');
    setApiBase(apiUrl.trim());
    try { finish(await api('/login', { method: 'POST', body: { username: username.trim(), password } })); }
    catch (err) { setError(err.message); if (err.status === 0) setShowServer(true); }
    finally { setBusy(false); }
  };

  const loginCode = async (token = code, base = apiUrl) => {
    if (!token.trim()) return setError('Kodni kiriting');
    setBusy(true); setError('');
    setApiBase(base.trim());
    try { finish(await api('/auth', { method: 'POST', body: { token: token.trim() } })); }
    catch (err) { setError(err.message); if (err.status === 0) setShowServer(true); }
    finally { setBusy(false); }
  };

  // Botdagi /panel havolasi orqali kelganda — avtomatik kirish
  useEffect(() => {
    const t = params.get('t');
    if (t) {
      if (tried.current === t) return;
      tried.current = t;
      setMode('code'); setCode(t);
      if (params.get('api')) setApiUrl(params.get('api'));
      loginCode(t, params.get('api') || apiUrl);
    } else if (getSession()) nav('/', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.search]);

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-strong w-full max-w-md rounded-3xl p-7">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-700 text-white shadow-lg"><GraduationCap size={24} /></span>
          <div>
            <h1 className="text-xl font-bold">StudentAI Admin</h1>
            <p className="text-sm text-slate-500">Boshqaruv paneliga kirish</p>
          </div>
        </div>

        {mode === 'password' ? (
          <form className="mt-6 space-y-3" onSubmit={loginPassword}>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Login</span>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-9" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Parol</span>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input px-9" type={showPw ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" onClick={() => setShowPw(!showPw)} aria-label="Parolni ko'rsatish">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </label>
            {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <button className="btn-dark w-full justify-center" disabled={busy}>{busy ? 'Tekshirilmoqda...' : 'Kirish'}</button>
            <button type="button" className="flex w-full items-center justify-center gap-2 pt-1 text-sm text-slate-500 hover:text-slate-800" onClick={() => { setMode('code'); setError(''); }}>
              <Send size={14} /> Telegram kodi bilan kirish
            </button>
          </form>
        ) : (
          <form className="mt-6 space-y-3" onSubmit={(e) => { e.preventDefault(); loginCode(); }}>
            <p className="rounded-2xl bg-white/60 p-3 text-sm text-slate-700">Botga <b>/panel</b> deb yozing va <b>🔐 Panelni ochish</b> tugmasini bosing yoki kelgan kodni kiriting.</p>
            <input className="input font-mono" placeholder="Botdan kelgan kod" value={code} onChange={(e) => setCode(e.target.value)} />
            {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <button className="btn-dark w-full justify-center" disabled={busy}>{busy ? 'Tekshirilmoqda...' : 'Kirish'}</button>
            <button type="button" className="flex w-full items-center justify-center gap-2 pt-1 text-sm text-slate-500 hover:text-slate-800" onClick={() => { setMode('password'); setError(''); }}>
              <Lock size={14} /> Login va parol bilan kirish
            </button>
          </form>
        )}

        <div className="mt-5 border-t border-white/70 pt-3">
          <button type="button" className="flex w-full items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700" onClick={() => setShowServer(!showServer)}>
            <Server size={13} /> Bot server manzili <ChevronDown size={13} className={`ml-auto transition ${showServer ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showServer && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <input className="input mt-2" placeholder="https://....up.railway.app" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
                <p className="mt-1 text-xs text-slate-500">Railway'dagi bot manzili. Vercel'da VITE_API_URL o'rnatilsa, bu maydon kerak bo'lmaydi.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
