export function usePresence(currentUser, supabase) {
  const [presenceState, setPresenceState] = useState({});
  const [myStatus, setMyStatus] = useState('online');
  const idleTimerRef = useRef(null);

  const resetIdleTimer = () => {
    if (myStatus !== 'online') {
      updateStatus('online');
    }
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    
    // Set status to 'afk' after 2 minutes of inactivity
    idleTimerRef.current = setTimeout(() => {
      updateStatus('afk');
    }, 120000);
  };

  const updateStatus = async (status) => {
    setMyStatus(status);
    if (!currentUser?.id) return;
    try {
      await supabase
        .from('user_presence')
        .upsert({ user_id: currentUser.id, status, last_seen: new Date().toISOString() });
    } catch (e) {
      console.error('Presence update error:', e);
    }
  };

  useEffect(() => {
    if (!currentUser?.id) return;

    // Activity listeners
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));
    resetIdleTimer();

    // Subscribe to presence changes
    const channel = supabase
      .channel('presence-room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, (payload) => {
        setPresenceState(prev => ({ ...prev, [payload.new.user_id]: payload.new.status }));
      })
      .subscribe();

    // Set offline on tab close
    const handleUnload = () => updateStatus('offline');
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      window.removeEventListener('beforeunload', handleUnload);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  return { presenceState, myStatus };
}