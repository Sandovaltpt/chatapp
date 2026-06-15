import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

function getInitials(name) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');
}

export default function Sidebar({ users, onlineUserIds, messages }) {
  const { user, logout } = useAuth();
  const [search, setSearch] = useState('');

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  // Get last message per user
  const lastMsgByUser = {};
  messages.forEach(msg => {
    lastMsgByUser[msg.user_id] = msg;
  });

  const sortedUsers = [...filtered].sort((a, b) => {
    const aOnline = onlineUserIds.includes(a.id) ? 1 : 0;
    const bOnline = onlineUserIds.includes(b.id) ? 1 : 0;
    if (aOnline !== bOnline) return bOnline - aOnline;
    return a.name.localeCompare(b.name);
  });

  const onlineCount = users.filter(u => onlineUserIds.includes(u.id)).length;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">ChatApp</span>
        <div className="sidebar-actions">
          <div style={{ fontSize: '12px', color: 'var(--wa-green)', fontWeight: 600 }}>
            {onlineCount} en línea
          </div>
        </div>
      </div>

      <div className="sidebar-search">
        <div className="search-input-wrap">
          <span>🔍</span>
          <input
            id="sidebar-search"
            type="text"
            placeholder="Buscar usuario..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="members-list">
        <div className="members-section-title">
          Miembros ({filtered.length})
        </div>

        {sortedUsers.map(u => {
          const isOnline = onlineUserIds.includes(u.id);
          const isMe = u.id === user?.id;
          const lastMsg = lastMsgByUser[u.id];

          let lastMsgText = 'Sin mensajes aún';
          if (lastMsg) {
            if (lastMsg.type === 'text') lastMsgText = lastMsg.content;
            else if (lastMsg.type === 'image') lastMsgText = '📷 Imagen';
            else if (lastMsg.type === 'voice') lastMsgText = '🎤 Nota de voz';
          }

          return (
            <div key={u.id} className={`member-item ${isMe ? 'active' : ''}`}>
              <div className="avatar">
                <div
                  className="avatar-circle"
                  style={{ background: u.avatar_color }}
                >
                  {getInitials(u.name)}
                </div>
                <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
              </div>
              <div className="member-info">
                <div className="member-name">
                  {u.name} {isMe && <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '12px' }}>(vos)</span>}
                </div>
                <div className={`member-status ${isOnline ? 'online-text' : ''}`}>
                  {isOnline ? '● En línea' : lastMsgText}
                </div>
              </div>
            </div>
          );
        })}

        {sortedUsers.length === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No se encontraron usuarios
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="current-user-card">
          <div
            className="avatar-circle"
            style={{ background: user?.avatar_color || '#00a884', width: 36, height: 36, fontSize: 14 }}
          >
            {getInitials(user?.name || '?')}
          </div>
          <div className="current-user-info">
            <div className="current-user-name">{user?.name}</div>
            <div className="current-user-label">● En línea</div>
          </div>
          <button id="logout-btn" className="btn-logout" onClick={logout}>
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
