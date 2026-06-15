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

  // Handle new message
  socket.on('send_message', async (data, callback) => {
    try {
      const { type, content, file_url } = data;
      if (!type || !content) return callback?.({ error: 'Datos inválidos' });

      await db.read();
      const dbUser = db.data.users.find(u => u.id === user.id);

      const msg = {
        id: uuidv4(),
        user_id: user.id,
        user_name: user.name,
        avatar_color: dbUser?.avatar_color || '#00a884',
        type,
        content,
        file_url: file_url || null,
        created_at: Date.now(),
      };

      db.data.messages.push(msg);
      await db.write();

      io.emit('new_message', msg);
      callback?.({ success: true, id: msg.id });
    } catch (err) {
      console.error('send_message error:', err);
      callback?.({ error: 'Error al enviar mensaje' });
    }
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
});
