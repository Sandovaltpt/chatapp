import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth, API_BASE } from './context/AuthContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

function LoadingScreen() {
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

  // Shared state
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [allMessages, setAllMessages] = useState([]); // all messages across rooms
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const socketRef = useRef(null);

  // Setup socket + load initial data when authenticated
  useEffect(() => {
    if (!token) return;

    const socket = io(API_BASE, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => console.log('✅ Socket connected'));
    socket.on('connect_error', err => console.error('Socket error:', err.message));

    // Online users
    socket.on('online_users', ids => setOnlineUserIds(ids));

    // New message in any room
    socket.on('new_message', msg => {
      setAllMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    // Room events from other clients
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

    // Load initial data
    const headers = { Authorization: `Bearer ${token}` };

    // Load rooms
    fetch(`${API_BASE}/api/rooms`, { headers })
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        setRooms(data);
        // Auto-select General room
        const general = data.find(r => r.id === 'general');
        if (general) setCurrentRoom(general);
      })
      .catch(console.error);

    // Load users
    fetch(`${API_BASE}/api/users`, { headers })
      .then(r => r.json())
      .then(data => Array.isArray(data) && setUsers(data))
      .catch(console.error);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  // When selecting a room, emit room_created to other clients if new (handled in Sidebar)
  const handleSelectRoom = (room) => {
    setCurrentRoom(room);
    // Join the socket room
    socketRef.current?.emit('join_room', room.id);
  };

  // Room update handler: also broadcast via socket
  const handleRoomsUpdate = (updater) => {
    setRooms(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Broadcast newly added room
      const added = next.find(r => !prev.find(p => p.id === r.id));
      if (added) socketRef.current?.emit('room_created', added);
      // Broadcast removed room
      const removed = prev.find(r => !next.find(n => n.id === r.id));
      if (removed) socketRef.current?.emit('room_deleted', removed.id);
      return next;
    });
  };

  if (loading) return <LoadingScreen />;

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
