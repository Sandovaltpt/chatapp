// ─────────────────────────────────────────────────────────────
//  PASO 1 → Ve a https://console.firebase.google.com
//  PASO 2 → Crea un proyecto (o usa uno existente)
//  PASO 3 → Agrega una app web ( </> )
//  PASO 4 → Copia los valores del objeto firebaseConfig y pégalos aquí
//  PASO 5 → Habilita Firestore y Storage en la consola de Firebase
// ─────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: "AIzaSyAdxeyIy1zq9nznOzJrY6EDDReLNiJXqc8",
  authDomain: "chat-a21d5.firebaseapp.com",
  projectId: "chat-a21d5",
  storageBucket: "chat-a21d5.firebasestorage.app",
  messagingSenderId: "877565120171",
  appId: "1:877565120171:web:03e7e5ba07dc7bea0171ee"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db      = firebase.firestore();
const storage = firebase.storage();
