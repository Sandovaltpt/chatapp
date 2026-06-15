# 🚀 Instrucciones de despliegue — ChatApp

## Archivos del proyecto

```
chatapp/
├── index.html          ← estructura HTML
├── style.css           ← estilos (WhatsApp-like)
├── firebase-config.js  ← ← ← TÚ EDITAS ESTE
├── app.js              ← lógica de la app
├── vercel.json         ← configuración de Vercel
└── INSTRUCCIONES.md    ← esta guía
```

---

## PASO 1 — Crear proyecto Firebase

1. Ve a **https://console.firebase.google.com**
2. Clic en **"Agregar proyecto"** → ponle un nombre → continuar
3. Desactiva Google Analytics si no lo necesitas → **Crear proyecto**

---

## PASO 2 — Registrar tu app web

1. En el panel del proyecto, clic en el ícono **`</>`** (Web)
2. Ponle un nombre (ej. `chatapp`) → clic en **Registrar app**
3. Copia el objeto `firebaseConfig` que aparece

---

## PASO 3 — Editar `firebase-config.js`

Abre el archivo `firebase-config.js` y reemplaza los valores:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",          // ← el tuyo
  authDomain:        "miproyecto.firebaseapp.com",
  projectId:         "miproyecto",
  storageBucket:     "miproyecto.appspot.com",
  messagingSenderId: "1234567890",
  appId:             "1:1234:web:abcd"
};
```

---

## PASO 4 — Activar Firestore

1. En el menú izquierdo de Firebase → **Firestore Database**
2. Clic en **"Crear base de datos"**
3. Elige **Modo de prueba** (para desarrollo) → siguiente
4. Selecciona la región más cercana (ej. `us-central`) → **Listo**

### Reglas de seguridad (Firestore)
Ve a **Firestore → Reglas** y pega:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId}/messages/{msgId} {
      allow read, write: if true;
    }
  }
}
```
Clic en **Publicar**.

---

## PASO 5 — Activar Storage

1. En el menú izquierdo → **Storage**
2. Clic en **"Comenzar"** → Modo de prueba → **Listo**

### Reglas de seguridad (Storage)
Ve a **Storage → Reglas** y pega:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```
Clic en **Publicar**.

---

## PASO 6 — Subir a GitHub

```bash
# En la carpeta chatapp/
git init
git add .
git commit -m "ChatApp con Firebase"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/chatapp.git
git push -u origin main
```

---

## PASO 7 — Desplegar en Vercel

1. Ve a **https://vercel.com** → inicia sesión con GitHub
2. Clic en **"Add New Project"**
3. Importa tu repositorio `chatapp`
4. Deja todo por defecto (no hay build step, es HTML puro) → **Deploy**
5. Vercel te dará una URL tipo `https://chatapp-xxx.vercel.app` 🎉

---

## Listo ✅

- Los mensajes (texto, fotos, audios) se guardan en Firebase y persisten al recargar
- Múltiples usuarios pueden chatear en tiempo real desde cualquier dispositivo
- Para producción, actualiza las reglas de seguridad de Firestore y Storage
  para que requieran autenticación

---

## ⚠️ Nota sobre modo de prueba

Las reglas `allow read, write: if true` son solo para desarrollo.
Antes de publicar a producción, considera agregar autenticación con Firebase Auth.
