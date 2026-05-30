import { BASE_URL } from '../config';

// ============================================================
// Universal fetch wrapper
// ============================================================
async function request(path, { method = 'GET', body, query, timeout = 20000 } = {}) {
  let url = BASE_URL.replace(/\/$/, '') + path;
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    if (qs) url += '?' + qs;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const txt = await res.text();
    let data;
    try {
      data = txt ? JSON.parse(txt) : {};
    } catch {
      data = { raw: txt };
    }

    if (!res.ok) {
      const err = new Error(data?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      const err = new Error('Vaqt tugadi (server javob bermadi)');
      err.code = 'TIMEOUT';
      throw err;
    }
    throw e;
  }
}

export const api = {
  // ── Auth ──────────────────────────────────────────────
  register: (username, name, password) =>
    request('/api/web-auth/register', { method: 'POST', body: { username, name, password } }),

  login: (username, password) =>
    request('/api/web-auth/login', { method: 'POST', body: { username, password } }),

  me: (username) => request('/api/web-auth/me', { query: { username } }),

  updateProfile: (payload) =>
    request('/api/web-auth/update', { method: 'POST', body: payload }),

  resetPassword: (username, newPassword) =>
    request('/api/web-auth/reset-password', { method: 'POST', body: { username, newPassword } }),

  // ── VIP ───────────────────────────────────────────────
  myVip: ({ username, name }) => request('/api/my-vip', { query: { username, name } }),

  notifyNonVip: (name) => request('/api/notify-non-vip', { method: 'POST', body: { name } }),

  // ── Subjects / Tests ──────────────────────────────────
  subjects: ({ semester, yonalish } = {}) =>
    request('/api/subjects', { query: { semester, yonalish } }),

  submitScore: (payload) => request('/api/web-score', { method: 'POST', body: payload }),

  testSession: (payload) => request('/api/test-session', { method: 'POST', body: payload }),

  activityFeed: (limit = 30) => request('/api/activity-feed', { query: { limit } }),

  // ── Leaderboard / Stats ───────────────────────────────
  leaderboard: () => request('/api/leaderboard'),

  userStats: ({ name, username }) => request('/api/user-stats', { query: { name, username } }),

  onlineCount: () => request('/api/online-count'),

  topUser: () => request('/api/top-user'),

  // ── Chat ──────────────────────────────────────────────
  chatList: (myName) => request('/api/chat/list', { query: { myName } }),

  chatMessages: (name1, name2, since = 0) =>
    request('/api/chat/messages', { query: { name1, name2, since } }),

  chatSend: (payload) => request('/api/chat/send', { method: 'POST', body: payload }),

  chatRead: (myName, otherName) =>
    request('/api/chat/read', { method: 'POST', body: { myName, otherName } }),

  chatDelete: (myName, otherName) =>
    request('/api/chat/delete', { method: 'POST', body: { myName, otherName } }),

  chatUnread: (myName) => request('/api/chat/unread', { query: { myName } }),

  // ── Follow ────────────────────────────────────────────
  follow: (follower, following) =>
    request('/api/follow', { method: 'POST', body: { follower, following } }),

  followInfo: (name) => request('/api/follow-info', { query: { name } }),

  followList: (name) => request('/api/follow-list', { query: { name } }),

  // ── Streak / Badges / Notifs ──────────────────────────
  streak: (name) => request('/api/streak', { query: { name } }),

  updateStreak: (name) => request('/api/streak/update', { method: 'POST', body: { name } }),

  badges: (name) => request('/api/badges', { query: { name } }),

  checkBadges: (name) => request('/api/badges/check', { method: 'POST', body: { name } }),

  notifs: (name) => request('/api/notifs', { query: { name } }),

  readNotifs: (name) => request('/api/notifs/read', { method: 'POST', body: { name } }),

  // ── Challenges ────────────────────────────────────────
  challenges: () => request('/api/challenges'),

  joinChallenge: (name, challengeId) =>
    request('/api/challenge/join', { method: 'POST', body: { name, challengeId } }),

  challengeProgress: (name) => request('/api/challenge/progress', { query: { name } }),

  // ── Likes ─────────────────────────────────────────────
  like: (payload) => request('/api/like', { method: 'POST', body: payload }),

  likes: (itemId, userName) => request('/api/likes', { query: { itemId, userName } }),

  // ── Nickname ──────────────────────────────────────────
  checkNickname: (nickname) => request('/api/nickname/check', { query: { nickname } }),

  setNickname: (payload) => request('/api/nickname/set', { method: 'POST', body: payload }),

  appVersion: () => request('/api/app-version'),
};

export default api;
