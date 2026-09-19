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
const playerActiveSocket = new Map<string, string>(); // playerId -> current active socket.id

// Helper to broadcast state with filtered hands
const broadcastState = (roomId: string) => {
  const room = rooms.get(roomId);
  if (!room) return;

  const sockets = new Set<string>();
  const roomSockets = io.sockets.adapter.rooms.get(room.state.roomId);
  if (roomSockets) {
    for (const s of roomSockets) sockets.add(s);
  }
  if (room.state.gameId) {
    const gameSockets = io.sockets.adapter.rooms.get(room.state.gameId);
    if (gameSockets) {
      for (const s of gameSockets) sockets.add(s);
    }
  }
  if (sockets.size === 0) return;

  for (const socketId of sockets) {
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
      playerActiveSocket.set(res.playerId, socket.id);
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
      // Join socket rooms for both canonical roomId and gameId if active
      socket.join(room.state.roomId);
      if (room.state.gameId) {
        socket.join(room.state.gameId);
      }
      socketToSession.set(socket.id, { sessionId: data.sessionId, roomId: room.state.roomId, playerId: res.playerId });
      playerActiveSocket.set(res.playerId, socket.id);
      room.connectPlayer(res.playerId);
      socket.emit("room_joined", { roomId: room.state.roomId, playerId: res.playerId });
      broadcastState(room.state.roomId);
    } else {
      handleError(res.error);
    }
  });

  const safeAction = (actionName: string, fn: () => { error?: string }) => {
    try {
      const res = fn();
      handleError(res.error);
    } catch (err: any) {
      console.error(`Error in ${actionName}:`, err);
      handleError(err?.message || "Internal server error");
    }
  };

  socket.on("start_game", () => {
    const ctx = getPlayerContext();
    if (!ctx) return;
    safeAction("start_game", () => {
      const res = ctx.room.startGame(ctx.playerId);
      if (res.success && ctx.room.state.gameId) {
        rooms.set(ctx.room.state.gameId, ctx.room);
      }
      return res;
    });
  });

  socket.on("move_property", ({ cardId, toColor }: { cardId: string; toColor: string }) => {
    const ctx = getPlayerContext();
    if (!ctx) return;
    safeAction("move_property", () => ctx.room.moveProperty(ctx.playerId, cardId, toColor));
  });

  socket.on("play_card", (data: { cardId: string; targetId?: string; propertyColor?: string; modifierCardId?: string; payload?: any; targetSetCardId?: string }) => {
    const ctx = getPlayerContext();
    if (!ctx) return;
    const options: any = {};
    if (data.targetId) options.targetId = data.targetId;
    if (data.propertyColor) options.propertyColor = data.propertyColor;
    if (data.modifierCardId) options.modifierCardId = data.modifierCardId;
    if (data.payload) options.payload = data.payload;
    if (data.targetSetCardId) options.targetSetCardId = data.targetSetCardId;
    safeAction("play_card", () => ctx.room.playCard(ctx.playerId, data.cardId, options));
  });

  socket.on("react_jsn", (data: { cardId: string }) => {
    const ctx = getPlayerContext();
    if (!ctx) return;
    safeAction("react_jsn", () => ctx.room.reactJustSayNo(ctx.playerId, data.cardId));
  });

  socket.on("pass_reaction", () => {
    const ctx = getPlayerContext();
    if (!ctx) return;
    safeAction("pass_reaction", () => ctx.room.passReaction(ctx.playerId));
  });

  socket.on("pay_debt", (data: { assetIds: string[]; options?: any }) => {
    const ctx = getPlayerContext();
    if (!ctx) return;
    safeAction("pay_debt", () => ctx.room.payDebt(ctx.playerId, data.assetIds, data?.options));
  });

  socket.on("discard", (data: { cardIds: string[] }) => {
    const ctx = getPlayerContext();
    if (!ctx) return;
    safeAction("discard", () => ctx.room.discardExcess(ctx.playerId, data.cardIds));
  });

  socket.on("end_turn", () => {
    const ctx = getPlayerContext();
    if (!ctx) return;
    safeAction("end_turn", () => ctx.room.endTurn(ctx.playerId));
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    const info = socketToSession.get(socket.id);
    if (info) {
      socketToSession.delete(socket.id);
      // Only disconnect the player if this closing socket is their current active socket
      if (playerActiveSocket.get(info.playerId) === socket.id) {
        playerActiveSocket.delete(info.playerId);
        const room = rooms.get(info.roomId);
        if (room) {
          room.disconnectPlayer(info.playerId);
        }
      }
    }
  });
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception in server:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection in server:", reason);
});

httpServer.listen(PORT, () => {
  console.log(`Monopoly Deal Server running on port ${PORT}`);
});
