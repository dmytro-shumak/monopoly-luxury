import { io, Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? undefined : 'http://localhost:3001');

export const socket: Socket = io(SERVER_URL || 'http://localhost:3001', {
  autoConnect: false,
});
