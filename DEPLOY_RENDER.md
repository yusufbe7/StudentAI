# Botni Render'ga bepul joylash

## Avval bilish kerak

Render'ning bepul serveri:
- 15 daqiqa so'rov kelmasa **uxlaydi**. Telegram xabari kelganda ~30–60 soniyada uyg'onadi, birinchi javob shu sababli kechikadi.
- Uxlaganda yoki qayta ishga tushganda **diskdagi fayllar o'chadi**.
- Oyiga 750 soat bepul beriladi (bitta server uchun yetadi).

Bot ma'lumotlarni fayllarda saqlaydi. Ular yo'qolmasligi uchun bepul **Neon Postgres** bazasi ulanadi: bot ishga tushganda ma'lumotlar bazadan tiklanadi, ishlash davomida esa har 10 soniyada bazaga yoziladi (`lib/pgSync.js`).

---

## 1-qadam. Neon'da bepul baza ochish (5 daqiqa)

1. https://neon.com saytiga kiring va GitHub orqali ro'yxatdan o'ting.
2. **Create project**: nomi `studentai`, region **Europe (Frankfurt)**.
3. **Connect** tugmasini bosing va **Connection string** ni nusxalang. U shunday ko'rinadi:
   ```
   postgresql://user:parol@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
   Bu satr maxfiy, uni hech kimga bermang.

## 2-qadam. (Ixtiyoriy) Railway'dagi foydalanuvchilarni ko'chirish

Avval shu o'zgarishlar `main` ga birlashtirilgan bo'lishi kerak, chunki Railway `main` dagi kodni ishga tushiradi. Railway'ga pul to'lash shart emas. Trial tugagan bo'lsa ham **30 kun ichida** ma'lumotni olish mumkin. 30 kundan keyin Railway uni o'chiradi.

1. Railway → **Plans** (railway.com/workspace/plans) → **Free** planni tanlang. U bepul, karta talab qilinmasligi mumkin.
2. Railway → bot servisi → **Variables** bo'limiga ikkita o'zgaruvchi qo'shing:
   - `SYNC_DATABASE_URL` = Neon satri (Render'dagi bilan bir xil)
   - `SYNC_MODE` = `export`

   ⚠️ `SYNC_MODE=export` ni **albatta** qo'shing. Bu rejimda Railway faqat o'z ma'lumotini Neon'ga alohida joyga yuklaydi: hech narsani o'chirmaydi va botni ishga tushirmaydi, shuning uchun Render bilan to'qnashmaydi.
3. Servisni qayta deploy qiling (**Deploy** yoki **Redeploy**). Logda shu qator chiqishi kerak:
   ```
   ✅ [EKSPORT] 12 ta fayl (340 KB), 857 ta foydalanuvchi → Neon "import/railway/"
   ```
4. Railway servisini o'chirmang. Faqat aktiv deploy'ni to'xtating: **⋯ → Remove deployment**. Volume'dagi ma'lumot zaxira bo'lib qoladi. **Remove service** ni bosmang, u volume'ni ham o'chirishi mumkin.
5. Ma'lumotni birlashtiring, buning ikki yo'li bor:
   - admin panel (`kairohub.pro`) → **Sozlamalar** → **Railway'dan foydalanuvchilarni ko'chirish** → **Birlashtirish**;
   - yoki botga `/import_railway` yozing va **✅ Birlashtirish** tugmasini bosing.

Birlashtirishda hech kim o'chmaydi. Ikkala joyda ham bor talabalarda ball va testlarning kattasi, VIP muddatining esa uzunrog'i saqlanadi.

## 3-qadam. Render'da bot yaratish

1. https://render.com saytiga GitHub orqali kiring.
2. **New → Web Service** → `yusufbe7/StudentAI` repozitoriyasini tanlang.
3. Sozlamalar:
   | Maydon | Qiymat |
   |---|---|
   | Branch | `main` |
   | Region | Frankfurt |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |
4. **Environment Variables**:
   | Kalit | Qiymat |
   |---|---|
   | `BOT_TOKEN` | @BotFather bergan token |
   | `ADMIN_ID` | sizning Telegram ID'ingiz |
   | `SYNC_DATABASE_URL` | Neon satri (1-qadam) |
   | `ADMIN_USERNAME`, `ADMIN_PASSWORD` | admin panel uchun login va kuchli parol |
   | `PANEL_URL` | `https://kairohub.pro` |
   | `ANTHROPIC_API_KEY` | ixtiyoriy: AI funksiyalari uchun |
   | `NODE_VERSION` | `22` |
5. **Advanced → Health Check Path**: `/health`.
6. **Create Web Service** ni bosing.

Yoki boshqa yo'l: **New → Blueprint** → repozitoriyani tanlang. `render.yaml` hammasini o'zi to'ldiradi, faqat maxfiy qiymatlarni kiritasiz.

Webhook avtomatik o'rnatiladi, chunki Render `RENDER_EXTERNAL_URL` ni o'zi beradi. `WEBHOOK_URL` qo'shish shart emas.

## 4-qadam. Tekshirish

- Render → **Logs** bo'limida quyidagilar chiqishi kerak:
  ```
  🗄 [pgSync] N ta fayl bazadan tiklandi
  ✅ Bot WEBHOOK rejimida ishga tushdi!
  ```
- Botga /start yozing. Birinchi javob 30–60 soniya kechikishi mumkin.
- `https://<sizning-servis>.onrender.com/health` → `{"ok":true}`.
- Admin panel (Vercel) → **Bot server manzili** = `https://<sizning-servis>.onrender.com`. Yoki Vercel'da `VITE_API_URL` ga shu manzilni yozing.

## Bepul tarifning cheklovlari

- **Uyg'onish kechikishi:** server uxlab qolsa, birinchi xabarga javob ~1 daqiqa kechikadi. Telegram xabarni qayta yuboradi, shuning uchun xabar yo'qolmaydi.
- **Uxlaganda ishlamaydigan narsalar:** musobaqa taymeri, rejalashtirilgan xabarlar va haftalik cron. Ular faqat server uyg'oq paytda ishlaydi.
  - Serverni doim uyg'oq tutish uchun https://uptimerobot.com da har 5 daqiqada `https://<servis>.onrender.com/health` ni tekshiradigan monitor qo'yish mumkin.
  - Bunda oylik 750 bepul soatning deyarli hammasi shu bitta servisga ketadi.
- **Ma'lumot yo'qotish xavfi:** oxirgi ~10 soniyadagi o'zgarishlar faqat kutilmagan qulashda yo'qolishi mumkin. Oddiy to'xtashda (deploy, uxlash) bot avval hammasini bazaga yozib oladi.
- **Bot kattalashganda:** foydalanuvchilar ko'payganda Render Starter ($7/oy, uxlamaydi) yoki Railway (~$5/oy, `/data` disk bilan) barqarorroq ishlaydi.
