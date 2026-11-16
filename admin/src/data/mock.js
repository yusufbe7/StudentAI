// ============================================================
// SOXTA (MOCK) MA'LUMOTLAR
// Maydonlar botdagi haqiqiy tuzilmaga mos: db.users, bot_config.json,
// settings.json, db.tournament, requiredChannels. Keyingi bosqichda
// bular /api/admin/* endpointlaridan keladi (src/data/api.js).
// ============================================================

const FIRST = ['Yusuf', 'Aziza', 'Jasur', 'Madina', 'Sardor', 'Dilnoza', 'Bekzod', 'Malika', 'Otabek', 'Nilufar',
  'Javohir', 'Shahzoda', 'Doniyor', 'Kamola', 'Sherzod', 'Gulnoza', 'Akmal', 'Zarina', 'Rustam', 'Sevara',
  'Islom', 'Mohira', 'Bobur', 'Lola', 'Firdavs', 'Munisa', 'Asilbek', 'Feruza', 'Ulugbek', 'Charos'];
const LAST = ['Karimov', 'Rahimova', 'Toshmatov', 'Yusupova', 'Aliyev', 'Ergasheva', 'Nazarov', 'Saidova',
  'Qodirov', 'Mirzayeva', 'Xolmatov', 'Abdullayeva', 'Sobirov', 'Ismoilova', 'Usmonov'];

export const UNIVERSITIES = ['Alfraganus Universiteti', 'Perfect Universiteti', 'TATU', 'TDPU', 'Toshkent Davlat Iqtisodiyot Universiteti'];
const DIRS = ['Dasturiy Injiniring', 'Kiberxavfsizlik', "Sun'iy intelekt", 'Davolash ishi', "Moliya va moliyaviy texnologiyalar yo'nalishi"];
const KURS = ['1-kurs', '2-kurs', '3-kurs', '4-kurs'];

// Deterministik tasodif (har safar bir xil natija)
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

export const users = Array.from({ length: 64 }, (_, i) => {
  const first = FIRST[i % FIRST.length];
  const last = pick(LAST);
  const totalTests = Math.floor(rnd() * 140);
  const totalCorrect = Math.floor(totalTests * 25 * (0.45 + rnd() * 0.5));
  const totalWrong = totalTests * 25 - totalCorrect;
  const isVip = rnd() < 0.28;
  const vipStart = isVip ? NOW - Math.floor(rnd() * 25) * DAY : null;
  return {
    id: 5000000000 + Math.floor(rnd() * 3000000000),
    name: `${first} ${last}`,
    username: rnd() < 0.85 ? `${first.toLowerCase()}_${last.slice(0, 3).toLowerCase()}${i}` : "Lichka yopiq",
    univ: pick(UNIVERSITIES),
    kurs: pick(KURS),
    yonalish: pick(DIRS),
    semester: rnd() < 0.7 ? '2-semestr' : '1-semestr',
    score: Math.max(0, totalCorrect),
    totalTests,
    totalCorrect: Math.max(0, totalCorrect),
    totalWrong: Math.max(0, totalWrong),
    isVip,
    vipStart,
    vipEnd: isVip ? vipStart + 30 * DAY : null,
    isBlocked: rnd() < 0.05,
    source: rnd() < 0.7 ? 'bot' : 'web',
    joinedAt: NOW - Math.floor(rnd() * 120) * DAY,
    lastActive: NOW - Math.floor(rnd() * 72) * 60 * 60 * 1000,
  };
});

// VIP to'lov so'rovlari (foydalanuvchi chek yuboradi → admin tasdiqlaydi)
export const payments = [
  { id: 'p1', userId: users[3].id, name: users[3].name, username: users[3].username, amount: 10000, plan: 'VIP · 30 kun', status: 'pending', createdAt: NOW - 12 * 60 * 1000 },
  { id: 'p2', userId: users[8].id, name: users[8].name, username: users[8].username, amount: 10000, plan: 'VIP · 30 kun', status: 'pending', createdAt: NOW - 47 * 60 * 1000 },
  { id: 'p3', userId: users[15].id, name: users[15].name, username: users[15].username, amount: 15000, plan: 'Referat', status: 'pending', createdAt: NOW - 2 * 60 * 60 * 1000 },
  { id: 'p4', userId: users[21].id, name: users[21].name, username: users[21].username, amount: 10000, plan: 'VIP · 30 kun', status: 'approved', createdAt: NOW - 5 * 60 * 60 * 1000 },
  { id: 'p5', userId: users[27].id, name: users[27].name, username: users[27].username, amount: 10000, plan: 'VIP · 30 kun', status: 'approved', createdAt: NOW - 9 * 60 * 60 * 1000 },
  { id: 'p6', userId: users[30].id, name: users[30].name, username: users[30].username, amount: 8000, plan: 'Slayd', status: 'rejected', createdAt: NOW - 26 * 60 * 60 * 1000 },
  { id: 'p7', userId: users[34].id, name: users[34].name, username: users[34].username, amount: 10000, plan: 'VIP · 30 kun', status: 'approved', createdAt: NOW - 30 * 60 * 60 * 1000 },
];

// Talabalar yuklagan test fayllari (moderatsiya navbati)
export const uploads = [
  { id: 'u1', title: 'Sud tibbiyoti', file: 'Sud_tibbiyoti_YN.doc', by: users[5].name, univ: 'Alfraganus Universiteti', questions: 500, options: 5, missingAnswers: 41, lang: 'ru', parsedBy: 'parser', status: 'pending', color: 'from-sky-400 to-blue-600', createdAt: NOW - 20 * 60 * 1000 },
  { id: 'u2', title: 'Fizika 2', file: 'fizika2_savollar.xlsx', by: users[12].name, univ: 'TATU', questions: 320, options: 4, missingAnswers: 0, lang: 'uz', parsedBy: 'parser', status: 'pending', color: 'from-violet-400 to-indigo-600', createdAt: NOW - 3 * 60 * 60 * 1000 },
  { id: 'u3', title: 'Falsafa', file: 'falsafa_test.pdf', by: users[19].name, univ: 'Perfect Universiteti', questions: 180, options: 4, missingAnswers: 12, lang: 'uz', parsedBy: 'ai', status: 'pending', color: 'from-amber-400 to-orange-600', createdAt: NOW - 6 * 60 * 60 * 1000 },
  { id: 'u4', title: "Ma'lumotlar tuzilmasi", file: 'MT_yakuniy.docx', by: users[24].name, univ: 'TATU', questions: 250, options: 4, missingAnswers: 3, lang: 'uz', parsedBy: 'parser', status: 'pending', color: 'from-emerald-400 to-teal-600', createdAt: NOW - 9 * 60 * 60 * 1000 },
  { id: 'u5', title: 'Anatomiya', file: 'anatomiya_rasm.jpg', by: users[31].name, univ: 'Alfraganus Universiteti', questions: 40, options: 4, missingAnswers: 40, lang: 'ru', parsedBy: 'ai', status: 'pending', color: 'from-rose-400 to-pink-600', createdAt: NOW - 22 * 60 * 60 * 1000 },
  { id: 'u6', title: 'Iqtisodiyot nazariyasi', file: 'iqtisod.txt', by: users[40].name, univ: 'Toshkent Davlat Iqtisodiyot Universiteti', questions: 150, options: 4, missingAnswers: 0, lang: 'uz', parsedBy: 'parser', status: 'pending', color: 'from-cyan-400 to-sky-600', createdAt: NOW - 30 * 60 * 60 * 1000 },
];

// "Savolda xato bor" shikoyatlari (botdagi report_q tugmasi)
export const reports = [
  { id: 'r1', subject: 'Dasturlash 2', question: "C++ da 'virtual' kalit so'zi nima uchun ishlatiladi?", reason: "To'g'ri javob noto'g'ri belgilangan", by: users[2].name, createdAt: NOW - 40 * 60 * 1000 },
  { id: 'r2', subject: 'Fizika 2', question: "Elektr tokining magnit ta'siri qaysi muhitlarda kuzatiladi?", reason: 'Ikkita variant bir xil', by: users[9].name, createdAt: NOW - 4 * 60 * 60 * 1000 },
  { id: 'r3', subject: 'Falsafa', question: "Borliq haqidagi ta'limot qanday ataladi?", reason: 'Imloviy xato', by: users[17].name, createdAt: NOW - 20 * 60 * 60 * 1000 },
];

// bot_config.json → subjectsByDirection
export const config = {
  vipPrice: 10000,
  semesters: ['1-semestr', '2-semestr'],
  activeSemesters: ['2-semestr'],
  directionsByUniv: Object.fromEntries(UNIVERSITIES.map((u) => [u, {
    '1-kurs': ['Dasturiy Injiniring', 'Kiberxavfsizlik', "Sun'iy intelekt"],
    '2-kurs': ['Dasturiy Injiniring', 'Kiberxavfsizlik', "Sun'iy intelekt"],
    '3-kurs': ['Magistratura', 'Boshqa'],
    '4-kurs': ['Magistratura', 'Boshqa'],
  }])),
  subjectsByDirection: {
    'Dasturiy Injiniring': {
      '1-semestr': [
        { name: 'Akademik yozuv', icon: '📝', key: 'academic', questions: 210 },
        { name: 'Tarix', icon: '📜', key: 'history', questions: 340 },
        { name: 'Matematika', icon: '➕', key: 'math', questions: 280 },
        { name: 'Dasturlash 1', icon: '💻', key: 'dasturlash', questions: 300 },
      ],
      '2-semestr': [
        { name: 'Dasturlash 2', icon: '💡', key: 'dasturiy_injiniring_dasturlash2', questions: 300 },
        { name: 'Dinshunoslik', icon: '🕌', key: 'dasturiy_injiniring_dinshunoslik', questions: 250 },
        { name: 'Falsafa', icon: '💭', key: 'dasturiy_injiniring_falsafa', questions: 260 },
        { name: 'Fizika 2', icon: '🧲', key: 'dasturiy_injiniring_fizika2', questions: 320 },
        { name: "Ma'lumotlar tuzilmasi", icon: '🌳', key: 'dasturiy_injiniring_mt', questions: 250 },
      ],
    },
    Kiberxavfsizlik: {
      '1-semestr': [
        { name: 'Tarix', icon: '📜', key: 'kiber_history', questions: 340 },
        { name: 'Perfect English', icon: '🇬🇧', key: 'kiber_english', questions: 200 },
      ],
      '2-semestr': [
        { name: 'Kriptografiya asoslari', icon: '🔐', key: 'kiber_kripto', questions: 180 },
        { name: 'Falsafa', icon: '💭', key: 'kiber_falsafa', questions: 260 },
      ],
    },
    "Sun'iy intelekt": {
      '1-semestr': [{ name: 'Matematika', icon: '➕', key: 'ai_math', questions: 280 }],
      '2-semestr': [
        { name: 'Ehtimollar nazariyasi', icon: '🎲', key: 'ai_prob', questions: 150 },
        { name: 'Python', icon: '🐍', key: 'ai_python', questions: 220 },
      ],
    },
    'Davolash ishi': {
      '1-semestr': [],
      '2-semestr': [{ name: 'Sud tibbiyoti', icon: '⚖️', key: 'med_sud', questions: 500 }],
    },
  },
};

// settings.json + db.settings
export const botSettings = {
  isMaintenance: false, // 🛑 Botni to'xtatish
  isPaidMode: false, // 💰 Pullik / 🆓 Bepul
  turboMode: false, // 🚀 Turbo
  timeLimit: 30, // ⏱ Savol vaqti (s)
  freeUploads: 1, // AI: bepul fayl yuklash soni
  freeUploadMaxQuestions: 100,
  dailyAiLimitFree: 5,
  dailyAiLimitVip: 50,
  monthlyAiBudgetUsd: 150,
  models: { parse: 'claude-haiku-5-5', explain: 'claude-sonnet-5-5', referat: 'claude-sonnet-5-5', slides: 'claude-sonnet-5-5' },
};

// requiredChannels — type: 'verify' (tekshiriladi) | 'link' (faqat havola)
export const channels = [
  { id: '@yusufbe_dev', name: 'Yusufbe Dev', link: 'https://t.me/yusufbe_dev', type: 'verify', members: 2840 },
  { id: '@student_aitex', name: 'AI Simulyator News', link: 'https://t.me/student_aitex', type: 'verify', members: 5120 },
  { id: '-1002233445566', name: 'Hamkor kanal', link: 'https://t.me/+AbCdEfGh', type: 'link', members: 940 },
];

// db.tournament
export const tournament = {
  isActive: true,
  started: false,
  date: '22.11.2026',
  time: '20:00',
  count: 30,
  participants: users.slice(0, 38).map((u) => u.id),
  leaderboard: users.slice(0, 8).map((u, i) => ({ name: u.name, univ: u.univ, tourScore: 30 - i * 2 - (i > 3 ? 1 : 0), timeSec: 240 + i * 17 })),
};

export const broadcasts = [
  { id: 'b1', text: "🏆 Shanba kuni soat 20:00 da haftalik musobaqa! 30 ta savol, g'oliblarga VIP sovg'a.", segment: 'Hammaga', sent: 4120, failed: 86, status: 'sent', at: NOW - 2 * DAY },
  { id: 'b2', text: '💎 VIP narxi faqat shu hafta 8 000 so\'m!', segment: 'VIP emaslar', sent: 2980, failed: 41, status: 'sent', at: NOW - 6 * DAY },
  { id: 'b3', text: "📚 Fizika 2 fanidan 320 ta yangi savol qo'shildi.", segment: 'TATU · 1-kurs', status: 'scheduled', at: NOW + 20 * 60 * 60 * 1000 },
];

export const activityLog = [
  { who: 'Yusuf', action: "VIP berdi", target: users[21].name, at: NOW - 5 * 60 * 60 * 1000, type: 'vip' },
  { who: 'Yusuf', action: "Fan qo'shdi", target: 'Sud tibbiyoti (Davolash ishi)', at: NOW - 7 * 60 * 60 * 1000, type: 'content' },
  { who: 'Moderator', action: 'Faylni tasdiqladi', target: 'Python · 220 savol', at: NOW - 11 * 60 * 60 * 1000, type: 'moderation' },
  { who: 'Yusuf', action: 'Blokladi', target: users[44].name, at: NOW - 26 * 60 * 60 * 1000, type: 'block' },
  { who: 'Yusuf', action: 'Xabar tarqatdi', target: 'Hammaga · 4 120 kishi', at: NOW - 2 * DAY, type: 'broadcast' },
  { who: 'Yusuf', action: "VIP narxini o'zgartirdi", target: "8 000 → 10 000 so'm", at: NOW - 3 * DAY, type: 'settings' },
  { who: 'Yusuf', action: "Kanal qo'shdi", target: 'Hamkor kanal (link)', at: NOW - 4 * DAY, type: 'channel' },
];

// Oxirgi 14 kun faolligi
export const activity14 = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(NOW - (13 - i) * DAY);
  const base = 380 + i * 22;
  return {
    day: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`,
    tests: Math.round(base + rnd() * 160),
    newUsers: Math.round(20 + rnd() * 45 + i * 2),
  };
});

// Oylar bo'yicha moliya (so'm) va AI xarajati ($)
export const finance12 = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy'].map((m, i) => ({
  month: m,
  revenue: Math.round((900 + i * 420 + rnd() * 600) * 1000),
  aiCostUsd: Math.round(6 + i * 7 + rnd() * 10),
}));

export const aiUsage = [
  { task: "Fayl o'qish (AI zaxira)", model: 'Haiku 5.5', requests: 148, costUsd: 4.6 },
  { task: '"Nega?" tushuntirish', model: 'Sonnet 5.5', requests: 6230, costUsd: 41.2 },
  { task: 'Javobsiz savollar', model: 'Sonnet 5.5', requests: 61, costUsd: 9.8 },
  { task: 'Referat', model: 'Sonnet 5.5', requests: 74, costUsd: 21.5 },
  { task: 'Slayd', model: 'Sonnet 5.5', requests: 92, costUsd: 7.9 },
];

export const USD_UZS = 12800;
