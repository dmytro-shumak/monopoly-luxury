import { io, Socket } from 'socket.io-client';

const URL = import.meta.env.PROD ? undefined : 'http://localhost:3000';

export const socket: Socket = io(URL || 'http://localhost:3000', {
  autoConnect: false, // We'll connect manually when the app starts
});
