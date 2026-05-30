import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { connectSocket, disconnectSocket } from '../socket/socket';

const AuthContext = createContext(null);
const USER_KEY = '@studentai/user';
const BIO_KEY = '@studentai/biometric_enabled';
const CRED_KEY = '@studentai/saved_cred'; // biometrik kirish uchun

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { username, name, photo, isVip, vipEnd }
  const [loading, setLoading] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  // Saqlangan sessiyani yuklash
  useEffect(() => {
    (async () => {
      try {
        const [rawUser, rawBio] = await Promise.all([
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(BIO_KEY),
        ]);
        if (rawBio === '1') setBiometricEnabled(true);
        if (rawUser) {
          const u = JSON.parse(rawUser);
          setUser(u);
          if (u?.name) connectSocket(u.name);
          // Fonda yangilash
          refreshUser(u.username).catch(() => {});
        }
      } catch {}
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback(async (u) => {
    setUser(u);
    try {
      if (u) await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
      else await AsyncStorage.removeItem(USER_KEY);
    } catch {}
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api.login(username, password);
    const u = res.user;
    // VIP statusni qo'shimcha olish
    let vip = {};
    try {
      vip = await api.myVip({ username: u.username, name: u.name });
    } catch {}
    const full = { ...u, isVip: !!vip.isVip, vipEnd: vip.vipEnd || null };
    await persist(full);
    if (full.name) connectSocket(full.name);
    // Biometrik kirish uchun parolni saqlash (faqat agar yoqilgan bo'lsa keyin ishlatiladi)
    try {
      await AsyncStorage.setItem(CRED_KEY, JSON.stringify({ username, password }));
    } catch {}
    return full;
  }, [persist]);

  const register = useCallback(async (username, name, password) => {
    await api.register(username, name, password);
    return login(username, password);
  }, [login]);

  const refreshUser = useCallback(async (username) => {
    const uname = username || user?.username;
    if (!uname) return null;
    try {
      const res = await api.me(uname);
      const u = res.user;
      const merged = { ...(user || {}), ...u };
      await persist(merged);
      return merged;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, persist]);

  const logout = useCallback(async () => {
    disconnectSocket();
    await persist(null);
    try {
      await AsyncStorage.removeItem(CRED_KEY);
    } catch {}
  }, [persist]);

  const setBiometric = useCallback(async (enabled) => {
    setBiometricEnabled(enabled);
    try {
      await AsyncStorage.setItem(BIO_KEY, enabled ? '1' : '0');
    } catch {}
  }, []);

  const getSavedCred = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CRED_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
        updateLocalUser: persist,
        biometricEnabled,
        setBiometric,
        getSavedCred,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
