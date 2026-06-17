import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

function getRoomEmoji(name) {
  const emojis = ['💬', '🎮', '🎵', '📚', '🏀', '🍕', '🌍', '💡', '🎨', '🔥'];
  let hash = 0;
  for (let c of name) hash += c.charCodeAt(0);
  return emojis[hash % emojis.length];
}

// Modal para crear una nueva sala
function CreateRoomModal({ onClose, onCreated }) {
  const { token, API_BASE } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('El nombre es requerido'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCreated(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          <span>🏠</span> Nueva Sala
        </div>

        {error && <div className="error-banner" style={{ marginBottom: 14 }}>{error}</div>}

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="room-name-input">Nombre de la sala</label>
            <input
              id="room-name-input"
              type="text"
              placeholder="Ej: Gaming, Música, Trabajo..."
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              maxLength={40}
            />
          </div>
          <div className="form-group">
            <label htmlFor="room-desc-input">Descripción (opcional)</label>
            <input
              id="room-desc-input"
              type="text"
              placeholder="¿De qué trata esta sala?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="modal-actions">
            <button id="cancel-room-btn" type="button" className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button id="create-room-btn" type="submit" className="btn-create" disabled={loading}>
              {loading ? 'Creando...' : 'Crear sala'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Sidebar({ rooms, users, onlineUserIds, messages, currentRoom, onSelectRoom, onRoomsUpdate, readTimestamps = {} }) {
  const { user, token, logout, API_BASE } = useAuth();
  const [tab, setTab] = useState('rooms'); // 'rooms' | 'members'
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // --- Pestaña de salas ---
  const filteredRooms = rooms.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleRoomCreated = (newRoom) => {
    onRoomsUpdate(prev => [...prev, newRoom]);
    onSelectRoom(newRoom);
  };

  const handleDeleteRoom = async (e, room) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar la sala "${room.name}"? Se borrarán todos sus mensajes.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/rooms/${room.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error);
        return;
      }
      onRoomsUpdate(prev => prev.filter(r => r.id !== room.id));
      if (currentRoom?.id === room.id) {
        const general = rooms.find(r => r.id === 'general');
        onSelectRoom(general || null);
      }
    } catch (err) {
      alert('Error al eliminar la sala');
    }
  };

  // --- Pestaña de miembros ---
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const aOn = onlineUserIds.includes(a.id) ? 1 : 0;
    const bOn = onlineUserIds.includes(b.id) ? 1 : 0;
    return bOn - aOn || a.name.localeCompare(b.name);
  });

  const lastMsgByUser = {};
  messages.forEach(msg => { lastMsgByUser[msg.user_id] = msg; });

  const onlineCount = users.filter(u => onlineUserIds.includes(u.id)).length;

  return (
    <>
      <div className="sidebar">
        {/* Encabezado */}
        <div className="sidebar-header">
          <span className="sidebar-title">ChatApp</span>
          <div style={{ fontSize: 12, color: 'var(--wa-green)', fontWeight: 600 }}>
            {onlineCount} en línea
          </div>
        </div>

        {/* Pestañas */}
        <div className="sidebar-tabs">
          <button
            id="tab-rooms"
            className={`sidebar-tab ${tab === 'rooms' ? 'active' : ''}`}
            onClick={() => { setTab('rooms'); setSearch(''); }}
          >
            Salas
          </button>
          <button
            id="tab-members"
            className={`sidebar-tab ${tab === 'members' ? 'active' : ''}`}
            onClick={() => { setTab('members'); setSearch(''); }}
          >
            Miembros
          </button>
        </div>

        {/* Búsqueda */}
        <div className="sidebar-search">
          <div className="search-input-wrap">
            <span>🔍</span>
            <input
              id="sidebar-search"
              type="text"
              placeholder={tab === 'rooms' ? 'Buscar sala...' : 'Buscar usuario...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Contenido */}
        {tab === 'rooms' ? (
          <div className="rooms-list">
            {/* Botón nueva sala */}
            <button
              id="new-room-btn"
              className="new-room-btn"
              onClick={() => setShowCreateModal(true)}
            >
              <div className="new-room-icon">＋</div>
              <div className="new-room-label">Nueva sala</div>
            </button>

            {filteredRooms.length === 0 && search && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No se encontraron salas
              </div>
            )}

            {filteredRooms.map(room => {
              const isActive = currentRoom?.id === room.id;
              const isOwner = room.created_by === user?.id;
              // Mensajes no leídos: solo los más nuevos que la última lectura de esta sala
              const lastRead = readTimestamps[room.id] || 0;
              const unreadCount = isActive
                ? 0
                : messages.filter(m => m.room_id === room.id && m.created_at > lastRead).length;

              return (
                <div
                  key={room.id}
                  id={`room-${room.id}`}
                  className={`room-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectRoom(room)}
                >
                  <div className="room-icon">
                    {getRoomEmoji(room.name)}
                  </div>
                  <div className="room-info">
                    <div className="room-name"># {room.name}</div>
                    <div className="room-desc">
                      {room.description || (room.is_default ? 'Sala para todos' : `Creada por ${room.created_by_name || 'usuario'}`)}
                    </div>
                  </div>
                  <div className="room-meta">
                    {unreadCount > 0 && (
                      <span className="room-msg-count">{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                    {!room.is_default && isOwner && (
                      <button
                        className="room-delete-btn"
                        onClick={e => handleDeleteRoom(e, room)}
                        title="Eliminar sala"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="members-list">
            <div className="members-section-title">
              Miembros ({filteredUsers.length})
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
                    <div className="avatar-circle" style={{ background: u.avatar_color }}>
                      {getInitials(u.name)}
                    </div>
                    <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
                  </div>
                  <div className="member-info">
                    <div className="member-name">
                      {u.name}{isMe && <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12 }}> (tú)</span>}
                    </div>
                    <div className={`member-status ${isOnline ? 'online-text' : ''}`}>
                      {isOnline ? '● En línea' : lastMsgText}
                    </div>
                  </div>
                </div>
              );
            })}
            {sortedUsers.length === 0 && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No se encontraron usuarios
              </div>
            )}
          </div>
        )}

        {/* Pie de página */}
        <div className="sidebar-footer">
          <div className="current-user-card">
            <div className="avatar-circle" style={{ background: user?.avatar_color || '#00a884', width: 36, height: 36, fontSize: 14 }}>
              {getInitials(user?.name || '?')}
            </div>
            <div className="current-user-info">
              <div className="current-user-name">{user?.name}</div>
              <div className="current-user-label">● En línea</div>
            </div>
            <button id="logout-btn" className="btn-logout" onClick={logout}>Salir</button>
          </div>
        </div>
      </div>

      {/* Modal Crear Sala */}
      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleRoomCreated}
        />
      )}
    </>
  );
}
