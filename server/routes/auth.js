import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { hashPassword, verifyPassword, generateToken } from '../auth.js';

const router = express.Router();

const AVATAR_COLORS = [
  '#00a884', '#25d366', '#128c7e', '#075e54',
  '#34b7f1', '#ab68ff', '#f97316', '#ec4899',
  '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'
];

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name?.trim() || !email?.trim() || !phone?.trim() || !password) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    await db.read();

    const existingName = db.data.users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (existingName) {
      return res.status(409).json({ error: 'El nombre de usuario ya está en uso' });
    }
    const existingEmail = db.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingEmail) {
      return res.status(409).json({ error: 'El correo electrónico ya está registrado' });
    }

    const password_hash = await hashPassword(password);
    const id = uuidv4();
    const avatar_color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const newUser = { id, name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), password_hash, avatar_color, created_at: Date.now() };
    db.data.users.push(newUser);
    await db.write();

    const { password_hash: _, ...safeUser } = newUser;
    const token = generateToken(safeUser);

    // Notificar a todos los clientes conectados que hay un nuevo usuario
    const io = req.app.get('io');
    if (io) io.emit('user_registered', safeUser);

    res.status(201).json({ token, user: safeUser });
  } catch (err) {
    console.error('Error al registrar usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name?.trim() || !password) {
      return res.status(400).json({ error: 'Nombre y contraseña son requeridos' });
    }

    await db.read();
    const user = db.data.users.find(u => u.name.toLowerCase() === name.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const { password_hash, ...safeUser } = user;
    const token = generateToken(safeUser);

    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Error al iniciar sesión:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
