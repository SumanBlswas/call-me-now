const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// A lightweight mapping of { userId -> socketId }
const users = new Map();

io.on("connection", (socket) => {
  console.log("⚡ A device connected:", socket.id);

  // 1. Device registers their online status
  socket.on("register", (data) => {
    // data = { userId: "uuid-1234", phone: "+91..." }
    if (data.userId) {
      users.set(data.userId, socket.id);
      console.log(`👤 User registered: ${data.userId} -> Socket: ${socket.id}`);

      // Let everyone know this person is online (great for updating contact lists)
      io.emit("peer_online", data.userId);
    }
  });

  // 2. The core Matchmaker: passing call signaling back and forth
  socket.on("signal", (payload) => {
    // payload = { targetId: "target-uuid", type: "call-offer", sdp: ..., fromId: "my-uuid", fromName: "Suman" }
    const targetSocketId = users.get(payload.targetId);

    if (targetSocketId) {
      // Forward the signal to exactly one person
      io.to(targetSocketId).emit("signal", payload);
      console.log(
        `✉️ Signal [${payload.type}] sent from ${payload.fromId} -> ${payload.targetId}`,
      );
    } else {
      console.log(`❌ Signal failed: User ${payload.targetId} is offline`);
      // You could send an ack back to caller here saying "User offline"
    }
  });

  // 3. User closes app / loses Wi-Fi
  socket.on("disconnect", () => {
    console.log("❌ Device disconnected:", socket.id);
    let disconnectedUserId = null;

    // Find who disconnected and remove them
    for (const [userId, sId] of users.entries()) {
      if (sId === socket.id) {
        disconnectedUserId = userId;
        users.delete(userId);
        break;
      }
    }

    if (disconnectedUserId) {
      io.emit("peer_offline", disconnectedUserId);
    }
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Srot Global Signaling Server running on port ${PORT}`);
});
