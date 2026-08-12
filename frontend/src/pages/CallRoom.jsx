import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCall } from '../context/CallContext.jsx';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉'];

// getDisplayMedia (the browser API screen sharing relies on) is not supported on
// iOS Safari at all, and is inconsistent/unreliable on Android browsers - this is a
// platform limitation, not something the app can add. Detecting it lets us show a
// clear message instead of the button silently doing nothing on phones.
const SCREEN_SHARE_SUPPORTED = typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

export default function CallRoom() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    activeRoomId, participants, micOn, camOn, sharingScreen, myHandRaised, localStream, reactions,
    joinCall, leaveCall, toggleMic, toggleCam, toggleScreenShare, sendReaction, toggleRaiseHand
  } = useCall();

  const localVideoRef = useRef();

  // Join this room if we're not already in it (e.g. fresh visit, not re-opening from the widget)
  useEffect(() => {
    if (activeRoomId !== roomId) {
      joinCall(roomId, user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  const minimize = () => navigate('/'); // call keeps running in the background via CallContext

  const endCall = () => {
    leaveCall();
    navigate('/');
  };

  const gridCols = participants.length + 1 <= 2 ? 'sm:grid-cols-2' : participants.length + 1 <= 4 ? 'sm:grid-cols-2' : 'sm:grid-cols-3';
  const joined = activeRoomId === roomId;

  return (
    <div className="min-h-screen bg-ink flex flex-col relative">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={minimize} className="text-white/50 text-sm hover:text-white">
            ↓ Minimize (call stays active)
          </button>
          <button onClick={endCall} className="text-clay text-sm hover:text-clay/70">
            Leave call
          </button>
        </div>
        <p className="text-white/40 text-xs">{joined ? `Room: ${roomId} · ${participants.length + 1} in call` : 'Connecting…'}</p>
      </div>

      <div className={`flex-1 grid grid-cols-1 ${gridCols} gap-3 p-6`}>
        <VideoTile
          label={`${user.fullName} (you)`}
          muted
          stream={null}
          videoRef={localVideoRef}
          camOn={camOn}
          handRaised={myHandRaised}
        />
        {participants.map((p) => (
          <VideoTile key={p.socketId} label={p.fullName} stream={p.stream} handRaised={p.handRaised} />
        ))}
      </div>

      {/* Floating reaction toasts */}
      <div className="absolute bottom-24 left-6 flex flex-col gap-2 pointer-events-none">
        {reactions.map((r) => (
          <div key={r.id} className="bg-black/50 text-white text-sm px-3 py-1.5 rounded-full w-fit animate-pulse">
            {r.emoji} {r.fullName}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 pb-8 flex-wrap px-4">
        <ControlButton active={micOn} onClick={toggleMic} onLabel="Mute" offLabel="Unmute" />
        <ControlButton active={camOn} onClick={toggleCam} onLabel="Stop video" offLabel="Start video" />
        <button
          onClick={() => {
            if (!SCREEN_SHARE_SUPPORTED) {
              alert("Screen sharing isn't supported in mobile browsers yet — this is a limitation of phones, not this app. Try from a laptop or desktop computer instead.");
              return;
            }
            toggleScreenShare(roomId);
          }}
          className={`px-5 py-3 rounded-full text-sm font-medium transition-colors ${
            sharingScreen ? 'bg-clay text-white' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {sharingScreen ? 'Stop sharing' : 'Share screen'}
        </button>
        <button
          onClick={() => toggleRaiseHand(roomId)}
          className={`px-5 py-3 rounded-full text-sm font-medium transition-colors ${
            myHandRaised ? 'bg-indigo-650 text-white' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          ✋ {myHandRaised ? 'Lower hand' : 'Raise hand'}
        </button>
        <div className="flex items-center gap-1 bg-white/10 rounded-full px-2 py-1">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => sendReaction(roomId, emoji)}
              className="text-lg px-2 py-1 rounded-full hover:bg-white/20 transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function VideoTile({ label, stream, videoRef, muted, camOn = true, handRaised }) {
  const ref = useRef();
  useEffect(() => {
    const el = videoRef?.current || ref.current;
    if (el && stream) el.srcObject = stream;
  }, [stream, videoRef]);

  return (
    <div className="relative bg-slate-850 rounded-2xl overflow-hidden flex items-center justify-center min-h-[220px]">
      {camOn ? (
        <video ref={videoRef || ref} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
      ) : (
        <div className="w-14 h-14 rounded-full bg-indigo-650/30 flex items-center justify-center text-white font-semibold">
          {label.split(' ').map((p) => p[0]).slice(0, 2).join('')}
        </div>
      )}
      {handRaised && (
        <span className="absolute top-2 right-2 text-lg bg-indigo-650 rounded-full w-8 h-8 flex items-center justify-center">✋</span>
      )}
      <span className="absolute bottom-2 left-3 text-white text-xs bg-black/40 px-2 py-1 rounded-full">{label}</span>
    </div>
  );
}

function ControlButton({ active, onClick, onLabel, offLabel }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-3 rounded-full text-sm font-medium transition-colors ${
        active ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-clay text-white'
      }`}
    >
      {active ? onLabel : offLabel}
    </button>
  );
}
