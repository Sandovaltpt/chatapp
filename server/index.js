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
const isProd = process.env.NODE_ENV === 'production';

const app = express();
const server = createServer(app);

// Asegurar que exista el directorio de subidas
const uploadsDir = join(__dirname, 'uploads');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

// CORS: en producción solo permite el mismo origen
const allowedOrigins = isProd
  ? [process.env.FRONTEND_URL || '*']
  : '*';

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Rutas API
app.use('/api/auth', authRouter);
app.use('/api', messagesRouter);
app.use('/api', roomsRouter);
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// En producción: servir el frontend de React (build de Vite)
const clientDist = join(__dirname, '../client/dist');
if (isProd && existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // Cualquier ruta que no sea /api ni /uploads devuelve el index.html de React
  app.get('*', (req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
  console.log('📦 Sirviendo frontend desde:', clientDist);
}

// Socket.io
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 25e6
});

// Exponer io a las rutas (para emitir eventos desde auth, etc.)
app.set('io', io);

// Middleware de autenticación para sockets
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Autenticación requerida'));
  const payload = verifyToken(token);
  if (!payload) return next(new Error('Token inválido'));
  socket.user = payload;
  next();
});

// Registro de usuarios en línea: socketId -> { id, name }
const onlineUsers = new Map();

function getOnlineUserIds() {
  return [...new Set([...onlineUsers.values()].map(u => u.id))];
}

io.on('connection', (socket) => {
  const user = socket.user;
  console.log(`✅ ${user.name} conectado (${socket.id})`);

  onlineUsers.set(socket.id, { id: user.id, name: user.name });
  io.emit('online_users', getOnlineUserIds());

  // Unirse a un canal de sala
  socket.on('join_room', (roomId) => {
    const currentRooms = [...socket.rooms].filter(r => r !== socket.id);
    currentRooms.forEach(r => socket.leave(r));
    socket.join(roomId);
    console.log(`${user.name} se unió a la sala: ${roomId}`);
  });

  // Manejar nuevo mensaje en una sala
  socket.on('send_message', async (data, callback) => {
    try {
      const { type, content, file_url, room_id = 'general' } = data;
      if (!type || !content) return callback?.({ error: 'Datos inválidos' });

      await db.read();
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

      // Emitir a TODOS los clientes conectados (no solo los de la sala)
      // Esto permite que el badge de no leídos funcione en cualquier sala
      io.emit('new_message', msg);
      callback?.({ success: true, id: msg.id });
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
      callback?.({ error: 'Error al enviar mensaje' });
    }
  });

  socket.on('room_created', (room) => { io.emit('room_added', room); });
  socket.on('room_deleted', (roomId) => { io.emit('room_removed', roomId); });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    io.emit('online_users', getOnlineUserIds());
    console.log(`❌ ${user.name} desconectado`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 ChatApp corriendo en el puerto ${PORT}`);
  if (isProd) {
    console.log(`   Producción: el frontend se sirve desde el mismo servidor`);
  } else {
    console.log(`   Desarrollo: http://localhost:${PORT}`);
    console.log(`   Frontend:   http://localhost:5173`);
  }
});
