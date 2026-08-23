import { Server, Socket } from "socket.io";
import { createServer } from "http";
import { GameRoom } from "./core/room.js";
import type { GameState } from "./models/types.js";

const PORT = process.env.PORT || 3001;

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200);
    res.end("OK");
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

const io = new Server(httpServer, {
  cors: {
    origin: "*", // allow all for dev
    methods: ["GET", "POST"]
  }
});

// Global state
const rooms = new Map<string, GameRoom>();
const socketToSession = new Map<string, { sessionId: string, roomId: string, playerId: string }>();

// Helper to broadcast state with filtered hands
const broadcastState = (roomId: string) => {
  const room = rooms.get(roomId);
  if (!room) return;

  const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
  if (!socketsInRoom) return;

  for (const socketId of socketsInRoom) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;

    const sessionInfo = socketToSession.get(socketId);
    const observerPlayerId = sessionInfo?.playerId;

    // Deep clone state to filter hand
    const stateToSend: GameState = JSON.parse(JSON.stringify(room.state));
    
    // Hide other players' hands
    for (const [pId, player] of Object.entries(stateToSend.players)) {
      if (pId !== observerPlayerId) {
        player.hand = player.hand.map(() => "hidden");
      }
    }

    socket.emit("room_state", stateToSend);
  }
};

io.on("connection", (socket: Socket) => {
  console.log(`New client connected: ${socket.id}`);

  // Helpers for socket
  const getPlayerContext = () => {
    const info = socketToSession.get(socket.id);
    if (!info) return null;
    const room = rooms.get(info.roomId);
    if (!room) return null;
    return { ...info, room };
  };

  const handleError = (error: string | undefined) => {
    if (error) socket.emit("error", { message: error });
  };

  socket.on("create_room", (data: { sessionId: string; name: string }) => {
    const roomId = `room_${Math.random().toString(36).substring(2, 6)}`;
    const room = new GameRoom(roomId, () => broadcastState(roomId));
    rooms.set(roomId, room);

    const res = room.join(data.sessionId, data.name);
    if (res.success && res.playerId) {
      socket.join(roomId);
      socketToSession.set(socket.id, { sessionId: data.sessionId, roomId, playerId: res.playerId });
      room.connectPlayer(res.playerId);
      socket.emit("room_joined", { roomId, playerId: res.playerId });
      broadcastState(roomId);
    } else {
      handleError(res.error);
    }
  });

  socket.on("join_room", (data: { roomId: string; sessionId: string; name: string }) => {
    const room = rooms.get(data.roomId);
    if (!room) {
      handleError("Room not found");
      return;
    }

    const res = room.join(data.sessionId, data.name);
    if (res.success && res.playerId) {
      socket.join(data.roomId);
      socketToSession.set(socket.id, { sessionId: data.sessionId, roomId: data.roomId, playerId: res.playerId });
      room.connectPlayer(res.playerId);
      socket.emit("room_joined", { roomId: data.roomId, playerId: res.playerId });
      broadcastState(data.roomId);
    } else {
      handleError(res.error);
    }
  });

  socket.on("start_game", () => {
    const ctx = getPlayerContext();
    if (!ctx) return;
    const res = ctx.room.startGame(ctx.playerId);
    handleError(res.error);
  });

  socket.on("move_property", ({ cardId, toColor }: { cardId: string; toColor: string }) => {
    const ctx = getPlayerContext();
    if (!ctx) return;
    const res = ctx.room.moveProperty(ctx.playerId, cardId, toColor);
    handleError(res.error);
  });

  socket.on("play_card", (data: { cardId: string; targetId?: string; propertyColor?: string; modifierCardId?: string; payload?: any }) => {
    const ctx = getPlayerContext();
    if (!ctx) return;
    const options: any = {};
    if (data.targetId) options.targetId = data.targetId;
    if (data.propertyColor) options.propertyColor = data.propertyColor;
    if (data.modifierCardId) options.modifierCardId = data.modifierCardId;
    if (data.payload) options.payload = data.payload;
    const res = ctx.room.playCard(ctx.playerId, data.cardId, options);
    handleError(res.error);
  });

  socket.on("react_jsn", (data: { cardId: string }) => {
    const ctx = getPlayerContext();
    if (!ctx) return;
    const res = ctx.room.reactJustSayNo(ctx.playerId, data.cardId);
    handleError(res.error);
  });

  socket.on("pay_debt", (data: { assetIds: string[] }) => {
    const ctx = getPlayerContext();
    if (!ctx) return;
    const res = ctx.room.payDebt(ctx.playerId, data.assetIds);
    handleError(res.error);
  });

  socket.on("discard", (data: { cardIds: string[] }) => {
    const ctx = getPlayerContext();
    if (!ctx) return;
    const res = ctx.room.discardExcess(ctx.playerId, data.cardIds);
    handleError(res.error);
  });

  socket.on("end_turn", () => {
    const ctx = getPlayerContext();
    if (!ctx) return;
    const res = ctx.room.endTurn(ctx.playerId);
    handleError(res.error);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    const info = socketToSession.get(socket.id);
    if (info) {
      const room = rooms.get(info.roomId);
      if (room) {
        room.disconnectPlayer(info.playerId);
      }
      socketToSession.delete(socket.id);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Monopoly Deal Server running on port ${PORT}`);
});
