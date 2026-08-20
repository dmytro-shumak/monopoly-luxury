import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3001";

const player1 = io(SERVER_URL);
const player2 = io(SERVER_URL);

let roomId;

player1.on("connect", () => {
  console.log("Player 1 connected");
  // Create room
  player1.emit("create_room", { sessionId: "p1-session", name: "Alice" });
});

player1.on("room_joined", (data) => {
  console.log("Player 1 joined room:", data);
  roomId = data.roomId;
  
  // Connect player 2
  player2.emit("join_room", { roomId, sessionId: "p2-session", name: "Bob" });
});

player2.on("room_joined", (data) => {
  console.log("Player 2 joined room:", data);
  
  // Start game
  player1.emit("start_game");
});

player1.on("room_state", (state) => {
  console.log("\n--- Player 1 State Update ---");
  const p1 = Object.values(state.players).find(p => p.name === "Alice");
  const p2 = Object.values(state.players).find(p => p.name === "Bob");
  console.log(`Alice Hand: ${p1?.hand.length} cards (${p1?.hand[0]})`);
  if (p2) {
    console.log(`Bob Hand: ${p2.hand.length} cards (${p2.hand[0]})`);
  }
});

player2.on("room_state", (state) => {
  console.log("\n--- Player 2 State Update ---");
  const p1 = Object.values(state.players).find(p => p.name === "Alice");
  const p2 = Object.values(state.players).find(p => p.name === "Bob");
  if (p1) {
    console.log(`Alice Hand: ${p1.hand.length} cards (${p1.hand[0]})`);
  }
  console.log(`Bob Hand: ${p2?.hand.length} cards (${p2?.hand[0]})`);
});

setTimeout(() => {
  console.log("Test finished");
  player1.disconnect();
  player2.disconnect();
  process.exit(0);
}, 2000);
