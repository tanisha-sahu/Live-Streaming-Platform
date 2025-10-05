import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { useSocket } from '../../../context/SocketProvider';

export const usePeerJS = (roomId, user, localStream) => {
  const socket = useSocket();
  const peerRef = useRef(null);
  const [peers, setPeers] = useState({});
  const localStreamRef = useRef(null);

  useEffect(() => {
  if (!socket || !user) return;
  // keep a ref to the latest localStream so callers can replace tracks later
  localStreamRef.current = localStream;

    // This is the updated configuration to fix the 404 error
    const peer = new Peer(user.id, {
      host: '/', // Use root host
      port: window.location.port, // Use the same port as the frontend
      path: '/peerjs/myapp', // The path we configured in Express
    });
    peerRef.current = peer;

    peer.on('open', (peerId) => {
      socket.emit('room:join', { roomId, user });
    });

    peer.on('call', (call) => {
      call.answer(localStreamRef.current);
      call.on('stream', (remoteStream) => {
        setPeers(prev => ({
          ...prev,
          [call.peer]: { call, stream: remoteStream, user: { id: call.peer } }
        }));
      });
    });

    const handleNewUser = ({ user: newUser }) => {
      if (newUser.id === user.id) return;
      const call = peer.call(newUser.id, localStreamRef.current);
      call.on('stream', (remoteStream) => {
        setPeers(prev => ({
          ...prev,
          [newUser.id]: { call, stream: remoteStream, user: newUser }
        }));
      });
    };

    const handleUserLeft = ({ userId }) => {
      if (peers[userId]) {
        peers[userId].call.close();
      }
      setPeers(prev => {
        const newPeers = { ...prev };
        delete newPeers[userId];
        return newPeers;
      });
    };

    socket.on('user:joined', handleNewUser);
    socket.on('user:left', handleUserLeft);

    return () => {
      socket.off('user:joined', handleNewUser);
      socket.off('user:left', handleUserLeft);
      peer.destroy();
    };
  }, [socket, roomId, user, localStream]);

  const toggleMediaTrack = (kind, enabled) => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        if (track.kind === kind) {
          track.enabled = enabled;
        }
      });
    }
  };

  // Replace the dummy audio/video track with a real device track when available
  const replaceTrackWithDevice = async (kind) => {
    if (!localStreamRef.current) return;
    try {
      const constraints = kind === 'video' ? { video: true } : { audio: true };
      const deviceStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = kind === 'video' ? deviceStream.getVideoTracks()[0] : deviceStream.getAudioTracks()[0];
      if (!newTrack) return;

      // Remove existing track of same kind
      const oldTrack = localStreamRef.current.getTracks().find(t => t.kind === kind);
      if (oldTrack) {
        try { oldTrack.stop(); } catch(e){}
        localStreamRef.current.removeTrack(oldTrack);
      }

      localStreamRef.current.addTrack(newTrack);

      // Update all peer connections' sender to use the new track
      Object.values(peers).forEach(p => {
        const call = p.call;
        const pc = call?.peerConnection;
        if (pc) {
          const sender = pc.getSenders().find(s => s.track?.kind === kind);
          if (sender) {
            sender.replaceTrack(newTrack).catch(err => console.warn('replaceTrack failed', err));
          }
        }
      });
    } catch (err) {
      console.warn('Could not get device track for', kind, err);
    }
  };

  return { peers, toggleMediaTrack, replaceTrackWithDevice };
};
