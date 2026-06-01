import Constants from 'expo-constants';

// ============================================================
// API server manzili.
// 1. app.json -> expo.extra.apiBaseUrl ni o'zgartiring, YOKI
// 2. shu yerdagi DEFAULT_BASE_URL ni o'zgartiring.
// Lokal serverda sinash uchun kompyuteringiz IP manzilini yozing,
// masalan: http://192.168.1.10:3000  (localhost emas — telefon ko'rmaydi)
// ============================================================
const DEFAULT_BASE_URL = 'https://YOUR-SERVER-URL.up.railway.app';

export const BASE_URL =
  Constants?.expoConfig?.extra?.apiBaseUrl ||
  Constants?.manifest?.extra?.apiBaseUrl ||
  DEFAULT_BASE_URL;

// Telegram orqali yuborilgan VIP to'lov kartasi (UI ko'rsatish uchun)
export const VIP_CARD = '4073420058363577';
export const VIP_CARD_OWNER = 'M.M';

// Majburiy obuna kanallari
export const REQUIRED_CHANNELS = [
  { id: '@yusufbe_dev', name: 'Yusufbe Dev', link: 'https://t.me/yusufbe_dev' },
  { id: '@student_aitex', name: 'AI Simulyator News', link: 'https://t.me/student_aitex' },
];

export default { BASE_URL, VIP_CARD, VIP_CARD_OWNER, REQUIRED_CHANNELS };
