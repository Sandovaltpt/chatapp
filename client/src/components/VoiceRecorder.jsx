import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function VoiceRecorder({ onRecorded, disabled }) {
  const { token, API_BASE } = useAuth();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg';

      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await uploadVoice(blob, mimeType);
      };

      mr.start(250);
      setRecording(true);
      setSeconds(0);
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      alert('No se pudo acceder al micrófono. Por favor, otorgá permiso.');
    }
  };

  const stopRecording = () => {
    clearInterval(intervalRef.current);
    setRecording(false);
    setSeconds(0);
    mediaRecorderRef.current?.stop();
  };

  const cancelRecording = () => {
    clearInterval(intervalRef.current);
    setRecording(false);
    setSeconds(0);
    mediaRecorderRef.current?.stop();
    chunksRef.current = [];
    streamRef.current?.getTracks().forEach(t => t.stop());
    // Override onstop to skip upload
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
    }
  };

  const uploadVoice = async (blob, mimeType) => {
    try {
      const ext = mimeType.includes('ogg') ? '.ogg' : '.webm';
      const formData = new FormData();
      formData.append('file', blob, `voice${ext}`);

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onRecorded({ type: 'voice', content: '🎤 Nota de voz', file_url: data.url });
    } catch (err) {
      console.error('Voice upload error:', err);
      alert('Error al subir la nota de voz');
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  if (recording) {
    return (
      <>
        <div className="recording-bar">
          <div className="recording-dot" />
          <span className="recording-time">{formatTime(seconds)}</span>
          <button
            id="cancel-recording-btn"
            className="cancel-recording"
            onClick={cancelRecording}
            title="Cancelar"
          >
            🗑
          </button>
        </div>
        <button
          id="stop-recording-btn"
          className="send-btn record-btn recording"
          onClick={stopRecording}
          title="Detener y enviar"
        >
          ⏹
        </button>
      </>
    );
  }

  return (
    <button
      id="start-recording-btn"
      className="send-btn record-btn"
      onClick={startRecording}
      disabled={disabled}
      title="Grabar nota de voz"
    >
      🎤
    </button>
  );
}
