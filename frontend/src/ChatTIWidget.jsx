import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, MessageCircle, Users, Send, Paperclip, Mic, 
  Camera, X, Check, CheckCheck, Image, Volume2, UserPlus, StopCircle, Trash2
} from 'lucide-react';
import { apiFetch } from './api';

export function ChatTIWidget({ currentUser, supabase, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'groups' | 'new_direct' | 'new_group'
  const [rooms, setRooms] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [presences, setPresences] = useState({}); // ✅ 1. Movid a nivel superior
  
  // Estados para cámara y audios
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Estados de formulario de creación de grupo
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);

  // Cargar lista de salas y presencia inicial al abrir
  useEffect(() => {
    if (isOpen) {
      loadUserRooms();
      loadAllUsers();
      updatePresence('online');
    }
  }, [isOpen]);

  // ✅ 2. useEffect de Presencia y Heartbeat (Movid a nivel superior independiente)
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
    const { data } = await supabase
      .from('chat_room_members')
      .select('room_id, chat_rooms(*)')
      .eq('user_id', currentUser.id);

    if (data) {
      const roomList = data.map(item => item.chat_rooms).filter(Boolean);
      setRooms(roomList);
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

  // ✅ 3. Escuchar mensajes en tiempo real (Unificado sin duplicados)
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

        // Transición de Estado de Mensaje Entrante
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

  // ✅ 4. Liberación de hardware (Cámara)
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
          name: groupName,
          description: groupDesc,
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
    if (!newMessageText.trim() && !mediaUrl) return;

    const msgData = {
      room_id: selectedRoom.id,
      sender_id: currentUser.id,
      sender_name: currentUser.username || currentUser.email,
      content: newMessageText.trim(),
      media_url: mediaUrl,
      media_type: mediaType,
      status: 'sent',
      created_at: new Date().toISOString()
    };

    setNewMessageText('');
    setAudioBlob(null);

    await supabase.from('chat_messages').insert([msgData]);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('media_type', file.type.startsWith('image/') ? 'image' : 'file');

    const res = await apiFetch('/chat/upload', { method: 'POST', body: formData });
    if (res.ok) {
      const { media_url, media_type } = await res.json();
      await handleSendMessage(media_url, media_type);
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

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[560px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden text-slate-100 font-sans">
      
      {/* Header del Chat */}
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

      {/* Si hay una sala seleccionada, mostrar la conversación */}
      {selectedRoom ? (
        <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
          
          {/* Panel de Mensajes */}
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
                    {msg.content && <p className="leading-relaxed whitespace-pre-wrap pr-10">{msg.content}</p>}

                    {msg.media_type === 'image' && (
                      <img src={msg.media_url} alt="multimedia" className="rounded-lg max-h-48 object-cover my-1" />
                    )}
                    {msg.media_type === 'audio' && (
                      <audio controls src={msg.media_url} className="w-48 h-8 my-1" />
                    )}
                    {msg.media_type === 'file' && (
                      <a href={msg.media_url} target="_blank" rel="noreferrer" className="underline text-cyan-200 block my-1">
                        Ver archivo adjunto
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

          <div className="p-2.5 bg-slate-950 border-t border-slate-800 flex items-center gap-1.5">
            <label className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer">
              <Paperclip size={16} />
              <input type="file" onChange={handleFileUpload} className="hidden" />
            </label>

            <button onClick={openCamera} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400">
              <Camera size={16} />
            </button>

            {isRecording ? (
              <button onClick={stopRecording} className="p-1.5 bg-red-600/20 text-red-400 rounded-lg animate-pulse">
                <StopCircle size={16} />
              </button>
            ) : (
              <button onClick={startRecording} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400">
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
      ) : (
        <div className="flex-1 flex flex-col bg-slate-900">
          <div className="flex border-b border-slate-800 bg-slate-950 text-xs">
            <button
              onClick={() => setActiveTab('chats')}
              className={`flex-1 py-2.5 font-medium border-b-2 transition-colors ${activeTab === 'chats' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400'}`}
            >
              Chats Directos
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`flex-1 py-2.5 font-medium border-b-2 transition-colors ${activeTab === 'groups' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400'}`}
            >
              Grupos
            </button>
            <button
              onClick={() => setActiveTab('new_group')}
              className={`px-3 py-2.5 font-medium text-slate-400 hover:text-cyan-400 flex items-center gap-1`}
              title="Crear Nuevo Grupo"
            >
              <UserPlus size={14} />
            </button>
          </div>

          <div className="flex-1 p-3 overflow-y-auto">
            {activeTab === 'chats' && (
              <div className="space-y-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Usuarios Disponibles
                </span>
                {allUsers.map((u) => {
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
                })}
              </div>
            )}

            {activeTab === 'groups' && (
              <div className="space-y-2">
                {rooms.filter(r => r.is_group).length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">No perteneces a ningún grupo aún.</p>
                ) : (
                  rooms.filter(r => r.is_group).map((g) => (
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