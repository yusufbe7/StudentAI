import AsyncStorage from '@react-native-async-storage/async-storage';

// Offline cache yordamchilari
export async function cacheSet(key, value) {
  try {
    await AsyncStorage.setItem('@cache/' + key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {}
}

export async function cacheGet(key, maxAgeMs = Infinity) {
  try {
    const raw = await AsyncStorage.getItem('@cache/' + key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (Date.now() - t > maxAgeMs) return null;
    return v;
  } catch {
    return null;
  }
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Subject key -> emoji
const ICONS = {
  dasturlash: '💡', dinshunoslik: '🕌', falsafa: '💭', fizika: '⚡', hisob: '🔢',
  malumotlar: '🗄️', english: '🌐', tarix: '📜', matematika: '➗', math: '➗',
  moliya: '💰', huquq: '⚖️', tibbiyot: '🩺', kimyo: '🧪', biologiya: '🧬',
};
export function subjectIcon(key = '', title = '') {
  const s = (key + ' ' + title).toLowerCase();
  for (const [k, v] of Object.entries(ICONS)) if (s.includes(k)) return v;
  return '📚';
}
