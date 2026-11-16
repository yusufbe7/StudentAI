import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, KeyRound, Server, Send } from 'lucide-react';
import { api, getApiBase, setApiBase, setSession, getSession } from '../data/api.js';

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const params = new URLSearchParams(loc.search);
  const [code, setCode] = useState(params.get('t') || '');
  const [apiUrl, setApiUrl] = useState(params.get('api') || getApiBase());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const tried = useRef(''); // bir martalik kod ikki marta yuborilmasin

  const submit = async (token = code, base = apiUrl) => {
    if (!token.trim()) return;
    setBusy(true); setError('');
    setApiBase(base.trim());
    try {
      const r = await api('/auth', { method: 'POST', body: { token: token.trim() } });
      setSession(r.session, r.admin);
      nav('/', { replace: true });
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  // Havola orqali kelganda (sahifa ochiq bo'lsa ham) kodni avtomatik yuborish
  useEffect(() => {
    const t = params.get('t');
    if (t) {
      if (tried.current === t) return;
      tried.current = t;
      setCode(t);
      if (params.get('api')) setApiUrl(params.get('api'));
      submit(t, params.get('api') || apiUrl);
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

        <ol className="mt-6 space-y-2 rounded-2xl bg-white/60 p-4 text-sm text-slate-700">
          <li className="flex gap-2"><Send size={16} className="mt-0.5 shrink-0 text-sky-600" /> Botga <b>/panel</b> deb yozing</li>
          <li className="flex gap-2"><KeyRound size={16} className="mt-0.5 shrink-0 text-sky-600" /> <span><b>🔐 Panelni ochish</b> tugmasini bosing — avtomatik kirasiz. Yoki kodni pastga kiriting.</span></li>
        </ol>

        <form className="mt-5 space-y-3" onSubmit={(e) => { e.preventDefault(); submit(code, apiUrl); }}>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Kirish kodi</span>
            <input className="input font-mono" placeholder="Botdan kelgan kod" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 flex items-center gap-1 text-slate-600"><Server size={14} /> Bot server manzili</span>
            <input className="input" placeholder="https://....up.railway.app" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
            <span className="mt-1 block text-xs text-slate-500">Botdagi havola orqali kirsangiz avtomatik to'ladi.</span>
          </label>
          {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <button className="btn-dark w-full justify-center" disabled={busy}>{busy ? 'Tekshirilmoqda...' : 'Kirish'}</button>
        </form>
      </motion.div>
    </div>
  );
}
