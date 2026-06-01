import { io } from 'socket.io-client';
import { BASE_URL } from '../config';

let socket = null;

// Socket.io ulanishini ochish (foydalanuvchi ismi bilan auth)
export function connectSocket(name) {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  socket = io(BASE_URL, {
    transports: ['websocket', 'polling'],
    auth: { name },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    timeout: 15000,
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default { connectSocket, getSocket, disconnectSocket };
