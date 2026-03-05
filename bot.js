// const TelegramBot = require('node-telegram-bot-api');
// const db = require('./database');

// // ===================== SOZLAMALAR =====================
// const BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE'; // @BotFather dan token
// const ADMIN_IDS = [123456789]; // Sizning Telegram ID ingiz
// // ======================================================

// const bot = new TelegramBot(BOT_TOKEN, { polling: true });
// db.initDb();

// console.log('🎬 Kino bot ishga tushdi!');

// // ===================== HELPERS =====================
// function isAdmin(userId) {
//   return ADMIN_IDS.includes(userId);
// }

// function adminKeyboard() {
//   return {
//     inline_keyboard: [
//       [{ text: "🎬 Kino qo'shish", callback_data: 'admin_add_movie' }],
//       [{ text: "🗑 Kino o'chirish", callback_data: 'admin_del_movie' }],
//       [{ text: "📢 Kanal qo'shish", callback_data: 'admin_add_channel' }],
//       [{ text: "❌ Kanal o'chirish", callback_data: 'admin_del_channel' }],
//       [{ text: "📋 Kanallar ro'yxati", callback_data: 'admin_list_channels' }],
//       [{ text: "🎞 Kinolar ro'yxati", callback_data: 'admin_list_movies' }],
//       [{ text: "📣 Xabar yuborish", callback_data: 'admin_broadcast' }],
//       [{ text: "📊 Statistika", callback_data: 'admin_stats' }],
//     ]
//   };
// }

// function subscriptionKeyboard(channels, movieCode = null) {
//   const buttons = channels.map(ch => ([{
//     text: `📢 ${ch.name}`,
//     url: ch.invite_link || 'https://t.me'
//   }]));
//   const callback = movieCode ? `check_sub:${movieCode}` : 'check_sub:none';
//   buttons.push([{ text: '✅ Obunani tekshirish', callback_data: callback }]);
//   return { inline_keyboard: buttons };
// }

// async function checkSubscription(userId) {
//   const channels = db.getChannels();
//   const notSubscribed = [];
//   for (const ch of channels) {
//     try {
//       const member = await bot.getChatMember(ch.channel_id, userId);
//       if (['left', 'kicked'].includes(member.status)) {
//         notSubscribed.push(ch);
//       }
//     } catch {
//       notSubscribed.push(ch);
//     }
//   }
//   return { ok: notSubscribed.length === 0, missing: notSubscribed };
// }

// async function sendMovieByCode(chatId, code) {
//   const movie = db.getMovieByCode(code);
//   if (!movie) {
//     return bot.sendMessage(chatId, '❌ Bunday kodli kino topilmadi!');
//   }
//   const caption = `🎬 <b>${movie.title}</b>\n\n📌 Kod: <code>${movie.code}</code>`;
//   try {
//     await bot.sendVideo(chatId, movie.file_id, { caption, parse_mode: 'HTML' });
//   } catch {
//     await bot.sendMessage(chatId, `🎬 <b>${movie.title}</b>\n\n❗ Kino faylini yuborishda xatolik.`, { parse_mode: 'HTML' });
//   }
// }

// // ===================== USER STATE (FSM) =====================
// // userId -> { state, data }
// const userStates = {};

// function setState(userId, state, data = {}) {
//   userStates[userId] = { state, data };
// }

// function getState(userId) {
//   return userStates[userId] || { state: null, data: {} };
// }

// function clearState(userId) {
//   delete userStates[userId];
// }


// // ===================== /start =====================
// bot.onText(/\/start(.*)/, async (msg, match) => {
//   const userId = msg.from.id;
//   const username = msg.from.username || '';
//   db.addUser(userId, username);

//   const arg = match[1].trim();
//   const movieCode = arg || null;

//   const { ok, missing } = await checkSubscription(userId);

//   if (!ok) {
//     return bot.sendMessage(userId,
//       '🔒 Botdan foydalanish uchun quyidagi kanallarga obuna bo\'ling:',
//       { reply_markup: subscriptionKeyboard(missing, movieCode) }
//     );
//   }

//   if (movieCode) {
//     return sendMovieByCode(userId, movieCode);
//   }

//   bot.sendMessage(userId,
//     '🎬 <b>Kino Botga xush kelibsiz!</b>\n\nKino kodini yuboring va filmni oling.\nMasalan: <code>1001</code>',
//     { parse_mode: 'HTML' }
//   );
// });


// // ===================== /admin =====================
// bot.onText(/\/admin/, (msg) => {
//   const userId = msg.from.id;
//   if (!isAdmin(userId)) {
//     return bot.sendMessage(userId, '❌ Sizda ruxsat yo\'q!');
//   }
//   bot.sendMessage(userId, '👑 <b>Admin Panel</b>', {
//     parse_mode: 'HTML',
//     reply_markup: adminKeyboard()
//   });
// });


// // ===================== MATN XABARLARI =====================
// bot.on('message', async (msg) => {
//   if (!msg.text) return;
//   const userId = msg.from.id;
//   const text = msg.text.trim();

//   // Commandlarni o'tkazib yuborish
//   if (text.startsWith('/')) return;

//   const { state, data } = getState(userId);

//   // --- Admin: kino nomi kutilmoqda ---
//   if (state === 'waiting_movie_title') {
//     const code = db.addMovie(text, data.file_id);
//     const me = await bot.getMe();
//     clearState(userId);
//     return bot.sendMessage(userId,
//       `✅ <b>Kino qo'shildi!</b>\n\n🎬 Nomi: <b>${text}</b>\n📌 Kod: <code>${code}</code>\n\n🔗 Havola: <code>https://t.me/${me.username}?start=${code}</code>`,
//       { parse_mode: 'HTML' }
//     );
//   }

//   // --- Admin: kino o'chirish ---
//   if (state === 'delete_movie') {
//     const movie = db.getMovieByCode(text);
//     clearState(userId);
//     if (!movie) return bot.sendMessage(userId, '❌ Bunday kodli kino topilmadi!');
//     db.deleteMovie(text);
//     return bot.sendMessage(userId, `✅ <b>${movie.title}</b> kinosi o'chirildi!`, { parse_mode: 'HTML' });
//   }

//   // --- Admin: kanal qo'shish ---
//   if (state === 'waiting_channel') {
//     clearState(userId);
//     try {
//       const chat = await bot.getChat(text);
//       let inviteLink = chat.invite_link;
//       if (!inviteLink) {
//         try {
//           inviteLink = await bot.exportChatInviteLink(chat.id);
//         } catch {
//           inviteLink = chat.username ? `https://t.me/${chat.username}` : 'Link yo\'q';
//         }
//       }
//       db.addChannel(String(chat.id), chat.title || text, inviteLink);
//       return bot.sendMessage(userId,
//         `✅ Kanal qo'shildi!\n📢 Nomi: <b>${chat.title}</b>\n🆔 ID: <code>${chat.id}</code>`,
//         { parse_mode: 'HTML' }
//       );
//     } catch (e) {
//       return bot.sendMessage(userId, `❌ Xatolik: ${e.message}\n\nBot kanalga admin ekanini tekshiring!`);
//     }
//   }

//   // --- Admin: broadcast xabar ---
//   if (state === 'broadcast') {
//     clearState(userId);
//     const users = db.getAllUsers();
//     let success = 0, failed = 0;
//     const statusMsg = await bot.sendMessage(userId, `📤 Yuborilmoqda... 0/${users.length}`);

//     for (let i = 0; i < users.length; i++) {
//       try {
//         await bot.copyMessage(users[i].user_id, msg.chat.id, msg.message_id);
//         success++;
//       } catch {
//         failed++;
//       }
//       if ((i + 1) % 20 === 0) {
//         try {
//           await bot.editMessageText(`📤 Yuborilmoqda... ${i + 1}/${users.length}`, {
//             chat_id: userId, message_id: statusMsg.message_id
//           });
//         } catch {}
//       }
//       await new Promise(r => setTimeout(r, 50));
//     }
//     return bot.editMessageText(
//       `✅ Xabar yuborildi!\n\n✔️ Muvaffaqiyatli: ${success}\n❌ Xato: ${failed}`,
//       { chat_id: userId, message_id: statusMsg.message_id }
//     );
//   }

//   // --- Video fayl kutilmoqda (admin) ---
//   // (video uchun alohida handler pastda)

//   // --- Oddiy foydalanuvchi: kino kodi ---
//   const { ok, missing } = await checkSubscription(userId);
//   if (!ok) {
//     return bot.sendMessage(userId,
//       '🔒 Avval kanallarga obuna bo\'ling:',
//       { reply_markup: subscriptionKeyboard(missing, text) }
//     );
//   }
//   sendMovieByCode(userId, text);
// });


// // ===================== VIDEO QABUL QILISH =====================
// bot.on('video', async (msg) => {
//   const userId = msg.from.id;
//   const { state } = getState(userId);
//   if (state === 'waiting_movie_file') {
//     setState(userId, 'waiting_movie_title', { file_id: msg.video.file_id });
//     bot.sendMessage(userId, '✏️ Kino nomini kiriting:');
//   }
// });


// // ===================== CALLBACK QUERY =====================
// bot.on('callback_query', async (query) => {
//   const userId = query.from.id;
//   const data = query.data;
//   const msg = query.message;

//   // --- OBUNA TEKSHIRISH ---
//   if (data.startsWith('check_sub:')) {
//     const movieCode = data.split(':')[1];
//     const { ok, missing } = await checkSubscription(userId);

//     if (!ok) {
//       await bot.answerCallbackQuery(query.id, { text: '❌ Hali obuna bo\'lmadingiz!', show_alert: true });
//       return bot.editMessageReplyMarkup(
//         subscriptionKeyboard(missing, movieCode !== 'none' ? movieCode : null),
//         { chat_id: msg.chat.id, message_id: msg.message_id }
//       );
//     }

//     await bot.deleteMessage(msg.chat.id, msg.message_id);
//     bot.answerCallbackQuery(query.id);

//     if (movieCode && movieCode !== 'none') {
//       return sendMovieByCode(userId, movieCode);
//     }
//     return bot.sendMessage(userId, '✅ Obuna tasdiqlandi!\n\n🎬 Kino kodini yuboring:');
//   }

//   // Admin tekshiruv
//   if (!isAdmin(userId)) {
//     return bot.answerCallbackQuery(query.id, { text: '❌ Ruxsat yo\'q!', show_alert: true });
//   }

//   // --- ADMIN CALLBACKS ---
//   if (data === 'admin_add_movie') {
//     setState(userId, 'waiting_movie_file');
//     bot.sendMessage(userId, '🎬 Kino faylini yuboring (video):');
//     bot.answerCallbackQuery(query.id);
//   }

//   else if (data === 'admin_del_movie') {
//     setState(userId, 'delete_movie');
//     bot.sendMessage(userId, '🗑 O\'chirmoqchi bo\'lgan kino kodini yuboring:');
//     bot.answerCallbackQuery(query.id);
//   }

//   else if (data === 'admin_add_channel') {
//     setState(userId, 'waiting_channel');
//     bot.sendMessage(userId,
//       '📢 Kanal username yoki ID sini yuboring.\nMasalan: <code>@mening_kanalim</code>\n\n⚠️ Bot kanalga admin bo\'lishi kerak!',
//       { parse_mode: 'HTML' }
//     );
//     bot.answerCallbackQuery(query.id);
//   }

//   else if (data === 'admin_del_channel') {
//     const channels = db.getChannels();
//     if (!channels.length) {
//       return bot.answerCallbackQuery(query.id, { text: 'Kanallar yo\'q!', show_alert: true });
//     }
//     const buttons = channels.map(ch => ([{
//       text: `❌ ${ch.name}`,
//       callback_data: `delch:${ch.channel_id}`
//     }]));
//     buttons.push([{ text: '🔙 Orqaga', callback_data: 'back_admin' }]);
//     bot.editMessageText('Qaysi kanalni o\'chirmoqchisiz?', {
//       chat_id: msg.chat.id,
//       message_id: msg.message_id,
//       reply_markup: { inline_keyboard: buttons }
//     });
//     bot.answerCallbackQuery(query.id);
//   }

//   else if (data.startsWith('delch:')) {
//     const channelId = data.split(':')[1];
//     db.deleteChannel(channelId);
//     bot.answerCallbackQuery(query.id, { text: '✅ Kanal o\'chirildi!', show_alert: true });
//     bot.editMessageText('👑 <b>Admin Panel</b>', {
//       chat_id: msg.chat.id,
//       message_id: msg.message_id,
//       parse_mode: 'HTML',
//       reply_markup: adminKeyboard()
//     });
//   }

//   else if (data === 'admin_list_channels') {
//     const channels = db.getChannels();
//     if (!channels.length) {
//       return bot.answerCallbackQuery(query.id, { text: 'Kanallar yo\'q!', show_alert: true });
//     }
//     let text = '📋 <b>Kanallar ro\'yxati:</b>\n\n';
//     channels.forEach((ch, i) => {
//       text += `${i + 1}. ${ch.name} — <code>${ch.channel_id}</code>\n`;
//     });
//     bot.sendMessage(userId, text, { parse_mode: 'HTML' });
//     bot.answerCallbackQuery(query.id);
//   }

//   else if (data === 'admin_list_movies') {
//     const movies = db.getAllMovies();
//     if (!movies.length) {
//       return bot.answerCallbackQuery(query.id, { text: 'Kinolar yo\'q!', show_alert: true });
//     }
//     let text = '🎞 <b>Kinolar ro\'yxati:</b>\n\n';
//     movies.forEach(m => {
//       text += `📌 Kod: <code>${m.code}</code> — ${m.title}\n`;
//     });
//     bot.sendMessage(userId, text, { parse_mode: 'HTML' });
//     bot.answerCallbackQuery(query.id);
//   }

//   else if (data === 'admin_stats') {
//     const stats = db.getStats();
//     bot.sendMessage(userId,
//       `📊 <b>Statistika:</b>\n\n👥 Foydalanuvchilar: <b>${stats.users}</b>\n🎬 Kinolar: <b>${stats.movies}</b>\n📢 Kanallar: <b>${stats.channels}</b>`,
//       { parse_mode: 'HTML' }
//     );
//     bot.answerCallbackQuery(query.id);
//   }

//   else if (data === 'admin_broadcast') {
//     setState(userId, 'broadcast');
//     bot.sendMessage(userId, '📣 Yubormoqchi bo\'lgan xabaringizni yozing:');
//     bot.answerCallbackQuery(query.id);
//   }

//   else if (data === 'back_admin') {
//     bot.editMessageText('👑 <b>Admin Panel</b>', {
//       chat_id: msg.chat.id,
//       message_id: msg.message_id,
//       parse_mode: 'HTML',
//       reply_markup: adminKeyboard()
//     });
//     bot.answerCallbackQuery(query.id);
//   }
// });

// // Xatoliklarni ushlash
// bot.on('polling_error', (err) => console.error('Polling error:', err.message));