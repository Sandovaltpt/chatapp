import express from 'express';
import multer from 'multer';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authMiddleware } from '../auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    let ext = extname(file.originalname);
    if (!ext) {
      if (file.mimetype.includes('audio')) ext = '.webm';
      else if (file.mimetype.includes('image')) ext = '.jpg';
    }
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/mpeg'
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de archivo no permitido'));
  }
});

// GET /api/messages?room_id=xxx
router.get('/messages', authMiddleware, async (req, res) => {
  try {
    const { room_id = 'general' } = req.query;
    await db.read();

    // Verify room exists
    const room = db.data.rooms.find(r => r.id === room_id);
    if (!room) return res.status(404).json({ error: 'Sala no encontrada' });

    const messages = db.data.messages
      .filter(m => m.room_id === room_id)
      .slice(-200);

    const enriched = messages.map(msg => {
      const user = db.data.users.find(u => u.id === msg.user_id);
      return { ...msg, user_name: user?.name || 'Unknown', avatar_color: user?.avatar_color || '#00a884' };
    });

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

// GET /api/users
router.get('/users', authMiddleware, async (req, res) => {
  try {
    await db.read();
    const safeUsers = db.data.users.map(({ password_hash, ...u }) => u);
    res.json(safeUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/upload
router.post('/upload', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al subir archivo' });
  }
});

export default router;
