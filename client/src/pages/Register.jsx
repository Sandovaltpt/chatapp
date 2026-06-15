import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register({ onGoLogin }) {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, email, phone, password, confirm } = form;

    if (!name.trim() || !email.trim() || !phone.trim() || !password) {
      setError('Por favor completá todos los campos');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      setError('El correo electrónico no es válido');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await register(name.trim(), email.trim(), phone.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.893c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652c1.746.943 3.71 1.444 5.71 1.444h.005c6.585 0 11.946-5.336 11.949-11.896 0-3.176-1.24-6.165-3.494-8.411" />
            </svg>
          </div>
          <h1>Crear cuenta</h1>
          <p>Únete a ChatApp hoy</p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reg-name">Nombre de usuario</label>
            <input
              id="reg-name"
              type="text"
              placeholder="Elige un nombre único"
              value={form.name}
              onChange={set('name')}
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">Correo electrónico</label>
            <input
              id="reg-email"
              type="email"
              placeholder="tu@correo.com"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-phone">Número telefónico</label>
            <input
              id="reg-phone"
              type="tel"
              placeholder="+54 11 1234-5678"
              value={form.phone}
              onChange={set('phone')}
              autoComplete="tel"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-password">Contraseña</label>
            <input
              id="reg-password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-confirm">Confirmar contraseña</label>
            <input
              id="reg-confirm"
              type="password"
              placeholder="Repetí tu contraseña"
              value={form.confirm}
              onChange={set('confirm')}
              autoComplete="new-password"
            />
          </div>

          <button
            id="register-submit"
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <div className="auth-footer">
          ¿Ya tenés cuenta?{' '}
          <a onClick={onGoLogin} id="go-login-link">Iniciar sesión</a>
        </div>
      </div>
    </div>
  );
}
