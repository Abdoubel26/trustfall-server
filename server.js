import express from "express";
import http from "http";
import { Server } from "socket.io";
import crypto from "crypto";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

let waitingPlayer = null;
const activeRooms = new Map();

io.on("connection", (socket) => {
    console.log(`🔌 Connected: ${socket.id}`);

    socket.on("joinRoom", (data) => {
        const { roomId } = data;
        socket.join(roomId);
        console.log(`📥 Player ${socket.id} checked into room: ${roomId}`);
    });

    socket.on("match", () => {
        if (waitingPlayer && waitingPlayer.id === socket.id) return;

        if (!waitingPlayer) {
            waitingPlayer = socket;
            console.log(`⏳ Player ${socket.id} entered matchmaking queue.`);
        } else {
            const roomId = crypto.randomUUID();
            console.log(`⚡ Creating Room ${roomId} for ${waitingPlayer.id} and ${socket.id}`);

            activeRooms.set(roomId, { playerChoices: {} });

            socket.join(roomId);
            waitingPlayer.join(roomId);

            waitingPlayer.emit("matchFound", { roomId, opponentId: socket.id });
            socket.emit("matchFound", { roomId, opponentId: waitingPlayer.id });

            waitingPlayer = null;
        }
    }); 

    if (!rooms.has(roomId)) {
      const targetMatchLength = Math.floor(Math.random() * 4) + 4; // 4 to 7 rounds
      rooms.set(roomId, {
        players: [socket.id],
        totalRounds: targetMatchLength,
        choices: {}
      });
    } else {
      rooms.get(roomId).players.push(socket.id);
    }

    const roomData = rooms.get(roomId);



    if (roomData.players.length === 2) {
      io.to(roomId).emit("roomReady", { 
        totalRounds: roomData.totalRounds 
      });
    }
  });

    socket.on("play", (data) => {
        const { roomId, action } = data;
        const room = activeRooms.get(roomId);

        if (!room) return;

        room.playerChoices[socket.id] = action;
        console.log(`📝 choice stored: [${socket.id}] -> ${action}`);


        socket.to(roomId).emit("opponentLockedIn");

        const playersWhoActed = Object.keys(room.playerChoices);
        
        if (playersWhoActed.length === 2) {
            console.log(`🔓 Both players acted in ${roomId}. Revealing payload.`);
            
            io.to(roomId).emit("revealChoices", {
                choices: room.playerChoices
            });

            room.playerChoices = {};
        }
    });

    socket.on("disconnect", () => {
        console.log(`❌ Disconnected: ${socket.id}`);
        if (socket === waitingPlayer) {
            waitingPlayer = null;
        }

        for (const [roomId, roomData] of activeRooms.entries()) {
            if (roomData.playerChoices && Object.prototype.hasOwnProperty.call(roomData.playerChoices, socket.id)) {
                socket.to(roomId).emit("opponentDisconnected");
                activeRooms.delete(roomId);
                break;
            }
        }
    });


server.listen(5000, () => {
    console.log("🚀 Realtime engine online on port 5000");
});