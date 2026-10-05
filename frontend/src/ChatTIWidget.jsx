import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, MessageCircle, Users, Send, Paperclip, Mic, 
  Camera, X, Check, CheckCheck, Image, Volume2, UserPlus, StopCircle, Trash2, FileText,
  Search 
} from 'lucide-react';
import { apiFetch } from './api';


// Filtrar usuarios directos por nombre o email
  const filteredUsers = allUsers.filter(u => {
    const name = u.username || u.email || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Filtrar grupos por nombre o descripción
  const filteredGroups = rooms.filter(r => r.is_group).filter(g => {
    const name = g.name || '';
    const desc = g.description || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           desc.toLowerCase().includes(searchQuery.toLowerCase());
  });
// Maximum allowed file size (10 MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'application/msword', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'audio/webm', 'audio/wav', 'audio/mp3'
];

export function ChatTIWidget({ currentUser, supabase, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [rooms, setRooms] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [presences, setPresences] = useState({});
  const [uploadError, setUploadError] = useState(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadUserRooms();
      loadAllUsers();
      updatePresence('online');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!currentUser?.id || !isOpen) return;

    const sendHeartbeat = async () => {
      await supabase.from('user_presence').upsert({
        user_id: currentUser.id,
        status: 'online',
        last_seen: new Date().toISOString()
      });
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);

    const presenceChannel = supabase
      .channel('online_presence_channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_presence'
      }, (payload) => {
        setPresences(prev => ({
          ...prev,
          [payload.new.user_id]: payload.new
        }));
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(presenceChannel);
      supabase.from('user_presence').upsert({
        user_id: currentUser.id,
        status: 'offline',
        last_seen: new Date().toISOString()
      });
    };
  }, [currentUser, isOpen]);

  const updatePresence = async (status) => {
    if (!currentUser?.id) return;
    await supabase.from('user_presence').upsert({
      user_id: currentUser.id,
      status: status,
      last_seen: new Date().toISOString()
    });
  };

  const loadUserRooms = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await apiFetch('/chat/rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data || []);
      }
    } catch (e) {
      console.error('Error al cargar salas:', e);
    }
  };

  const loadAllUsers = async () => {
    try {
      const res = await apiFetch('/users');
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data.filter(u => u.id !== currentUser?.id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!selectedRoom?.id) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', selectedRoom.id)
        .order('created_at', { ascending: true });

      setMessages(data || []);
      markMessagesAsRead(data || []);
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat_messages:${selectedRoom.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${selectedRoom.id}`
      }, async (payload) => {
        setMessages(prev => [...prev, payload.new]);

        if (payload.new.sender_id !== currentUser?.id) {
          if (document.hasFocus()) {
            await supabase.from('chat_messages').update({ status: 'read' }).eq('id', payload.new.id);
          } else {
            await supabase.from('chat_messages').update({ status: 'delivered' }).eq('id', payload.new.id);
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${selectedRoom.id}`
      }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRoom, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const stopCameraStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const handleCloseWidget = () => {
    stopCameraStream();
    onClose();
  };

  const markMessagesAsRead = async (msgList) => {
    const unread = msgList
      .filter(m => m.sender_id !== currentUser?.id && m.status !== 'read')
      .map(m => m.id);

    if (unread.length > 0) {
      await supabase.from('chat_messages').update({ status: 'read' }).in('id', unread);
    }
  };

  const handleStartDirectChat = async (targetUserId) => {
    try {
      const res = await apiFetch('/chat/direct', {
        method: 'POST',
        body: JSON.stringify({ target_user_id: targetUserId })
      });
      if (res.ok) {
        const { room_id } = await res.json();
        await loadUserRooms();
        const targetUser = allUsers.find(u => u.id === targetUserId);
        setSelectedRoom({ id: room_id, name: targetUser?.username || 'Chat Directo', is_group: false });
        setActiveTab('chats');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedMembers.length === 0) return;

    try {
      const res = await apiFetch('/chat/group', {
        method: 'POST',
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDesc.trim(),
          member_ids: selectedMembers
        })
      });

      if (res.ok) {
        const { room_id } = await res.json();
        setGroupName('');
        setGroupDesc('');
        setSelectedMembers([]);
        await loadUserRooms();
        setSelectedRoom({ id: room_id, name: groupName, is_group: true });
        setActiveTab('groups');
      }
    } catch (e) {
      console.error(e);
    }
  };

const handleSendMessage = async (mediaUrl = null, mediaType = null) => {
    const cleanText = newMessageText.trim();
    if (!cleanText && !mediaUrl) return;

    const bodyData = {
      room_id: selectedRoom.id,
      content: cleanText,
      media_url: mediaUrl,
      media_type: mediaType || 'text'
    };

    setNewMessageText('');
    setAudioBlob(null);

    try {
      await apiFetch('/chat/messages', {
        method: 'POST',
        body: JSON.stringify(bodyData)
      });
    } catch (e) {
      console.error('Error al enviar mensaje:', e);
    }
  };

  // Improved File Upload Handler with Validation & Error Handling
  const handleFileUpload = async (e) => {
    setUploadError(null);
    const file = e.target.files[0];
    if (!file) return;

    // 1. File Size Guardrail
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('El archivo supera el límite de 10 MB');
      return;
    }

    // 2. File Type Guardrail
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setUploadError('Tipo de archivo no permitido');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('media_type', file.type.startsWith('image/') ? 'image' : 'file');

    try {
      const res = await apiFetch('/chat/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const { media_url, media_type } = await res.json();
        await handleSendMessage(media_url, media_type);
      } else {
        const errData = await res.json().catch(() => ({}));
        setUploadError(errData.message || 'Error al subir el archivo');
      }
    } catch (err) {
      setUploadError('Error de red al subir archivo');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      alert('Permiso de micrófono denegado');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const sendAudioMessage = async () => {
    if (!audioBlob) return;
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio_record.webm');
    formData.append('media_type', 'audio');

    const res = await apiFetch('/chat/upload', { method: 'POST', body: formData });
    if (res.ok) {
      const { media_url, media_type } = await res.json();
      await handleSendMessage(media_url, media_type);
    }
  };

  const openCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert('No se pudo acceder a la cámara');
      setShowCamera(false);
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      stopCameraStream();

      canvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('file', blob, 'camera_photo.jpg');
        formData.append('media_type', 'image');

        const res = await apiFetch('/chat/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const { media_url, media_type } = await res.json();
          await handleSendMessage(media_url, media_type);
        }
      }, 'image/jpeg');
    }
  };

  const getFileNameFromUrl = (url) => {
    if (!url) return 'Documento Adjunto';
    try {
      const decoded = decodeURIComponent(url);
      return decoded.split('/').pop().split('?')[0];
    } catch {
      return 'Documento Adjunto';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[560px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden text-slate-100 font-sans">
      
      {/* Header */}
      <div className="bg-slate-950 p-3.5 border-b border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <MessageSquare className="text-cyan-400" size={18} />
          <span className="font-semibold text-sm">
            {selectedRoom ? selectedRoom.name : 'Centro de Mensajería TI'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {selectedRoom && (
            <button onClick={() => setSelectedRoom(null)} className="p-1 hover:bg-slate-800 rounded text-slate-400 text-xs mr-2">
              Volver
            </button>
          )}
          <button onClick={handleCloseWidget} className="p-1 hover:bg-slate-800 rounded-full text-slate-400">
            <X size={16} />
          </button>
        </div>
      </div>

      {selectedRoom ? (
        <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
          
          {/* Message List */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            {messages.map((msg) => {
              const isMe = msg.sender_id === currentUser?.id;
              const formattedTime = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && <span className="text-[10px] text-slate-400 ml-1 mb-0.5">{msg.sender_name}</span>}
                  
                  <div className={`relative px-3 py-2 rounded-2xl max-w-[80%] text-xs shadow-md ${
                    isMe ? 'bg-cyan-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none'
                  }`}>
                    {msg.content && <p className="leading-relaxed whitespace-pre-wrap pr-6">{msg.content}</p>}

                    {msg.media_type === 'image' && (
                      <img src={msg.media_url} alt="multimedia" className="rounded-lg max-h-48 object-cover my-1" />
                    )}
                    {msg.media_type === 'audio' && (
                      <audio controls src={msg.media_url} className="w-48 h-8 my-1" />
                    )}
                    {/* Enhanced Document / File Display */}
                    {msg.media_type === 'file' && (
                      <a 
                        href={msg.media_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        download
                        className="flex items-center gap-2 p-2 my-1 bg-slate-900/60 hover:bg-slate-950 rounded-lg text-cyan-300 border border-slate-700/50 transition-colors"
                      >
                        <FileText size={18} className="shrink-0 text-cyan-400" />
                        <span className="truncate text-[11px] max-w-[160px]" title={getFileNameFromUrl(msg.media_url)}>
                          {getFileNameFromUrl(msg.media_url)}
                        </span>
                      </a>
                    )}

                    <div className="flex items-center justify-end gap-1 mt-1 text-[9px] opacity-70 text-right">
                      <span>{formattedTime}</span>
                      {isMe && (
                        <span>
                          {msg.status === 'read' ? (
                            <CheckCheck size={12} className="text-cyan-200 font-bold" title="Leído" />
                          ) : msg.status === 'delivered' ? (
                            <CheckCheck size={12} className="text-slate-300" title="Entregado" />
                          ) : (
                            <Check size={12} className="text-slate-300" title="Enviándose / Enviado" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Upload Error Banner */}
          {uploadError && (
            <div className="px-3 py-1.5 bg-red-900/80 text-red-200 text-[11px] flex justify-between items-center border-t border-red-800">
              <span>{uploadError}</span>
              <button onClick={() => setUploadError(null)} className="hover:text-white"><X size={12} /></button>
            </div>
          )}

          {audioBlob && (
            <div className="p-2 bg-slate-950 flex items-center justify-between border-t border-slate-800">
              <span className="text-xs text-cyan-400">Audio listo para enviar</span>
              <div className="flex gap-2">
                <button onClick={sendAudioMessage} className="px-2 py-1 bg-cyan-600 text-xs rounded-lg font-medium">Enviar</button>
                <button onClick={() => setAudioBlob(null)} className="p-1 text-red-400"><Trash2 size={14}/></button>
              </div>
            </div>
          )}

          {showCamera && (
            <div className="p-2 bg-slate-950 border-t border-slate-800 flex flex-col items-center">
              <video ref={videoRef} autoPlay playsInline className="w-full h-36 bg-black rounded-lg" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="flex gap-2 mt-2">
                <button onClick={capturePhoto} className="px-3 py-1 bg-cyan-600 text-xs rounded-lg font-medium">Tomar foto</button>
                <button onClick={stopCameraStream} className="px-3 py-1 bg-slate-800 text-xs rounded-lg">Cancelar</button>
              </div>
            </div>
          )}

          {/* Input Controls */}
          <div className="p-2.5 bg-slate-950 border-t border-slate-800 flex items-center gap-1.5">
            <label className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer" title="Adjuntar documento o imagen">
              <Paperclip size={16} />
              <input 
                type="file" 
                onChange={handleFileUpload} 
                className="hidden" 
                accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
              />
            </label>

            <button onClick={openCamera} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400" title="Cámara">
              <Camera size={16} />
            </button>

            {isRecording ? (
              <button onClick={stopRecording} className="p-1.5 bg-red-600/20 text-red-400 rounded-lg animate-pulse">
                <StopCircle size={16} />
              </button>
            ) : (
              <button onClick={startRecording} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400" title="Grabar audio">
                <Mic size={16} />
              </button>
            )}

            <input
              type="text"
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Escribe un mensaje..."
              className="flex-1 bg-slate-800 border-none rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />

            <button onClick={() => handleSendMessage()} className="p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition-colors">
              <Send size={14} />
            </button>
          </div>
        </div>
      ) : (<div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
          {/* Navegación por pestañas */}
          <div className="flex border-b border-slate-800 bg-slate-950 text-xs">
            <button
              onClick={() => { setActiveTab('chats'); setSearchQuery(''); }}
              className={`flex-1 py-2.5 font-medium border-b-2 transition-colors ${activeTab === 'chats' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400'}`}
            >
              Chats Directos
            </button>
            <button
              onClick={() => { setActiveTab('groups'); setSearchQuery(''); }}
              className={`flex-1 py-2.5 font-medium border-b-2 transition-colors ${activeTab === 'groups' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400'}`}
            >
              Grupos
            </button>
            <button
              onClick={() => { setActiveTab('new_group'); setSearchQuery(''); }}
              className={`px-3 py-2.5 font-medium text-slate-400 hover:text-cyan-400 flex items-center gap-1`}
              title="Crear Nuevo Grupo"
            >
              <UserPlus size={14} />
            </button>
          </div>

          {/* BARRA DE BÚSQUEDA (Solo visible en Chats Directos y Grupos) */}
          {(activeTab === 'chats' || activeTab === 'groups') && (
            <div className="p-2.5 bg-slate-950 border-b border-slate-800">
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={activeTab === 'chats' ? "Buscar usuario..." : "Buscar grupo..."}
                  className="w-full bg-slate-800 border border-slate-700/60 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-colors"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-200"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 p-3 overflow-y-auto">
            {/* Pestaña: Chats Directos */}
            {activeTab === 'chats' && (
              <div className="space-y-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Usuarios Disponibles ({filteredUsers.length})
                </span>
                {filteredUsers.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No se encontraron usuarios.</p>
                ) : (
                  filteredUsers.map((u) => {
                    const isOnline = presences[u.id]?.status === 'online';
                    return (
                      <div
                        key={u.id}
                        onClick={() => handleStartDirectChat(u.id)}
                        className="flex items-center justify-between p-2.5 bg-slate-800/60 hover:bg-slate-800 rounded-xl cursor-pointer transition-all border border-slate-800"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-cyan-900/50 text-cyan-300 flex items-center justify-center font-bold text-xs border border-cyan-500/30">
                              {(u.username || u.email || 'U')[0].toUpperCase()}
                            </div>
                            <span 
                              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${isOnline ? 'bg-emerald-500' : 'bg-slate-500'}`} 
                              title={isOnline ? "Online" : "Offline"} 
                            />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-200">{u.username || u.email}</p>
                            <p className="text-[10px] text-slate-400">{u.role}</p>
                          </div>
                        </div>
                        <MessageCircle size={14} className="text-slate-500" />
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Pestaña: Grupos */}
            {activeTab === 'groups' && (
              <div className="space-y-2">
                {filteredGroups.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">
                    {searchQuery ? 'No se encontraron grupos.' : 'No perteneces a ningún grupo aún.'}
                  </p>
                ) : (
                  filteredGroups.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => setSelectedRoom(g)}
                      className="p-3 bg-slate-800/60 hover:bg-slate-800 rounded-xl cursor-pointer transition-all border border-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-cyan-400" />
                        <span className="text-xs font-semibold text-slate-200">{g.name}</span>
                      </div>
                      {g.description && <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{g.description}</p>}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Pestaña: Crear Nuevo Grupo */}
            {activeTab === 'new_group' && (
                  <form onSubmit={handleCreateGroup} className="space-y-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Nombre del Grupo</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Ej. Soporte Sistemas"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Descripción</label>
                  <textarea
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                    placeholder="Propósito del grupo..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 h-16 resize-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Seleccionar Miembros</label>
                  <div className="max-h-36 overflow-y-auto space-y-1 bg-slate-950 p-2 rounded-lg border border-slate-800">
                    {allUsers.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 p-1 hover:bg-slate-800 rounded cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedMembers([...selectedMembers, u.id]);
                            else setSelectedMembers(selectedMembers.filter(id => id !== u.id));
                          }}
                          className="rounded text-cyan-600 focus:ring-0"
                        />
                        <span>{u.username || u.email}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 font-medium text-xs rounded-xl transition-all"
                >
                  Crear Grupo
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}