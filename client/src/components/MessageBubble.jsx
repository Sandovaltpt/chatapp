import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

function formatTime(ts) {
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Fake waveform bars
function AudioWaveform() {
  const bars = Array.from({ length: 24 }, (_, i) => {
    const h = 6 + Math.floor(Math.abs(Math.sin(i * 0.7 + 1)) * 22);
    return h;
  });
  return (
    <div className="audio-waveform">
      {bars.map((h, i) => (
        <span key={i} style={{ height: `${h}px` }} />
      ))}
    </div>
  );
}

function AudioBubble({ src, API_BASE }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  const fullSrc = src?.startsWith('http') ? src : `${API_BASE}${src}`;

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(p => !p);
  };

  return (
    <div className="bubble-audio">
      <audio
        ref={audioRef}
        src={fullSrc}
        onLoadedMetadata={e => setDuration(e.target.duration)}
        onTimeUpdate={e => setCurrent(e.target.currentTime)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
        preload="metadata"
      />
      <button className="audio-play-btn" onClick={toggle} aria-label={playing ? 'Pausar' : 'Reproducir'}>
        {playing ? '⏸' : '▶'}
      </button>
      <AudioWaveform />
      <span className="audio-duration">
        {playing || current > 0
          ? `${Math.floor(current)}s`
          : duration > 0 ? `${Math.floor(duration)}s` : '🎤'}
      </span>
    </div>
  );
}

export default function MessageBubble({ message, isOwn, showAvatar }) {
  const { API_BASE } = useAuth();
  const [imgOpen, setImgOpen] = useState(false);

  const imgSrc = message.file_url?.startsWith('http')
    ? message.file_url
    : message.file_url ? `${API_BASE}${message.file_url}` : null;

  return (
    <>
      <div className={`message-row ${isOwn ? 'outgoing' : 'incoming'}`}>
        {!isOwn && showAvatar && (
          <div
            className="avatar-circle"
            style={{
              background: message.avatar_color || '#00a884',
              width: 28, height: 28, fontSize: 11, flexShrink: 0, alignSelf: 'flex-end', marginBottom: 2
            }}
          >
            {getInitials(message.user_name)}
          </div>
        )}
        {!isOwn && !showAvatar && <div style={{ width: 28, flexShrink: 0 }} />}

        <div className="bubble">
          {!isOwn && showAvatar && (
            <div className="bubble-sender" style={{ color: message.avatar_color || '#00a884' }}>
              {message.user_name}
            </div>
          )}

          {message.type === 'text' && (
            <p className="bubble-text">{message.content}</p>
          )}

          {message.type === 'image' && imgSrc && (
            <div className="bubble-image" onClick={() => setImgOpen(true)}>
              <img src={imgSrc} alt="Imagen enviada" loading="lazy" />
            </div>
          )}

          {message.type === 'voice' && message.file_url && (
            <AudioBubble src={message.file_url} API_BASE={API_BASE} />
          )}

          <div className="bubble-meta">
            <span className="bubble-time">{formatTime(message.created_at)}</span>
            {isOwn && <span className="check-icon">✓✓</span>}
          </div>
        </div>
      </div>

      {/* Image lightbox */}
      {imgOpen && imgSrc && (
        <div className="img-modal-backdrop" onClick={() => setImgOpen(false)}>
          <button className="img-modal-close" onClick={() => setImgOpen(false)}>✕</button>
          <img src={imgSrc} alt="Imagen completa" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

export { formatDate };
