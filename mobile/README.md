# StudentAI Mobile 📱

StudentAI Telegram bot/web platformasining **React Native (Expo)** mobil ilovasi.
Mavjud backend (Express + Socket.io REST API) bilan to'g'ridan-to'g'ri ishlaydi.

## ✨ Imkoniyatlar

| Bo'lim | Tavsif |
|--------|--------|
| 🔐 **Auth** | Username/parol bilan ro'yxatdan o'tish va kirish |
| 👆 **Biometrik kirish** | Face ID / barmoq izi orqali tez kirish |
| 🏠 **Bosh sahifa** | Statistika, streak, online foydalanuvchilar, faollik tasmasi |
| 📚 **Testlar** | Blitz (25 savol), To'liq, Turbo yodlash rejimlari |
| ⏱ **Timer** | Har bir savol uchun 30 soniya |
| 🖼 **Rasmli savollar** | Savol rasmlari qo'llab-quvvatlanadi |
| 📴 **Offline rejim** | Fanlar/savollar keshlanadi, internetsiz ko'rish |
| 🏆 **Reyting** | Podium (TOP-3) + to'liq leaderboard + o'z o'rningiz |
| 💬 **Real-time chat** | Socket.io: typing indikator, o'qildi belgisi, online status |
| 👤 **Profil** | Statistika, VIP status, yutuqlar, tahrirlash |
| 💎 **VIP** | A'zolik, karta nusxalash, referal tizimi |
| 🏅 **Yutuqlar** | Badge/achievement tizimi |
| 📅 **Kalendar** | Imtihon sanalari + eslatma bildirishnomalari |
| 🎥 **Video darslar** | YouTube darslar (ichki player) |
| 🌗 **Dark/Light tema** | Tizim / Yorug' / Qorong'u |
| 🔔 **Push bildirishnomalar** | Test natijalari va imtihon eslatmalari |

## 🚀 Ishga tushirish

### 1. Talablar
- Node.js 20+
- [Expo Go](https://expo.dev/go) ilovasi (telefoningizda) yoki Android/iOS emulyator

### 2. Bog'lanishlarni o'rnatish
```bash
cd mobile
npm install
```

### 3. Server manzilini sozlash ⚠️ MUHIM
`app.json` faylida `expo.extra.apiBaseUrl` ni o'z serveringiz manziliga o'zgartiring:

```json
"extra": {
  "apiBaseUrl": "https://sizning-serveringiz.up.railway.app"
}
```

> **Lokal serverda sinash:** `localhost` emas, kompyuteringizning IP manzilini yozing
> (masalan `http://192.168.1.10:3000`) — aks holda telefon serverga ulana olmaydi.

Yoki `src/config.js` dagi `DEFAULT_BASE_URL` ni o'zgartiring.

### 4. Ishga tushirish
```bash
npm start
```
Terminalda chiqqan QR kodni Expo Go ilovasi bilan skanerlang.

## 📦 APK / IPA build qilish (do'konga chiqarish)

[EAS Build](https://docs.expo.dev/build/introduction/) orqali:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android   # APK/AAB uchun
eas build --platform ios       # IPA uchun (Apple Developer akkaunt kerak)
```

## 🗂 Loyiha tuzilishi

```
mobile/
├── App.js                      # Ildiz komponent (providerlar + notifications)
├── app.json                    # Expo konfiguratsiya (apiBaseUrl shu yerda)
├── src/
│   ├── config.js               # BASE_URL, VIP karta, kanallar
│   ├── api/client.js           # Barcha REST endpointlar
│   ├── socket/socket.js        # Socket.io ulanishi
│   ├── context/
│   │   ├── AuthContext.js       # Sessiya, login/logout, biometrik
│   │   └── ThemeContext.js      # Dark/Light tema
│   ├── theme/colors.js          # Rang palitralari
│   ├── components/              # Avatar, Card, Button, Input, ...
│   ├── navigation/              # RootNavigator + MainTabs
│   ├── screens/                 # 17 ta ekran
│   └── utils/                   # storage (offline cache), notifications
```

## 🔌 Backendga qo'shilgan o'zgarish

Mobil ilovada savol rasmlari yuklanishi uchun backend `index.js` ga
quyidagi static route qo'shildi:

```js
app.use('/images', express.static(path.join(__dirname, 'images')));
```

## ⚙️ Texnologiyalar

- **Expo SDK 51** / React Native 0.74
- **React Navigation** (bottom tabs + native stack)
- **socket.io-client** — real-time chat
- **expo-local-authentication** — biometrik kirish
- **expo-notifications** — push/lokal bildirishnomalar
- **@react-native-async-storage/async-storage** — sessiya va offline kesh
- **react-native-webview** — video darslar pleyeri

---
🎓 StudentAI jamoasi uchun tayyorlandi.
