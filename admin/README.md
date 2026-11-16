# StudentAI — Admin panel

React + Vite + Tailwind CSS + framer-motion + lucide-react + recharts.
Glassmorphism dizayn, bot funksiyalariga moslangan.

## Ishga tushirish

```bash
cd admin
npm install
npm run dev      # http://localhost:5173/admin/
npm run build    # dist/ — Express /admin/ manzilida beradi
```

## Sahifalar

| Sahifa | Botdagi o'rni |
|---|---|
| Umumiy ko'rinish | 📊 Statistika, 📋 Hisobot |
| Moliya va AI | daromad, Anthropic API xarajati, AI budjeti |
| Foydalanuvchilar | 💎 VIP berish/olish, 🚫 Bloklash, 🎭 ball tuzatish, 🗑 o'chirish |
| VIP va to'lovlar | chek tasdiqlash, 💰 VIP narxi, 🧹 VIP'larni tozalash |
| Xabar tarqatish | 📣 Xabar tarqatish (+ segmentlar, rejalashtirish) |
| Moderatsiya | yuklangan test fayllari, "xato bor" shikoyatlari |
| Fanlar va savollar | 🏛 Universitetlar, 🎓 Yo'nalishlar, 📖 Fanlar, 📅 Semestrlar |
| Musobaqalar | 🏆 Haftalik musobaqa, 🚀 Start, 📢 Natijalar, 👥 Boshqarish |
| Majburiy kanallar | 📡 Majburiy kanallar (tekshiriladi / faqat link) |
| Faoliyat logi | yangi: kim nima o'zgartirgani |
| Sozlamalar | 🛑 Botni to'xtatish, 💰/🆓 rejim, 🚀 Turbo, ⏱ Vaqt, AI limitlari, xavfli amallar |

## Holat

Hozir **prototip**: ma'lumotlar `src/data/mock.js` dan keladi (maydonlar bot
bazasidagi tuzilmaga mos). Keyingi bosqich: himoyalangan `/api/admin/*`
endpointlariga ulash (Telegram login + `ADMIN_IDS` + httpOnly cookie).
