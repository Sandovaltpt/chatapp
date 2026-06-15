import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from './db.js';
import { verifyToken } from './auth.js';
import authRouter from './routes/auth.js';
import messagesRouter from './routes/messages.js';
import roomsRouter from './routes/rooms.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);

// Ensure uploads dir exists
const uploadsDir = join(__dirname, 'uploads');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

// Middleware
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRouter);
app.use('/api', messagesRouter);
app.use('/api', roomsRouter);
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Socket.io
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 25e6
});

// Auth middleware for sockets
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  const payload = verifyToken(token);
  if (!payload) return next(new Error('Invalid token'));
  socket.user = payload;
  next();
});

// Track online users: socketId -> { id, name }
const onlineUsers = new Map();

function getOnlineUserIds() {
  return [...new Set([...onlineUsers.values()].map(u => u.id))];
}

io.on('connection', (socket) => {
  const user = socket.user;
  console.log(`✅ ${user.name} connected (${socket.id})`);

  onlineUsers.set(socket.id, { id: user.id, name: user.name });
  io.emit('online_users', getOnlineUserIds());

  // Join a room channel
  socket.on('join_room', (roomId) => {
    // Leave all previous rooms (except socket.io default)
    const currentRooms = [...socket.rooms].filter(r => r !== socket.id);
    currentRooms.forEach(r => socket.leave(r));
    socket.join(roomId);
    console.log(`${user.name} joined room: ${roomId}`);
  });

  // Handle new message in a room
  socket.on('send_message', async (data, callback) => {
    try {
      const { type, content, file_url, room_id = 'general' } = data;
      if (!type || !content) return callback?.({ error: 'Datos inválidos' });

      await db.read();

      // Verify room exists
      const room = db.data.rooms.find(r => r.id === room_id);
      if (!room) return callback?.({ error: 'Sala no encontrada' });

      const dbUser = db.data.users.find(u => u.id === user.id);

      const msg = {
        id: uuidv4(),
        user_id: user.id,
        user_name: user.name,
        avatar_color: dbUser?.avatar_color || '#00a884',
        type,
        content,
        file_url: file_url || null,
        room_id,
        created_at: Date.now(),
      };

      db.data.messages.push(msg);
      await db.write();

      // Broadcast to everyone in that room
      io.to(room_id).emit('new_message', msg);
      callback?.({ success: true, id: msg.id });
    } catch (err) {
      console.error('send_message error:', err);
      callback?.({ error: 'Error al enviar mensaje' });
    }
  });

  // Room created by a user — broadcast to all
  socket.on('room_created', (room) => {
    io.emit('room_added', room);
  });

  // Room deleted by creator
  socket.on('room_deleted', (roomId) => {
    io.emit('room_removed', roomId);
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    io.emit('online_users', getOnlineUserIds());
    console.log(`❌ ${user.name} disconnected`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ChatApp Server running!`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://0.0.0.0:${PORT}`);
  console.log(`\n   Para acceder desde otra PC:`);
  console.log(`   Obtén tu IP con: ipconfig`);
  console.log(`   Luego accede a: http://TU_IP:${PORT}`);
});
