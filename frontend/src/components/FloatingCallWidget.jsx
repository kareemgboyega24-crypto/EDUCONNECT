import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCall } from '../context/CallContext.jsx';

export default function FloatingCallWidget() {
  const { activeRoomId, participants, localStream, micOn, leaveCall } = useCall();
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef();

  useEffect(() => {
    if (videoRef.current && localStream) videoRef.current.srcObject = localStream;
  }, [localStream]);

  // Only show when a call is active AND we're not currently looking at that call's full-screen page
  const onCallPage = location.pathname === `/call/${activeRoomId}`;
  if (!activeRoomId || onCallPage) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-ink rounded-2xl shadow-2xl border border-white/10 p-3 w-56 flex flex-col gap-2">
      <div className="relative rounded-lg overflow-hidden bg-slate-850 aspect-video">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        {!micOn && (
          <span className="absolute top-1.5 right-1.5 text-xs bg-clay text-white px-1.5 py-0.5 rounded-full">Muted</span>
        )}
      </div>
      <p className="text-white/60 text-xs text-center">
        In call · {participants.length + 1} {participants.length + 1 === 1 ? 'person' : 'people'}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/call/${activeRoomId}`)}
          className="flex-1 bg-indigo-650 text-white text-xs font-medium rounded-lg py-2 hover:bg-indigo-650/80 transition-colors"
        >
          Open
        </button>
        <button
          onClick={leaveCall}
          className="flex-1 bg-white/10 text-white text-xs font-medium rounded-lg py-2 hover:bg-clay transition-colors"
        >
          Leave
        </button>
      </div>
    </div>
  );
}
