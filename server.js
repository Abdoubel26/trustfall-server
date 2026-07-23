import express from "express";
import http from "http";
import { Server } from "socket.io";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config()

const app = express();
const server = http.createServer(app);



const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
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
        socket.roomId = roomId;
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

            activeRooms.set(roomId, { 
            playerChoices: {},
            maxRounds: null, 
            currentRound: 1  
            });

            socket.join(roomId);
            waitingPlayer.join(roomId);

            waitingPlayer.emit("matchFound", { roomId,  });
            socket.emit("matchFound", { roomId,  });

            waitingPlayer = null;
        }
    }); 
    

    socket.on("play", (data) => {
        const { roomId, action } = data;
        const room = activeRooms.get(roomId);

        if (!room) return;

        room.playerChoices[socket.id] = action;

        if (!room.maxRounds) {
        const totalRounds = Math.floor(Math.random() * (10 - 5 + 1)) + 5;
        room.maxRounds = totalRounds;
        
        console.log(`🎯 First action detected. Broadcast maxRounds: ${totalRounds}`);

        io.to(roomId).emit("roomInitialized", { maxRounds: totalRounds });
        }

        console.log(`📝 choice stored: [${socket.id}] -> ${action}`);

        socket.to(roomId).emit("opponentLockedIn");

        const playersWhoActed = Object.keys(room.playerChoices);
        
        if (playersWhoActed.length === 2) {
            console.log(` Both players acted in ${roomId}. Revealing payload.`);
            
            io.to(roomId).emit("revealChoices", {
                choices: room.playerChoices
            });

            room.playerChoices = {};
        }
    });

    socket.on("leaveRoom", ({ roomId }) => {
    socket.leave(roomId);
    socket.to(roomId).emit("opponentLeft");
    });

    socket.on("disconnect", () => {
        console.log(`❌ Disconnected: ${socket.id}`);
        if (socket === waitingPlayer) {
            waitingPlayer = null;
        }

        if (socket.roomId) {
            io.to(socket.roomId).emit("opponentLeft");
            activeRooms.delete(socket.roomId);
        }

    });
});


const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log("🚀 Realtime engine online on port 5000");
});