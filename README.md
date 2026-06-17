# 💬 ChatApp

**Aplicación de mensajería en tiempo real estilo WhatsApp**

## 🚀 [→ Abrir ChatApp en vivo](https://chatapp-production-dc55.up.railway.app)

> Funciona en celular y PC. Registrate y chateá al instante.

---

## ✨ Funcionalidades

- 💬 Chat en tiempo real con WebSockets (Socket.io)
- 📷 Envío de imágenes
- 🎙️ Mensajes de voz
- 👥 Múltiples salas de chat
- 🟢 Indicador de usuarios en línea
- 🔐 Registro e inicio de sesión con JWT

## 🛠️ Tecnologías

| Frontend | Backend |
|----------|---------|
| React + Vite | Node.js + Express |
| Socket.io-client | Socket.io |
| CSS puro | JWT + bcrypt |

## 💻 Correr localmente

```bash
# 1. Instalar dependencias
npm run install:all

# 2. Iniciar el backend (terminal 1)
npm run dev:server

# 3. Iniciar el frontend (terminal 2)
npm run dev:client
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
