import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth, API_BASE } from './context/AuthContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

function PantallaCarga() {
  return (
    <div className="loading-screen">
      <div className="spinner" />
      <p className="loading-text">Cargando ChatApp...</p>
    </div>
  );
}

export default function App() {
  const { user, token, loading } = useAuth();
  const [authPage, setAuthPage] = useState('login');

  // Estado compartido
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  // Inicializar mensajes desde caché local (persiste el refresh)
  const [allMessages, setAllMessages] = useState(() => {
    try {
      const cached = localStorage.getItem('chatapp_messages');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const socketRef = useRef(null);
  const currentRoomRef = useRef(null); // ref para acceder al room actual dentro de los handlers del socket

  // Marca de tiempo de última lectura por sala (persiste en localStorage)
  const [readTimestamps, setReadTimestamps] = useState(() => {
    try {
      const saved = localStorage.getItem('chatapp_read');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Mantener ref sincronizada con el room actual (para usarla en handlers del socket)
  useEffect(() => { currentRoomRef.current = currentRoom; }, [currentRoom]);

  // Guardar mensajes en localStorage cada vez que cambian
  useEffect(() => {
    if (!user) {
      localStorage.removeItem('chatapp_messages');
      return;
    }
    try {
      localStorage.setItem('chatapp_messages', JSON.stringify(allMessages.slice(-1000)));
    } catch {
      try {
        localStorage.setItem('chatapp_messages', JSON.stringify(allMessages.slice(-200)));
      } catch { /* nada */ }
    }
  }, [allMessages, user]);

  // Guardar readTimestamps en localStorage
  useEffect(() => {
    if (!user) { localStorage.removeItem('chatapp_read'); return; }
    try { localStorage.setItem('chatapp_read', JSON.stringify(readTimestamps)); } catch { /* nada */ }
  }, [readTimestamps, user]);

  // Configurar socket y cargar datos iniciales al autenticarse
  useEffect(() => {
    if (!token) return;

    const socket = io(API_BASE, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => console.log('✅ Socket conectado'));
    socket.on('connect_error', err => console.error('Error de socket:', err.message));

    // Usuarios en línea
    socket.on('online_users', ids => setOnlineUserIds(ids));

    // Nuevo mensaje en cualquier sala
    socket.on('new_message', msg => {
      setAllMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Si el usuario está viendo esa sala ahora mismo, marcarla como leída
      // Usamos msg.created_at (tiempo servidor) para evitar desfase de reloj cliente/servidor
      if (currentRoomRef.current?.id === msg.room_id) {
        setReadTimestamps(prev => ({ ...prev, [msg.room_id]: msg.created_at }));
      }
    });

    // Eventos de salas desde otros clientes
    socket.on('room_added', room => {
      setRooms(prev => {
        if (prev.find(r => r.id === room.id)) return prev;
        return [...prev, room];
      });
    });

    socket.on('room_removed', roomId => {
      setRooms(prev => prev.filter(r => r.id !== roomId));
      setAllMessages(prev => prev.filter(m => m.room_id !== roomId));
      setCurrentRoom(prev => (prev?.id === roomId ? null : prev));
    });

    // Nuevo usuario registrado: actualizar lista de miembros en tiempo real
    socket.on('user_registered', newUser => {
      setUsers(prev => {
        if (prev.find(u => u.id === newUser.id)) return prev;
        return [...prev, newUser];
      });
    });

    // Cargar datos iniciales
    const headers = { Authorization: `Bearer ${token}` };

    // Cargar salas
    fetch(`${API_BASE}/api/rooms`, { headers })
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        setRooms(data);
        // Seleccionar sala General automáticamente y marcarla como leída (con tiempo servidor)
        const general = data.find(r => r.id === 'general');
        if (general) {
          setCurrentRoom(general);
          // Marcar usando el último mensaje cacheado (tiempo servidor) o 0 si no hay
          setAllMessages(prev => {
            const roomMsgs = prev.filter(m => m.room_id === 'general');
            const lastTime = roomMsgs.length
              ? Math.max(...roomMsgs.map(m => m.created_at))
              : 0;
            setReadTimestamps(ts => ({ ...ts, ['general']: lastTime }));
            return prev;
          });
        }
      })
      .catch(console.error);

    // Cargar usuarios
    fetch(`${API_BASE}/api/users`, { headers })
      .then(r => r.json())
      .then(data => Array.isArray(data) && setUsers(data))
      .catch(console.error);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  // Al seleccionar una sala: unirse al socket y marcar como leída
  // Usamos el created_at del último mensaje (tiempo servidor) para evitar desfase de reloj
  const handleSelectRoom = (room) => {
    setCurrentRoom(room);
    socketRef.current?.emit('join_room', room.id);
    setReadTimestamps(prev => {
      const roomMsgs = allMessages.filter(m => m.room_id === room.id);
      const lastTime = roomMsgs.length
        ? Math.max(...roomMsgs.map(m => m.created_at))
        : Date.now();
      return { ...prev, [room.id]: lastTime };
    });
  };

  // Manejador de actualización de salas: también transmite por socket
  const handleRoomsUpdate = (updater) => {
    setRooms(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Transmitir sala recién agregada
      const added = next.find(r => !prev.find(p => p.id === r.id));
      if (added) socketRef.current?.emit('room_created', added);
      // Transmitir sala eliminada
      const removed = prev.find(r => !next.find(n => n.id === r.id));
      if (removed) socketRef.current?.emit('room_deleted', removed.id);
      return next;
    });
  };

  if (loading) return <PantallaCarga />;

  if (!user) {
    if (authPage === 'register') return <Register onGoLogin={() => setAuthPage('login')} />;
    return <Login onGoRegister={() => setAuthPage('register')} />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        rooms={rooms}
        users={users}
        onlineUserIds={onlineUserIds}
        messages={allMessages}
        currentRoom={currentRoom}
        onSelectRoom={handleSelectRoom}
        onRoomsUpdate={handleRoomsUpdate}
        readTimestamps={readTimestamps}
      />
      <ChatWindow
        currentRoom={currentRoom}
        onlineUserIds={onlineUserIds}
        users={users}
        allMessages={allMessages}
        setAllMessages={setAllMessages}
        socketRef={socketRef}
      />
    </div>
  );
}
