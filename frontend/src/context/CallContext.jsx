import { createContext, useContext, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import client, { API_BASE } from '../api/client';

const CallContext = createContext(null);

// Fallback if the backend's TURN-credential endpoint can't be reached at all -
// STUN-only, which works for straightforward networks but not across restrictive
// NATs/firewalls (see fetchIceServers below for the real, TURN-inclusive path).
const FALLBACK_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export function CallProvider({ children }) {
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [participants, setParticipants] = useState([]); // [{socketId, userId, fullName, role, handRaised, stream}]
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [myHandRaised, setMyHandRaised] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [reactions, setReactions] = useState([]); // [{id, fullName, emoji}] - transient, auto-expire

  const socketRef = useRef();
  const localStreamRef = useRef();
  const screenStreamRef = useRef();
  const peersRef = useRef({}); // socketId -> RTCPeerConnection
  const iceServersRef = useRef(FALLBACK_ICE_SERVERS);

  const createPeerConnection = useCallback((socketId, isInitiator) => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('call:signal', { to: socketId, signal: { type: 'ice-candidate', candidate: event.candidate } });
      }
    };

    pc.ontrack = (event) => {
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, stream: event.streams[0] } : p))
      );
    };

    peersRef.current[socketId] = pc;

    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit('call:signal', { to: socketId, signal: { type: 'offer', sdp: pc.localDescription } });
      };
    }

    return pc;
  }, []);

  const leaveCall = useCallback(() => {
    socketRef.current?.emit('call:leave');
    socketRef.current?.disconnect();
    socketRef.current = null;

    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current = null;

    setLocalStream(null);
    setParticipants([]);
    setActiveRoomId(null);
    setReactions([]);
    setMyHandRaised(false);
    setSharingScreen(false);
    setMicOn(true);
    setCamOn(true);
  }, []);

  const joinCall = useCallback(async (roomId, user) => {
    // Already in this exact call - nothing to do (e.g. re-opening from the floating widget)
    if (socketRef.current && activeRoomId === roomId) return;
    // In a different call - leave it first
    if (socketRef.current) leaveCall();

    setActiveRoomId(roomId);

    // Fetch fresh TURN+STUN credentials for this call before connecting to any peer,
    // so cross-network calls (different countries, mobile carriers, restrictive
    // firewalls) can relay through TURN when a direct STUN-only path isn't possible.
    try {
      const { data } = await client.get('/turn-credentials');
      iceServersRef.current = data.iceServers?.length ? data.iceServers : FALLBACK_ICE_SERVERS;
    } catch (err) {
      console.error('Could not fetch TURN credentials, falling back to STUN-only:', err);
      iceServersRef.current = FALLBACK_ICE_SERVERS;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
    } catch (err) {
      console.error('Could not access camera/microphone', err);
    }

    const socket = io(API_BASE);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('call:join', { roomId, userId: user.id, fullName: user.fullName, role: user.role });
    });

    socket.on('call:existing-participants', (existing) => {
      setParticipants((prev) => {
        const existingIds = new Set(prev.map((p) => p.socketId));
        const merged = [...prev];
        existing.forEach((p) => { if (!existingIds.has(p.socketId)) merged.push({ ...p, stream: null }); });
        return merged;
      });
      existing.forEach((p) => createPeerConnection(p.socketId, true));
    });

    socket.on('call:participant-joined', (p) => {
      setParticipants((prev) => {
        if (prev.some((existing) => existing.socketId === p.socketId)) return prev;
        return [...prev, { ...p, stream: null }];
      });
      createPeerConnection(p.socketId, false);
    });

    socket.on('call:signal', async ({ from, signal }) => {
      let pc = peersRef.current[from];
      if (!pc) pc = createPeerConnection(from, false);

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('call:signal', { to: from, signal: { type: 'answer', sdp: pc.localDescription } });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'ice-candidate') {
        try { await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)); } catch (e) { /* ignore */ }
      }
    });

    socket.on('call:participant-left', ({ socketId }) => {
      peersRef.current[socketId]?.close();
      delete peersRef.current[socketId];
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
    });

    socket.on('call:reaction', ({ fullName, emoji }) => {
      const id = `${Date.now()}-${Math.random()}`;
      setReactions((prev) => [...prev, { id, fullName, emoji }]);
      setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 3000);
    });

    socket.on('call:hand-toggle', ({ socketId, raised }) => {
      setParticipants((prev) => prev.map((p) => (p.socketId === socketId ? { ...p, handRaised: raised } : p)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, createPeerConnection, leaveCall]);

  const toggleMic = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMicOn((prev) => !prev);
  }, []);

  const toggleCam = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setCamOn((prev) => !prev);
  }, []);

  const stopScreenShare = useCallback((roomId) => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    const camTrack = localStreamRef.current?.getVideoTracks()[0];
    Object.values(peersRef.current).forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender && camTrack) sender.replaceTrack(camTrack);
    });
    socketRef.current?.emit('call:screen-share-toggle', { roomId, sharing: false });
    setSharingScreen(false);
  }, []);

  const toggleScreenShare = useCallback(async (roomId) => {
    if (sharingScreen) {
      stopScreenShare(roomId);
      return;
    }
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      Object.values(peersRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      });

      screenTrack.onended = () => stopScreenShare(roomId);
      socketRef.current?.emit('call:screen-share-toggle', { roomId, sharing: true });
      setSharingScreen(true);
    } catch (err) {
      console.error('Screen share cancelled or failed', err);
    }
  }, [sharingScreen, stopScreenShare]);

  const sendReaction = useCallback((roomId, emoji) => {
    socketRef.current?.emit('call:reaction', { roomId, emoji });
  }, []);

  const toggleRaiseHand = useCallback((roomId) => {
    setMyHandRaised((prev) => {
      const next = !prev;
      socketRef.current?.emit('call:hand-toggle', { roomId, raised: next });
      return next;
    });
  }, []);

  const value = {
    activeRoomId,
    participants,
    micOn,
    camOn,
    sharingScreen,
    myHandRaised,
    localStream,
    reactions,
    screenStreamRef,
    joinCall,
    leaveCall,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    sendReaction,
    toggleRaiseHand
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  return useContext(CallContext);
}
