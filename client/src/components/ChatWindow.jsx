import React, {
  useState, useEffect, useRef, useCallback
} from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext.jsx';
import MessageBubble, { formatDate } from './MessageBubble.jsx';
import VoiceRecorder from './VoiceRecorder.jsx';
import ImageUpload from './ImageUpload.jsx';

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

export default function ChatWindow({ users, onlineUserIds, messages, socketRef }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
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
    if (!socket?.connected) {
      alert('Sin conexión al servidor. Intentá de nuevo.');
      return;
    }
    setSending(true);
    socket.emit('send_message', payload, (ack) => {
      setSending(false);
      if (ack?.error) console.error('Send error:', ack.error);
    });
  }, [socketRef]);

  const handleSendText = (e) => {
    e?.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    sendMessage({ type: 'text', content });
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleVoiceRecorded = useCallback((payload) => sendMessage(payload), [sendMessage]);
  const handleImageUploaded = useCallback((payload) => sendMessage(payload), [sendMessage]);

  const groups = groupMessagesByDate(messages);
  const showMic = !text.trim();

  return (
    <div className="chat-area">
      <div className="chat-bg" />

      {/* Header */}
      <div className="chat-header">
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'linear-gradient(135deg, #00a884, #075e54)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0
        }}>
          💬
        </div>
        <div className="chat-header-info">
          <h2>Chat General</h2>
          <p>
            <span className="online-count">{onlineUserIds.length} en línea</span>
            {' · '}{users.length} miembros
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container" id="messages-list">
        {messages.length === 0 && (
          <div className="empty-chat">
            <div className="empty-chat-icon">💬</div>
            <h3>¡Bienvenido a ChatApp!</h3>
            <p>Sé el primero en enviar un mensaje. Podés escribir texto, enviar imágenes o notas de voz.</p>
          </div>
        )}

        {groups.map((item, idx) => {
          if (item.type === 'divider') {
            return (
              <div key={item.key} className="date-divider">
                <span>{item.label}</span>
              </div>
            );
          }
          const msg = item.message;
          const isOwn = msg.user_id === user?.id;
          // Find index in messages array for grouping
          const msgIdx = messages.findIndex(m => m.id === msg.id);
          const prevMsg = messages[msgIdx - 1];
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

      {/* Input bar */}
      <div className="input-area">
        <div className="input-bar">
          <ImageUpload onUploaded={handleImageUploaded} disabled={sending} />

          <textarea
            ref={textareaRef}
            id="message-input"
            className="msg-textarea"
            placeholder="Escribe un mensaje"
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={sending}
          />

          {showMic ? (
            <VoiceRecorder onRecorded={handleVoiceRecorded} disabled={sending} />
          ) : (
            <button
              id="send-message-btn"
              className="send-btn"
              onClick={handleSendText}
              disabled={sending}
              title="Enviar mensaje"
            >
              ➤
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
