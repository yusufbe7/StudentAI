import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme } from '../theme/colors';

const ThemeContext = createContext(null);
const STORAGE_KEY = '@studentai/theme'; // 'dark' | 'light' | 'system'

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [pref, setPref] = useState('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) setPref(saved);
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const effectiveMode = pref === 'system' ? (systemScheme || 'dark') : pref;
  const isDark = effectiveMode === 'dark';
  const colors = isDark ? darkTheme : lightTheme;

  const setTheme = useCallback(async (next) => {
    setPref(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark, setTheme]);

  return (
    <ThemeContext.Provider value={{ colors, isDark, pref, effectiveMode, setTheme, toggleTheme, loaded }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export default ThemeContext;
