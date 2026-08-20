import { Server, Socket } from "socket.io";
import { createServer } from "http";

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

io.on("connection", (socket: Socket) => {
  console.log(`New client connected: ${socket.id}`);

  // When client provides their sessionId (for reconnecting)
  socket.on("auth", (data: { sessionId: string }) => {
    console.log(`Client authenticated with sessionId: ${data.sessionId}`);
    // TODO: implement reconnect logic
    
    // Join a room for testing
    socket.join("lobby-test");
    socket.emit("auth_success", { status: "connected" });
  });

  socket.on("create_room", () => {
    // TODO
  });

  socket.on("join_room", (roomId: string) => {
    // TODO
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    // TODO: Mark player as disconnected in their active room
  });
});

httpServer.listen(PORT, () => {
  console.log(`Monopoly Deal Server running on port ${PORT}`);
});
