import React, {
  useState, useEffect, useRef, useCallback
} from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import MessageBubble, { formatDate } from './MessageBubble.jsx';
import VoiceRecorder from './VoiceRecorder.jsx';
import ImageUpload from './ImageUpload.jsx';
import HighOrLow from './HighOrLow.jsx';

function groupMessagesByDate(messages) {
  const groups = [];
  let lastDate = null;
  messages.forEach(msg => {
    const ts = typeof msg.created_at === 'number' && msg.created_at < 1e12
      ? msg.created_at * 1000
      : msg.created_at;
    const d = new Date(ts);
    const dateStr = d.toDateString();
    if (dateStr !== lastDate) {
      groups.push({ type: 'divider', label: formatDate(ts), key: `div-${dateStr}` });
      lastDate = dateStr;
    }
    groups.push({ type: 'message', message: msg, key: msg.id });
  });
  return groups;
}

// Pantalla cuando no hay sala seleccionada
function SinSalaSeleccionada() {
  return (
    <div className="no-room-selected">
      <div className="no-room-icon">💬</div>
      <h2>Bienvenido a ChatApp</h2>
      <p>Selecciona una sala del panel izquierdo para empezar a chatear, o crea una nueva.</p>
    </div>
  );
}

export default function ChatWindow({ currentRoom, onlineUserIds, users, allMessages, setAllMessages, socketRef }) {
  const { user, token, API_BASE } = useAuth();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const prevRoomRef = useRef(null);

  // Filtrar mensajes de la sala actual
  const roomMessages = currentRoom
    ? allMessages.filter(m => m.room_id === currentRoom.id)
    : [];

  // Cargar mensajes al cambiar de sala
  useEffect(() => {
    if (!currentRoom || !token) return;
    if (prevRoomRef.current === currentRoom.id) return;
    prevRoomRef.current = currentRoom.id;

    // Unirse a la sala de socket
    socketRef?.current?.emit('join_room', currentRoom.id);

    // Obtener mensajes de la sala desde el servidor
    fetch(`${API_BASE}/api/messages?room_id=${currentRoom.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        // Combinar: agregar mensajes obtenidos a allMessages (evitar duplicados)
        setAllMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          const newMsgs = data.filter(m => !ids.has(m.id));
          return [...prev, ...newMsgs];
        });
      })
      .catch(console.error);
  }, [currentRoom?.id, token]);

  // Desplazamiento automático con nuevos mensajes en la sala actual
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomMessages.length]);

  // Ajuste automático del área de texto
  const handleTextChange = (e) => {
    setText(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  };

  const sendMessage = useCallback((payload) => {
    const socket = socketRef?.current;
    if (!socket?.connected) { alert('Sin conexión al servidor.'); return; }
    if (!currentRoom) return;
    setSending(true);
    socket.emit('send_message', { ...payload, room_id: currentRoom.id }, (ack) => {
      setSending(false);
      if (ack?.error) console.error('Error al enviar:', ack.error);
    });
  }, [socketRef, currentRoom]);

  const handleSendText = () => {
    const content = text.trim();
    if (!content || sending) return;
    sendMessage({ type: 'text', content });
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); }
  };

  const handleVoiceRecorded = useCallback(p => sendMessage(p), [sendMessage]);
  const handleImageUploaded = useCallback(p => sendMessage(p), [sendMessage]);

  if (!currentRoom) return (
    <div className="chat-area"><div className="chat-bg" /><SinSalaSeleccionada /></div>
  );

  const groups = groupMessagesByDate(roomMessages);
  const showMic = !text.trim();

  return (
    <div className="chat-area">
      <div className="chat-bg" />

      {/* Minijuego High or Low (overlay sobre el chat) */}
      <HighOrLow socket={socketRef?.current} currentRoom={currentRoom} />

      {/* Encabezado */}
      <div className="chat-header">
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'linear-gradient(135deg, #00a884, #075e54)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0
        }}>
          💬
        </div>
        <div className="chat-header-info">
          <h2># {currentRoom.name}</h2>
          <p>
            {currentRoom.description && <span style={{ color: 'var(--text-muted)' }}>{currentRoom.description} · </span>}
            <span className="online-count">{onlineUserIds.length} en línea</span>
            {' · '}{users.length} miembros
          </p>
        </div>
      </div>

      {/* Mensajes */}
      <div className="messages-container" id="messages-list">
        {roomMessages.length === 0 && (
          <div className="empty-chat">
            <div className="empty-chat-icon">🏠</div>
            <h3>¡Bienvenido a #{currentRoom.name}!</h3>
            <p>Sé el primero en enviar un mensaje. Puedes escribir texto, imágenes o notas de voz.</p>
          </div>
        )}

        {groups.map(item => {
          if (item.type === 'divider') {
            return (
              <div key={item.key} className="date-divider">
                <span>{item.label}</span>
              </div>
            );
          }
          const msg = item.message;
          const isOwn = msg.user_id === user?.id;
          const msgIdx = roomMessages.findIndex(m => m.id === msg.id);
          const prevMsg = roomMessages[msgIdx - 1];
          const showAvatar = !isOwn && (!prevMsg || prevMsg.user_id !== msg.user_id);

          return (
            <MessageBubble
              key={item.key}
              message={msg}
              isOwn={isOwn}
              showAvatar={showAvatar}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Campo de entrada */}
      <div className="input-area">
        <div className="input-bar">
          <ImageUpload onUploaded={handleImageUploaded} disabled={sending} />
          <div id="hol-btn-slot" />
          <textarea
            ref={textareaRef}
            id="message-input"
            className="msg-textarea"
            placeholder={`Escribe un mensaje en #${currentRoom.name}`}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={sending}
          />
          {showMic ? (
            <VoiceRecorder onRecorded={handleVoiceRecorded} disabled={sending} />
          ) : (
            <button id="send-message-btn" className="send-btn" onClick={handleSendText} disabled={sending} title="Enviar">
              ➤
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
