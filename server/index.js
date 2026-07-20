// Ranvo signaling server — Socket.IO
// -----------------------------------
// Responsibilities:
//   • Health endpoint at GET /healthz
//   • Match two waiting sockets into a private room
//   • Relay WebRTC signaling: offer / answer / ice-candidate
//   • Relay text chat messages inside the room
//   • Handle "next" (leave current, requeue) and disconnect cleanup
//   • Broadcast a rough online counter
//
// It never sees media — media flows peer-to-peer over WebRTC (with STUN/TURN).

import http from "node:http";
import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";

const PORT = Number(process.env.PORT || 3001);

// Comma-separated list of allowed origins (browser Origins).
// Example: CORS_ORIGIN="https://chat.example.com,https://www.example.com"
// Use "*" to allow all origins (fine during development).
const CORS_ORIGIN = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();
app.use(cors({ origin: CORS_ORIGIN.includes("*") ? true : CORS_ORIGIN }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), online: io?.engine?.clientsCount ?? 0 });
});

app.get("/", (_req, res) => {
  res.type("text/plain").send("Ranvo signaling server. Connect via Socket.IO at /socket.io/");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN.includes("*") ? true : CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: false,
  },
  // Allow websocket + polling fallback (works well behind Nginx).
  transports: ["websocket", "polling"],
});

/**
 * State.
 *   waiting  — FIFO queue of socket ids searching for a partner
 *   partners — socketId -> { peerId, room }
 */
const waiting = [];
const partners = new Map();

function broadcastOnline() {
  io.emit("online-count", io.engine.clientsCount);
}

function removeFromQueue(socketId) {
  const i = waiting.indexOf(socketId);
  if (i !== -1) waiting.splice(i, 1);
}

function unpair(socketId, notifyPeer) {
  const info = partners.get(socketId);
  if (!info) return;
  partners.delete(socketId);
  partners.delete(info.peerId);
  const peerSocket = io.sockets.sockets.get(info.peerId);
  if (peerSocket) {
    peerSocket.leave(info.room);
    if (notifyPeer) peerSocket.emit("peer-left");
  }
  const self = io.sockets.sockets.get(socketId);
  if (self) self.leave(info.room);
}

function tryMatch(socketId) {
  // Never pair with self, never pair someone who's already paired.
  if (partners.has(socketId)) return;

  // Find first waiting peer that is not us and is still connected.
  let partnerId = null;
  while (waiting.length > 0) {
    const candidate = waiting.shift();
    if (candidate === socketId) continue;
    if (!io.sockets.sockets.get(candidate)) continue; // gone
    if (partners.has(candidate)) continue; // already paired
    partnerId = candidate;
    break;
  }

  if (!partnerId) {
    // No partner available — enqueue.
    if (!waiting.includes(socketId)) waiting.push(socketId);
    io.sockets.sockets.get(socketId)?.emit("waiting");
    return;
  }

  const room = `room-${randomUUID()}`;
  const a = io.sockets.sockets.get(socketId);
  const b = io.sockets.sockets.get(partnerId);
  if (!a || !b) {
    // One side vanished — retry.
    if (a && !waiting.includes(socketId)) waiting.push(socketId);
    if (b && !waiting.includes(partnerId)) waiting.push(partnerId);
    return;
  }

  a.join(room);
  b.join(room);
  partners.set(socketId, { peerId: partnerId, room });
  partners.set(partnerId, { peerId: socketId, room });

  // The first-arriving socket in the queue becomes the initiator.
  a.emit("matched", { room, initiator: true, peer: partnerId });
  b.emit("matched", { room, initiator: false, peer: socketId });
}

io.on("connection", (socket) => {
  broadcastOnline();

  socket.on("find", () => {
    // Reset any existing pairing before searching again.
    unpair(socket.id, true);
    removeFromQueue(socket.id);
    tryMatch(socket.id);
  });

  socket.on("next", () => {
    unpair(socket.id, true);
    removeFromQueue(socket.id);
    tryMatch(socket.id);
  });

  socket.on("leave", () => {
    unpair(socket.id, true);
    removeFromQueue(socket.id);
  });

  // ── Signaling relays. We trust the "room" only if the sender is in it. ──
  const inRoom = (room) => room && socket.rooms.has(room);

  socket.on("offer", ({ room, sdp }) => {
    if (!inRoom(room)) return;
    socket.to(room).emit("offer", { sdp });
  });

  socket.on("answer", ({ room, sdp }) => {
    if (!inRoom(room)) return;
    socket.to(room).emit("answer", { sdp });
  });

  socket.on("ice-candidate", ({ room, candidate }) => {
    if (!inRoom(room)) return;
    socket.to(room).emit("ice-candidate", { candidate });
  });

  socket.on("chat-message", ({ room, text }) => {
    if (!inRoom(room)) return;
    const clean = String(text ?? "").slice(0, 2000);
    if (!clean) return;
    socket.to(room).emit("chat-message", { text: clean });
  });

  socket.on("disconnect", () => {
    unpair(socket.id, true);
    removeFromQueue(socket.id);
    broadcastOnline();
  });
});

server.listen(PORT, () => {
  console.log(`[ranvo-signaling] listening on :${PORT}`);
  console.log(`[ranvo-signaling] cors origin: ${CORS_ORIGIN.join(", ") || "(none)"}`);
});
