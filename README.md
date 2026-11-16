# StudentAI

Talabalar uchun Telegram test boti + web ilova + admin panel.

## Tuzilma

| Joy | Nima |
|---|---|
| `index.js` | Telegram bot (Telegraf), Express API, Socket.io chat |
| `lib/questionParser.js` | Test fayllarini o'qish (AI'siz): `.doc .docx .pdf .xlsx .xls .csv .txt` |
| `lib/ai.js` | Claude (Anthropic API): tartibsiz fayl, javobsiz savollar, "💡 Tushuntirish" |
| `lib/uploadFeature.js` | 📤 Test yuklash, 📚 Mening testlarim, yodlash, xatolar, Excel |
| `lib/userTests.js` | Foydalanuvchi testlarini saqlash (`<DATA_DIR>/user_tests/`) |
| `public/` | Web ilova (Telegram WebApp) |
| `admin/` | Admin panel (React + Vite), hozircha prototip |
| `mobile/` | Expo mobil ilova |

## Test yuklash qanday ishlaydi

1. Talaba **📤 Test yuklash** ni bosadi va fayl yuboradi.
2. Parser savollarni ajratadi (bepul, bir zumda). Qo'llab-quvvatlanadigan formatlar:
   - raqamlangan: `1. Savol` + `A. variant` / `Б) вариант`, to'g'ri javob `*`, `+` yoki `#` bilan, yoki `Javob: B` qatori;
   - HEMIS: `++++ savol ==== #to'g'ri ==== xato`;
   - Excel shablon: `Savol | To'g'ri javob | Xato | Xato | Xato | til`.
3. Parser topa olmasa va `ANTHROPIC_API_KEY` o'rnatilgan bo'lsa, Claude savollarni ajratadi.
4. Bot fan nomini so'raydi. Test **📚 Mening testlarim** ga qo'shiladi.
5. Imkoniyatlar: ⚡ Blitz, 📝 To'liq test, 🧠 Yodlash, ❌ Xatolarim, 🤖 javobsizlarga AI javob, 📥 Excel.

Shaxsiy testlar umumiy reytingga ta'sir qilmaydi va kunlik 3 ta test limitiga kirmaydi.

## Muhit o'zgaruvchilari

| O'zgaruvchi | Standart | Izoh |
|---|---|---|
| `BOT_TOKEN`, `ADMIN_ID` | — | majburiy |
| `ANTHROPIC_API_KEY` | — | bo'lmasa AI funksiyalari o'chiq, qolgani ishlaydi |
| `AI_MODEL_EXTRACT` | `claude-opus-5-5` | tartibsiz fayldan savol ajratish |
| `AI_MODEL_SOLVE` | `claude-opus-5-5` | javobsiz savollarga javob topish |
| `AI_MODEL_EXPLAIN` | `claude-opus-5-5` | "💡 Tushuntirish" |
| `FREE_UPLOADS` | `1` | VIP bo'lmaganlar uchun bepul fayllar soni |
| `FREE_AI_EXTRACT_CHARS` | `30000` | bepul AI o'qishda matn chegarasi (~150 savol) |
| `FREE_EXPLAIN_DAILY` / `VIP_EXPLAIN_DAILY` | `3` / `100` | kunlik tushuntirishlar |
| `FREE_SOLVE_MAX` | `60` | bepul: bir marta, shuncha javobsiz savolgacha |
| `MAX_UPLOAD_MB` | `15` | fayl hajmi chegarasi |

Arzonroq modelga o'tish uchun, masalan: `AI_MODEL_EXPLAIN=claude-sonnet-5-5`, `AI_MODEL_EXTRACT=claude-haiku-5-5`.
Har bir AI so'rovi va uning taxminiy narxi `<DATA_DIR>/ai_usage.json` ga yoziladi.
