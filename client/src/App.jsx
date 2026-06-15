import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './context/AuthContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

const API_BASE = 'http://localhost:3001';

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
  const [page, setPage] = useState('login'); // 'login' | 'register'
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const socketRef = useRef(null);

  // Socket for online users (shared between Sidebar and ChatWindow)
  useEffect(() => {
    if (!token) return;

    const socket = io(API_BASE, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('online_users', (ids) => {
      setOnlineUserIds(ids);
    });

    socket.on('new_message', (msg) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    // Load initial data
    const headers = { Authorization: `Bearer ${token}` };
    fetch(`${API_BASE}/api/messages`, { headers })
      .then(r => r.json())
      .then(data => Array.isArray(data) && setMessages(data))
      .catch(console.error);

    fetch(`${API_BASE}/api/users`, { headers })
      .then(r => r.json())
      .then(data => Array.isArray(data) && setUsers(data))
      .catch(console.error);

    return () => socket.disconnect();
  }, [token]);

  if (loading) return <LoadingScreen />;

  if (!user) {
    if (page === 'register') {
      return <Register onGoLogin={() => setPage('login')} />;
    }
    return <Login onGoRegister={() => setPage('register')} />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        users={users}
        onlineUserIds={onlineUserIds}
        messages={messages}
      />
      <ChatWindow
        users={users}
        setUsers={setUsers}
        onlineUserIds={onlineUserIds}
        messages={messages}
        setMessages={setMessages}
        socketRef={socketRef}
      />
    </div>
  );
}
