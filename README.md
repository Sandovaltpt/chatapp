# chatapp

app de chat en tiempo real que hice con react y node. tiene mensajes de voz, imagenes, salas y usuarios en linea.

## link

https://chatapp-production-dc55.up.railway.app

ahi pueden entrar, registrarse y usarla directamente desde el cel o la pc.

---

## como correrlo local

necesitas tener node instalado

```
npm run install:all
```

despues en dos terminales distintas:

```
npm run dev:server
```
```
npm run dev:client
```

el frontend queda en localhost:3000 y el backend en el 3001

## stack

- react + vite
- express + socket.io
- jwt para el login
- lowdb como base de datos (archivo json)
