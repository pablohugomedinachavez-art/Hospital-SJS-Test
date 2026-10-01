import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Minimize2, Maximize2, Send, Paperclip, Camera, Mic, 
  Users, User, FileText, Move, ArrowLeft 
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

  // Navigation & User Directory States
  const [view, setView] = useState('list'); // 'list' | 'new_chat' | 'chat'
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Mapa dinámico de nombres de usuario por sala (Cargado directamente desde Supabase)
  const [roomPeerMap, setRoomPeerMap] = useState({});

  // Position & Drag state
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
        // Consultar los nombres de los participantes para cada sala en Supabase
        resolveRoomPeers(data);
      }
    } catch (err) {
      console.error('Error fetching rooms:', err);
    }
  };

  // Resolver dinámicamente los usernames desde Supabase (Unión chat_participants -> users)
  const resolveRoomPeers = async (roomsList) => {
    if (!supabase || !currentUser?.id) return;
    try {
      const roomIds = roomsList.map(r => r.id);
      if (roomIds.length === 0) return;

      const { data, error } = await supabase
        .from('chat_participants')
        .select(`
          room_id,
          user_id,
          users:user_id ( id, username )
        `)
        .in('room_id', roomIds);

      if (!error && data) {
        const newMap = {};
        data.forEach(p => {
          // Si el participante no es el usuario actual, guardamos su username
          if (p.user_id !== currentUser.id && p.users) {
            const peerUser = Array.isArray(p.users) ? p.users[0] : p.users;
            if (peerUser?.username) {
              newMap[p.room_id] = peerUser.username;
            }
          }
        });
        setRoomPeerMap(prev => ({ ...prev, ...newMap }));
      }
    } catch (err) {
      console.error('Error resolving room peers:', err);
    }
  };

  // Fetch Tenant Users for the New Chat Directory
  const fetchTenantUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await apiFetch('/users');
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch (err) {
      console.error('Error fetching tenant users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Cargar mensajes históricos de la sala activa desde Supabase
  useEffect(() => {
    if (!activeTabId || !supabase) return;

    const fetchHistoryMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('room_id', activeTabId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          setMessages(prev => ({
            ...prev,
            [activeTabId]: data
          }));
        }
      } catch (err) {
        console.error('Error fetching message history:', err);
      }
    };

    fetchHistoryMessages();
  }, [activeTabId, supabase]);

  // Obtener el nombre a mostrar en la tarjeta de chat
  const getRoomTitle = (room) => {
    if (!room) return 'Chat Directo';
    if (room.is_group) return room.name || 'Grupo de Trabajo';
    
    // Obtiene el ID del otro usuario en la sala y busca su username en el mapa
    const peerId = room.recipient_id || room.user_id;
    if (peerId && roomPeerMap[peerId]) {
      return roomPeerMap[peerId];
    }

    // Si viene en los participantes de la sala de la BD
    if (room.participants && Array.isArray(room.participants)) {
      const other = room.participants.find(p => (p.user_id || p.id) !== currentUser?.id);
      if (other && (other.username || other.users?.username)) {
        return other.username || other.users?.username;
      }
    }

    return room.recipient_username || room.username || 'Chat Directo';
  };

  // Enlazar sala al seleccionar un usuario del directorio
  const handleSelectUserToChat = async (targetUser) => {
    try {
      const existingRoom = rooms.find(room => {
        if (room.is_group) return false;
        return roomPeerMap[room.id] === targetUser.username;
      });

      let roomId;
      if (existingRoom) {
        roomId = existingRoom.id;
      } else {
        const res = await apiFetch('/chat/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient_id: targetUser.id })
        });
        if (res.ok) {
          const newRoom = await res.json();
          roomId = newRoom.id || newRoom.room_id;
          await fetchRooms();
        }
      }

      if (roomId) {
        setRoomPeerMap(prev => ({
          ...prev,
          [roomId]: targetUser.username
        }));
        setActiveTabId(roomId);
        setView('chat');
      }
    } catch (err) {
      console.error('Error creating/opening chat room:', err);
    }
  };

  // Realtime Messages Subscription & Sound Alert
  useEffect(() => {
    if (!isOpen) return;
    fetchRooms();

    const channel = supabase
      .channel('chat-widget-global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const newMsg = payload.new;
          
          setMessages(prev => {
            const roomMsgs = prev[newMsg.room_id] || [];
            if (roomMsgs.some(m => m.id === newMsg.id)) return prev;
            return { ...prev, [newMsg.room_id]: [...roomMsgs, newMsg] };
          });

          if (newMsg.sender_id !== currentUser?.id) {
            playNewMessageSound();
            if (newMsg.room_id !== activeTabId) {
              setUnreadCount(count => count + 1);
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isOpen, currentUser, activeTabId]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTabId]);

  // Dragging Handlers
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
      alert('No se pudo acceder a la cámara.');
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
        alert('Acceso al micrófono denegado.');
      }
    }
  };

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
      console.error('Error al subir archivo:', err);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const type = file.type.startsWith('image/') ? 'image' : 'file';
    uploadAndSendAttachment(file, type);
  };

  const sendMessage = async (text = inputText, attachmentUrl = null, attachmentType = null) => {
    if (!text.trim() && !attachmentUrl) return;
    if (!activeTabId) return;

    const payload = {
      room_id: activeTabId,
      sender_id: currentUser?.id || null,
      sender_name: currentUser?.username || 'Usuario TI',
      content: text.trim(),
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
      status: 'sent'
    };

    const { error } = await supabase.from('chat_messages').insert([payload]);
    if (error) {
      console.error('Error al registrar mensaje en Supabase:', error.message);
      return;
    }
    
    setInputText('');
  };

  if (!isOpen) return null;

  const activeRoom = rooms.find(r => r.id === activeTabId);
  const currentMessages = messages[activeTabId] || [];
  const currentPeerUsername = getRoomTitle(activeRoom);

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
      {/* HEADER BAR (DRAGGABLE) - Estilo Referencia con Avatar e Info del Usuario */}
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
          
          {view === 'chat' && activeRoom ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: '11px', fontWeight: 700 }}>
                {currentPeerUsername.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC' }}>
                {currentPeerUsername}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC' }}>
              {view === 'new_chat' ? 'Nuevo Chat' : 'Chat Directo'} 
              {unreadCount > 0 && view !== 'chat' && ` (${unreadCount})`}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {view !== 'list' && (
            <button 
              onClick={() => setView('list')}
              style={{ background: 'none', border: 'none', color: '#38BDF8', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              <ArrowLeft size={12} /> Chats
            </button>
          )}
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
          {/* VIEW 1: CHAT ROOMS INBOX LIST */}
          {view === 'list' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0B0F19', overflowY: 'auto' }}>
              <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E293B' }}>
                <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>Conversaciones</span>
                <button 
                  onClick={() => { setView('new_chat'); fetchTenantUsers(); }}
                  style={{ background: '#2563EB', color: '#FFF', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                >
                  + Nuevo Chat
                </button>
              </div>

              {rooms.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '12px' }}>
                  No hay chats activos. ¡Inicia uno nuevo!
                </div>
              ) : (
                rooms.map(room => {
                  const peerName = getRoomTitle(room);
                  return (
                    <div 
                      key={room.id}
                      onClick={() => { setActiveTabId(room.id); setView('chat'); setUnreadCount(0); }}
                      style={{ padding: '12px 14px', borderBottom: '1px solid #1E293B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#1E293B'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: '12px', fontWeight: 600 }}>
                        {peerName.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', color: '#F8FAFC', fontWeight: 600 }}>
                          {peerName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                          {room.is_group ? 'Grupo de trabajo' : (room.recipient_username || room.username || room.recipient_id || room.user_id || peerName)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* VIEW 2: NEW CHAT - USER DIRECTORY LIST */}
          {view === 'new_chat' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0B0F19', overflowY: 'auto' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #1E293B', fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>
                Selecciona un trabajador del hospital
              </div>

              {loadingUsers ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>Cargando personal...</div>
              ) : (
                allUsers
                  .filter(u => u.id !== currentUser?.id)
                  .map(user => (
                    <div 
                      key={user.id}
                      onClick={() => handleSelectUserToChat(user)}
                      style={{ padding: '10px 14px', borderBottom: '1px solid #1E293B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#1E293B'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: '11px', fontWeight: 600 }}>
                        {user.username?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#F8FAFC', fontWeight: 600 }}>{user.username}</div>
                        <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                          Rol: {user.role || 'Personal'}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* VIEW 3: ACTIVE CONVERSATION */}
          {view === 'chat' && (
            <>
              {/* MESSAGES CONTAINER */}
              <div style={{ flex: 1, padding: '12px', overflowY: 'auto', background: '#0B0F19', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {currentMessages.map((msg, i) => {
                  const isMe = msg.sender_id === currentUser?.id;
                  return (
                    <div key={msg.id || i} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                      {!isMe && (
                        <div style={{ fontSize: '10px', color: '#38BDF8', fontWeight: 600, display: 'flex', gap: '6px', marginBottom: '2px', alignItems: 'center' }}>
                          <span>{msg.sender_name}</span>
                        </div>
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
                  <Send size= {14} />
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}