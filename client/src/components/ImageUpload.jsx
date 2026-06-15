import React, { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function ImageUpload({ onUploaded, disabled }) {
  const { token, API_BASE } = useAuth();
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(file);
    setFileName(file.name);

    // Upload immediately
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onUploaded({ type: 'image', content: '📷 Imagen', file_url: data.url, previewSrc: preview });
    } catch (err) {
      console.error('Image upload error:', err);
      alert('Error al subir la imagen');
    } finally {
      setUploading(false);
      setPreview(null);
      setFileName('');
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        id="image-file-input"
        type="file"
        accept="image/*"
        className="hidden-input"
        onChange={handleChange}
        disabled={disabled || uploading}
      />
      <button
        id="attach-image-btn"
        className="attach-btn"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        title="Adjuntar imagen"
      >
        {uploading ? '⏳' : '📎'}
      </button>
    </>
  );
}
