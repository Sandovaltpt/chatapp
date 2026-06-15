import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authMiddleware } from '../auth.js';

const router = express.Router();

// GET /api/rooms — listar todas las salas
router.get('/rooms', authMiddleware, async (req, res) => {
  try {
    await db.read();
    // Incluir conteo de mensajes por sala
    const rooms = db.data.rooms.map(room => {
      const msgCount = db.data.messages.filter(m => m.room_id === room.id).length;
      const lastMsg = db.data.messages
        .filter(m => m.room_id === room.id)
        .slice(-1)[0];
      return { ...room, message_count: msgCount, last_message: lastMsg || null };
    });
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener salas' });
  }
});

// POST /api/rooms — crear nueva sala
router.post('/rooms', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'El nombre de la sala es requerido' });
    }

    await db.read();

    // Verificar nombre duplicado
    const exists = db.data.rooms.find(r => r.name.toLowerCase() === name.trim().toLowerCase());
    if (exists) {
      return res.status(409).json({ error: 'Ya existe una sala con ese nombre' });
    }

    const room = {
      id: uuidv4(),
      name: name.trim(),
      description: description?.trim() || '',
      created_by: req.user.id,
      created_by_name: req.user.name,
      created_at: Date.now(),
      is_default: false
    };

    db.data.rooms.push(room);
    await db.write();

    res.status(201).json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear sala' });
  }
});

// DELETE /api/rooms/:id — eliminar sala (solo el creador)
router.delete('/rooms/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await db.read();

    const room = db.data.rooms.find(r => r.id === id);
    if (!room) return res.status(404).json({ error: 'Sala no encontrada' });
    if (room.is_default) return res.status(403).json({ error: 'No se puede eliminar la sala General' });
    if (room.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Solo el creador puede eliminar la sala' });
    }

    db.data.rooms = db.data.rooms.filter(r => r.id !== id);
    db.data.messages = db.data.messages.filter(m => m.room_id !== id);
    await db.write();

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar sala' });
  }
});

export default router;
