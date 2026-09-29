import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Minimize2, Maximize2, Send, Paperclip, Camera, Mic, 
  Users, User, Circle, Image, FileText, CheckCheck, Move 
} from 'lucide-react';
import { playNewMessageSound } from './chatSound';
import { apiFetch } from './api';

export function ChatTIWidget({ currentUser, supabase, isOpen, onClose }) {
  const [rooms, setRooms] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [messages, setMessages] = useState({});
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Position & Drag state (Facebook-style draggable floating widget)
  const [position, setPosition] = useState({ right: 30, bottom: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, right: 30, bottom: 20 });

  // Camera & Audio recorder state
  const [showCamera, setShowCamera] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  // Load User's Chat Rooms
  const fetchRooms = async () => {
    try {
      const res = await apiFetch('/chat/rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
        if (data.length > 0 && !activeTabId) {
          setActiveTabId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching rooms:', err);
    }
  };

  useEffect(() => {
    if (isOpen) fetchRooms();
  }, [isOpen]);

  // Realtime Messages Subscription & Sound Alert
  useEffect(() => {
    if (!isOpen) return;

    const channel = supabase
      .channel('chat-widget-global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const newMsg = payload.new;
          
          setMessages(prev => {
            const roomMsgs = prev[newMsg.room_id] || [];
            return { ...prev, [newMsg.room_id]: [...roomMsgs, newMsg] };
          });

          // Play sound alert & trigger red dot if message is from another user
          if (newMsg.sender_id !== currentUser?.id) {
            playNewMessageSound();
            setUnreadCount(count => count + 1);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isOpen, currentUser]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTabId]);

  // Dragging Handlers (Stick to Right / Left / Bottom)
  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      right: position.right,
      bottom: position.bottom
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = dragStartRef.current.x - e.clientX;
      const deltaY = dragStartRef.current.y - e.clientY;

      let newRight = dragStartRef.current.right + deltaX;
      let newBottom = dragStartRef.current.bottom + deltaY;

      // Keep within viewport boundaries
      newRight = Math.max(10, Math.min(window.innerWidth - 360, newRight));
      newBottom = Math.max(10, Math.min(window.innerHeight - 450, newBottom));

      setPosition({ right: newRight, bottom: newBottom });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Camera Capture Logic
  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      alert('Unable to access camera.');
      setShowCamera(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // Stop tracks
    const stream = video.srcObject;
    stream?.getTracks().forEach(t => t.stop());
    setShowCamera(false);

    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      await uploadAndSendAttachment(file, 'image');
    }, 'image/jpeg');
  };

  // Voice Note Recording Logic
  const toggleAudioRecording = async () => {
    if (isRecordingAudio) {
      mediaRecorder?.stop();
      setIsRecordingAudio(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks = [];

        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = async () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const file = new File([blob], 'voicenote.webm', { type: 'audio/webm' });
          await uploadAndSendAttachment(file, 'audio');
          stream.getTracks().forEach(t => t.stop());
        };

        recorder.start();
        setMediaRecorder(recorder);
        setIsRecordingAudio(true);
      } catch (e) {
        alert('Microphone access denied.');
      }
    }
  };

  // Upload Attachment Helper
  const uploadAndSendAttachment = async (file, type) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
      const res = await apiFetch('/api/chat/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const { attachment_url } = await res.json();
        sendMessage('', attachment_url, type);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  // File Upload Handler
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const type = file.type.startsWith('image/') ? 'image' : 'file';
    uploadAndSendAttachment(file, type);
  };

  // Send Message
  const sendMessage = async (text = inputText, attachmentUrl = null, attachmentType = null) => {
    if (!text.trim() && !attachmentUrl) return;
    if (!activeTabId) return;

    const payload = {
      room_id: activeTabId,
      sender_id: currentUser?.id,
      sender_name: currentUser?.username || 'Usuario TI',
      content: text.trim(),
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
      status: 'sent'
    };

    await supabase.from('chat_messages').insert([payload]);
    setInputText('');
  };

  if (!isOpen) return null;

  const activeRoom = rooms.find(r => r.id === activeTabId);
  const currentMessages = messages[activeTabId] || [];

  return (
    <div 
      style={{
        position: 'fixed',
        right: `${position.right}px`,
        bottom: `${position.bottom}px`,
        width: '360px',
        height: isMinimized ? '48px' : '480px',
        backgroundColor: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: isDragging ? 'none' : 'height 0.2s ease-in-out'
      }}
    >
      {/* HEADER BAR (DRAGGABLE) */}
      <div 
        onMouseDown={handleMouseDown}
        style={{
          backgroundColor: '#1E293B',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Move size={14} className="text-slate-400" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC' }}>
            Chat TI {unreadCount > 0 && `(${unreadCount})`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button 
            onClick={() => { setIsMinimized(!isMinimized); setUnreadCount(0); }}
            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
          >
            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* ROOM TABS */}
          <div style={{ display: 'flex', background: '#090D16', borderBottom: '1px solid #1E293B', overflowX: 'auto' }}>
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => { setActiveTabId(room.id); setUnreadCount(0); }}
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: activeTabId === room.id ? 600 : 400,
                  color: activeTabId === room.id ? '#38BDF8' : '#94A3B8',
                  background: activeTabId === room.id ? '#0F172A' : 'transparent',
                  border: 'none',
                  borderBottom: activeTabId === room.id ? '2px solid #38BDF8' : 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {room.name || 'Chat Privado'}
              </button>
            ))}
          </div>

          {/* MESSAGES CONTAINER */}
          <div style={{ flex: 1, padding: '12px', overflowY: 'auto', background: '#0B0F19', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {currentMessages.map((msg, i) => {
              const isMe = msg.sender_id === currentUser?.id;
              return (
                <div key={msg.id || i} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                  {!isMe && (
                    <a 
                      href={`#/profile?user=${msg.sender_id}`} 
                      style={{ fontSize: '10px', color: '#38BDF8', textDecoration: 'none', fontWeight: 600, display: 'block', marginBottom: '2px' }}
                    >
                      {msg.sender_name}
                    </a>
                  )}

                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    backgroundColor: isMe ? '#2563EB' : '#1E293B',
                    color: '#FFF',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }}>
                    {msg.content && <p style={{ margin: 0 }}>{msg.content}</p>}

                    {msg.attachment_type === 'image' && (
                      <img src={msg.attachment_url} alt="adjunto" style={{ maxWidth: '100%', borderRadius: '6px', marginTop: '4px' }} />
                    )}

                    {msg.attachment_type === 'audio' && (
                      <audio controls src={msg.attachment_url} style={{ width: '180px', height: '30px', marginTop: '4px' }} />
                    )}

                    {msg.attachment_type === 'file' && (
                      <a href={msg.attachment_url} target="_blank" rel="noreferrer" style={{ color: '#38BDF8', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <FileText size={12} /> Ver Archivo
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* CAMERA OVERLAY MODAL */}
          {showCamera && (
            <div style={{ padding: '8px', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: '6px' }} />
              <button onClick={capturePhoto} style={{ marginTop: '6px', padding: '4px 12px', background: '#22C55E', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                Tomar Foto
              </button>
            </div>
          )}

          {/* INPUT TOOLBAR & CONTROLS */}
          <div style={{ padding: '8px', background: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
            />
            
            <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }} title="Adjuntar Archivo">
              <Paperclip size={16} />
            </button>

            <button onClick={startCamera} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }} title="Usar Cámara">
              <Camera size={16} />
            </button>

            <button onClick={toggleAudioRecording} style={{ background: 'none', border: 'none', color: isRecordingAudio ? '#EF4444' : '#94A3B8', cursor: 'pointer' }} title="Nota de Voz">
              <Mic size={16} />
            </button>

            <input 
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Escribe un mensaje..."
              style={{
                flex: 1,
                background: '#0F172A',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#FFF',
                padding: '6px 10px',
                fontSize: '12px',
                outline: 'none'
              }}
            />

            <button onClick={() => sendMessage()} style={{ background: '#2563EB', border: 'none', color: '#FFF', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer' }}>
              <Send size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}