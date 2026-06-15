import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * Detecta automáticamente la URL del servidor:
 * - Si existe VITE_API_URL (variable de entorno), la usa directamente
 * - En desarrollo (Vite dev server): conecta a localhost:3001
 * - En producción (mismo servidor): usa el origen de la página (URLs relativas)
 */
function getApiBase() {
  // Variable de entorno explícita (opcional, para configuración personalizada)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // En desarrollo, el backend corre separado en el puerto 3001
  if (import.meta.env.DEV) {
    return `http://${window.location.hostname}:3001`;
  }
  // En producción, el backend sirve también el frontend → mismo origen
  return window.location.origin;
}

export const API_BASE = getApiBase();

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('chatapp_token');
    const savedUser  = localStorage.getItem('chatapp_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (name, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
    localStorage.setItem('chatapp_token', data.token);
    localStorage.setItem('chatapp_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (name, email, phone, password) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrarse');
    localStorage.setItem('chatapp_token', data.token);
    localStorage.setItem('chatapp_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('chatapp_token');
    localStorage.removeItem('chatapp_user');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, API_BASE }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
