// ============================================================
// Admin panel → bot serveri (/api/panel/*)
// Server manzili: login havolasidagi ?api=... (localStorage'da saqlanadi)
// yoki build vaqtida VITE_API_URL, yoki shu domen (Express /admin).
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';

const SESSION_KEY = 'sa_admin_session';
const API_KEY = 'sa_admin_api';
const ADMIN_KEY = 'sa_admin_me';

const safe = (fn, d = null) => { try { return fn(); } catch { return d; } };

export const getApiBase = () => (safe(() => localStorage.getItem(API_KEY)) || import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const setApiBase = (url) => safe(() => (url ? localStorage.setItem(API_KEY, url.replace(/\/$/, '')) : localStorage.removeItem(API_KEY)));
export const getSession = () => safe(() => localStorage.getItem(SESSION_KEY));
export const getAdmin = () => safe(() => JSON.parse(localStorage.getItem(ADMIN_KEY) || 'null'));
export function setSession(session, admin) {
  safe(() => { localStorage.setItem(SESSION_KEY, session); localStorage.setItem(ADMIN_KEY, JSON.stringify(admin || null)); });
}
export function clearSession() {
  safe(() => { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(ADMIN_KEY); });
}

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function api(path, { method = 'GET', body } = {}) {
  const token = getSession();
  let res;
  try {
    res = await fetch(`${getApiBase()}/api/panel${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Serverga ulanib bo'lmadi. Internet yoki server manzilini tekshiring.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth') {
    clearSession();
    if (!location.hash.startsWith('#/login')) location.hash = '#/login';
  }
  if (!res.ok) throw new ApiError(data.error || `Xatolik (${res.status})`, res.status);
  return data;
}

export async function apiBlobUrl(path) {
  const res = await fetch(`${getApiBase()}/api/panel${path}`, { headers: { Authorization: `Bearer ${getSession()}` } });
  if (!res.ok) throw new ApiError('Rasm yuklanmadi', res.status);
  return URL.createObjectURL(await res.blob());
}

// Ma'lumot yuklash hook'i: { data, error, loading, reload }
export function useApi(path, { refreshMs } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const alive = useRef(true);
  const load = useCallback(async (silent) => {
    if (!path) return;
    if (!silent) setState((s) => ({ ...s, loading: true }));
    try {
      const data = await api(path);
      if (alive.current) setState({ data, error: null, loading: false });
    } catch (e) {
      if (alive.current) setState((s) => ({ ...s, error: e.message, loading: false }));
    }
  }, [path]);
  useEffect(() => {
    alive.current = true;
    load();
    const t = refreshMs ? setInterval(() => load(true), refreshMs) : null;
    const onRefresh = () => load(true); // yuqoridagi 🔄 tugmasi
    window.addEventListener('panel:refresh', onRefresh);
    return () => { alive.current = false; if (t) clearInterval(t); window.removeEventListener('panel:refresh', onRefresh); };
  }, [load, refreshMs]);
  return { ...state, reload: () => load(true) };
}

// Faylni base64 ga o'qish (savollar importi)
export const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = reject;
  r.readAsDataURL(file);
});
