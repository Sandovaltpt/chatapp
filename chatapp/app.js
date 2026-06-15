// ═══════════════════════════════════════════════════════════════
//  ChatApp — app.js
//  Firebase Firestore (mensajes) + Storage (fotos y audios)
// ═══════════════════════════════════════════════════════════════

// ── Salas ────────────────────────────────────────────────────
const ROOMS = [
  { id: 'general',   name: 'General',     emoji: '🌐', color: '#128c7e', topic: 'Conversación para todos' },
  { id: 'tech',      name: 'Tecnología',  emoji: '💻', color: '#6c3483', topic: 'Dev, IA y gadgets' },
  { id: 'gaming',    name: 'Gaming',      emoji: '🎮', color: '#1a5276', topic: 'Videojuegos y entretenimiento' },
  { id: 'musica',    name: 'Música',      emoji: '🎵', color: '#943126', topic: 'Todo sobre música' },
  { id: 'deportes',  name: 'Deportes',    emoji: '⚽', color: '#1d6a27', topic: 'Fútbol, básquetbol y más' },
];

const EMOJIS = [
  '😊','😂','❤️','🔥','👍','🎉','😍','🤔','👋','💯',
  '😎','🙌','✨','💪','😅','🤣','😢','🙏','😁','🎮',
  '💻','🎵','⚽','🌐','🚀','👀','🤗','😜','🥳','💡',
  '⭐','🏆','🎯','🤙','💬','📱','🖥️','🎧','🍕','☕',
];

// ── State ─────────────────────────────────────────────────────
let myName        = '';
let currentRoom   = null;
let unreadCount   = {};          // roomId → number
let roomUnsub     = null;        // Firestore listener unsubscribe
let mediaRecorder = null;
let audioChunks   = [];
let recInterval   = null;
let recSeconds    = 0;
let recCancelled  = false;

ROOMS.forEach(r => { unreadCount[r.id] = 0; });

// ── DOM refs ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const loginOverlay  = $('login-overlay');
const loginNameEl   = $('login-name');
const loginBtn      = $('login-btn');
const sidebarUser   = $('sidebar-user');
const roomsList     = $('rooms-list');
const roomSearch    = $('room-search');
const noRoom        = $('no-room');
const chatHeader    = $('chat-header');
const headerAvatar  = $('header-avatar');
const headerName    = $('header-name');
const headerSub     = $('header-sub');
const messagesEl    = $('messages');
const inputBar      = $('input-bar');
const msgInput      = $('msg-input');
const sendBtn       = $('send-btn');
const emojiBtn      = $('emoji-btn');
const emojiPicker   = $('emoji-picker');
const photoInput    = $('photo-input');
const audioBtn      = $('audio-btn');
const recBar        = $('rec-bar');
const recTimeEl     = $('rec-time');
const cancelRec     = $('cancel-rec');
const toastEl       = $('toast');

// ═══════════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════════
function fmtTime(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date();
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}
function uid()   { return Math.random().toString(36).slice(2, 9); }
function esc(s)  { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3200);
}

// ═══════════════════════════════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════════════════════════════
function doLogin() {
  const name = loginNameEl.value.trim();
  if (!name) { loginNameEl.focus(); return; }
  myName = name;
  sidebarUser.textContent = `👤 ${name}`;
  loginOverlay.style.display = 'none';
  renderRooms();
  joinRoom(ROOMS[0]);
}

loginBtn.addEventListener('click', doLogin);
loginNameEl.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

// ═══════════════════════════════════════════════════════════════
//  SIDEBAR / ROOMS
// ═══════════════════════════════════════════════════════════════
function renderRooms(filter = '') {
  roomsList.innerHTML = '';
  ROOMS
    .filter(r => r.name.toLowerCase().includes(filter.toLowerCase()))
    .forEach(r => {
      const div = document.createElement('div');
      div.className = 'room-item' + (currentRoom?.id === r.id ? ' active' : '');
      const badge = unreadCount[r.id] > 0
        ? `<div class="room-badge">${unreadCount[r.id]}</div>` : '';
      div.innerHTML = `
        <div class="room-avatar" style="background:${r.color}22;color:${r.color}">${r.emoji}</div>
        <div class="room-info">
          <div class="room-name">${r.emoji} ${r.name}</div>
          <div class="room-preview">${r.topic}</div>
        </div>
        ${badge}
      `;
      div.addEventListener('click', () => joinRoom(r));
      roomsList.appendChild(div);
    });
}

roomSearch.addEventListener('input', () => renderRooms(roomSearch.value));

// ═══════════════════════════════════════════════════════════════
//  JOIN ROOM
// ═══════════════════════════════════════════════════════════════
function joinRoom(room) {
  if (currentRoom?.id === room.id) return;

  // Detach previous Firestore listener
  if (roomUnsub) { roomUnsub(); roomUnsub = null; }

  currentRoom = room;
  unreadCount[room.id] = 0;

  // Show UI
  noRoom.classList.add('hidden');
  chatHeader.classList.remove('hidden');
  inputBar.classList.remove('hidden');

  headerAvatar.textContent = room.emoji;
  headerAvatar.style.cssText = `
    width:40px;height:40px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    font-size:1.25rem;background:${room.color}30;color:${room.color}`;
  headerName.textContent = `${room.emoji} ${room.name}`;
  headerSub.textContent  = room.topic;

  messagesEl.innerHTML = '';
  renderRooms();

  // ── Firestore real-time listener ──────────────────────────
  roomUnsub = db
    .collection('rooms')
    .doc(room.id)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          appendMessage(data);

          // Unread badge for other rooms (after initial load)
          if (data.author !== myName && currentRoom?.id !== room.id) {
            unreadCount[room.id] = (unreadCount[room.id] || 0) + 1;
            showToast(`💬 ${data.author} en ${room.name}`);
            renderRooms();
          }
        }
      });
      scrollBottom();
    });
}

// ═══════════════════════════════════════════════════════════════
//  RENDER ONE MESSAGE
// ═══════════════════════════════════════════════════════════════
function appendMessage(data) {
  // Avoid duplicates (optimistic + firestore)
  if (data._tempId && document.querySelector(`[data-temp="${data._tempId}"]`)) {
    // remove optimistic placeholder
    document.querySelector(`[data-temp="${data._tempId}"]`).remove();
  }

  const own = data.author === myName;
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap ' + (own ? 'own' : 'other');

  let inner = '';
  if (!own) inner += `<div class="msg-author">${esc(data.author)}</div>`;

  let content = '';
  if (data.type === 'text') {
    content = esc(data.text);
  } else if (data.type === 'image') {
    content = `<img class="msg-img" src="${data.url}" alt="foto" loading="lazy"/>`;
  } else if (data.type === 'audio') {
    content = `<audio controls src="${data.url}" preload="none"></audio>`;
  }

  inner += `
    <div class="bubble">
      ${content}
      <span class="msg-time">${fmtTime(data.createdAt)}</span>
    </div>`;
  wrap.innerHTML = inner;

  // Lightbox for images
  const img = wrap.querySelector('.msg-img');
  if (img) img.addEventListener('click', () => openLightbox(data.url));

  messagesEl.appendChild(wrap);
}

function scrollBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ═══════════════════════════════════════════════════════════════
//  SEND TEXT
// ═══════════════════════════════════════════════════════════════
function sendTextMessage() {
  if (!currentRoom) return;
  const text = msgInput.value.trim();
  if (!text) return;
  msgInput.value = '';
  msgInput.style.height = 'auto';

  saveMessage({ type: 'text', text, author: myName });
}

sendBtn.addEventListener('click', sendTextMessage);
msgInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTextMessage(); }
});
msgInput.addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 110) + 'px';
});

// ═══════════════════════════════════════════════════════════════
//  SAVE MESSAGE TO FIRESTORE
// ═══════════════════════════════════════════════════════════════
function saveMessage(data) {
  return db
    .collection('rooms')
    .doc(currentRoom.id)
    .collection('messages')
    .add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
}

// ═══════════════════════════════════════════════════════════════
//  UPLOAD TO STORAGE + SAVE
// ═══════════════════════════════════════════════════════════════
function uploadAndSend(file, type, ext) {
  if (!currentRoom) return;
  const path  = `${currentRoom.id}/${type}/${uid()}.${ext}`;
  const ref   = storage.ref(path);
  const task  = ref.put(file);

  // optimistic placeholder
  const tempId = uid();
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap own';
  wrap.dataset.temp = tempId;
  wrap.innerHTML = `
    <div class="bubble">
      <span class="msg-uploading">⏳ Subiendo ${type === 'image' ? 'foto' : 'audio'}…</span>
      <div class="progress-bar" id="pb-${tempId}"></div>
    </div>`;
  messagesEl.appendChild(wrap);
  scrollBottom();

  task.on('state_changed',
    snap => {
      const pct = (snap.bytesTransferred / snap.totalBytes * 100).toFixed(0);
      const pb  = $(`pb-${tempId}`);
      if (pb) pb.style.width = pct + '%';
    },
    err => {
      console.error(err);
      wrap.remove();
      showToast('❌ Error al subir el archivo');
    },
    async () => {
      const url = await task.snapshot.ref.getDownloadURL();
      wrap.remove();
      saveMessage({ type, url, author: myName });
    }
  );
}

// ═══════════════════════════════════════════════════════════════
//  PHOTO UPLOAD
// ═══════════════════════════════════════════════════════════════
photoInput.addEventListener('change', () => {
  const file = photoInput.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop() || 'jpg';
  uploadAndSend(file, 'image', ext);
  photoInput.value = '';
});

// ═══════════════════════════════════════════════════════════════
//  AUDIO RECORDING
// ═══════════════════════════════════════════════════════════════
audioBtn.addEventListener('mousedown',  startRecording);
audioBtn.addEventListener('touchstart', startRecording, { passive: true });
audioBtn.addEventListener('mouseup',    stopRecording);
audioBtn.addEventListener('touchend',   stopRecording);

async function startRecording(e) {
  e.preventDefault();
  if (!currentRoom) return;
  recCancelled = false;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks  = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.addEventListener('dataavailable', ev => audioChunks.push(ev.data));
    mediaRecorder.addEventListener('stop', () => {
      stream.getTracks().forEach(t => t.stop());
      if (!recCancelled && audioChunks.length) {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        uploadAndSend(blob, 'audio', 'webm');
      }
    });
    mediaRecorder.start();

    // UI
    recBar.classList.remove('hidden');
    inputBar.classList.add('hidden');
    audioBtn.classList.add('recording');
    recSeconds = 0;
    recTimeEl.textContent = '0:00';
    recInterval = setInterval(() => {
      recSeconds++;
      const m = Math.floor(recSeconds / 60);
      const s = recSeconds % 60;
      recTimeEl.textContent = `${m}:${s.toString().padStart(2,'0')}`;
    }, 1000);
  } catch {
    showToast('🎤 No se pudo acceder al micrófono');
  }
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  clearInterval(recInterval);
  mediaRecorder.stop();

  // UI
  recBar.classList.add('hidden');
  inputBar.classList.remove('hidden');
  audioBtn.classList.remove('recording');
}

cancelRec.addEventListener('click', () => {
  recCancelled = true;
  stopRecording();
});

// ═══════════════════════════════════════════════════════════════
//  EMOJI PICKER
// ═══════════════════════════════════════════════════════════════
EMOJIS.forEach(e => {
  const span = document.createElement('span');
  span.className = 'e';
  span.textContent = e;
  span.addEventListener('click', () => {
    msgInput.value += e;
    msgInput.focus();
    emojiPicker.classList.remove('open');
  });
  emojiPicker.appendChild(span);
});

emojiBtn.addEventListener('click', ev => {
  ev.stopPropagation();
  emojiPicker.classList.toggle('open');
});
document.addEventListener('click', () => emojiPicker.classList.remove('open'));

// ═══════════════════════════════════════════════════════════════
//  LIGHTBOX
// ═══════════════════════════════════════════════════════════════
function openLightbox(src) {
  const box = document.createElement('div');
  box.id = 'lightbox';
  box.innerHTML = `<img src="${src}" alt="foto ampliada"/>`;
  box.addEventListener('click', () => box.remove());
  document.body.appendChild(box);
}

// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════
renderRooms();
