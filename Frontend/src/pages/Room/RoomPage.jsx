import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useSocket } from "../../context/SocketProvider";
import { usePeerJS } from "../../features/video/hooks/usePeerJS";

import TldrawCanvas from "../../features/whiteboard/components/TldrawCanvas";
import RoomHeader from './RoomHeader';
import RoomFooter from './RoomFooter';
import SidePanel from '../../components/layout/SidePanel';
import Spinner from "../../components/ui/Spinner";

const RoomPage = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const socket = useSocket();
    const { user } = useSelector((state) => state.auth);

    const [localStream, setLocalStream] = useState(null);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const [participants, setParticipants] = useState([]);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [panelView, setPanelView] = useState('participants');

    const { peers, toggleMediaTrack, replaceTrackWithDevice } = usePeerJS(roomId, user, localStream);

    useEffect(() => {
        if (window.innerWidth >= 768) {
            setIsPanelOpen(true);
        }
    }, []);

    useEffect(() => {
        const getMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setLocalStream(stream);
                setIsCameraOn(true);
                setIsMicOn(true);
            } catch (error) {
                console.warn('Error accessing media devices. Joining with audio/video disabled.', error);
                // Create a tiny dummy stream with disabled tracks so the app can join without real devices
                const createDummyStream = () => {
                    try {
                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const oscillator = audioContext.createOscillator();
                        const dst = audioContext.createMediaStreamDestination();
                        oscillator.connect(dst);
                        oscillator.start();
                        const audioTrack = dst.stream.getAudioTracks()[0];

                        const canvas = document.createElement('canvas');
                        canvas.width = 1;
                        canvas.height = 1;
                        const ctx = canvas.getContext('2d');
                        if (ctx) ctx.fillRect(0, 0, 1, 1);
                        const videoStream = canvas.captureStream();
                        const videoTrack = videoStream.getVideoTracks()[0];

                        // Disable by default
                        if (audioTrack) audioTrack.enabled = false;
                        if (videoTrack) videoTrack.enabled = false;

                        return new MediaStream([audioTrack, videoTrack].filter(Boolean));
                    } catch (e) {
                        // Fallback: empty MediaStream
                        return new MediaStream();
                    }
                };

                const dummy = createDummyStream();
                setLocalStream(dummy);
                setIsCameraOn(false);
                setIsMicOn(false);
            }
        };
        if (user) getMedia();
    }, [user]);

    useEffect(() => {
        if (!socket || !user || !localStream) return;
        socket.connect();
        const handleParticipantsUpdate = (p) => setParticipants(p);
        socket.on('room:participants', handleParticipantsUpdate);
        // Also ensure we tell the server we joined when socket connects
        let didJoin = false;
        const tryJoin = () => {
            if (!didJoin && socket.connected) {
                socket.emit('room:join', { roomId, user });
                didJoin = true;
            }
        };

        if (socket.connected) tryJoin();
        socket.on('connect', tryJoin);

        return () => {
            // Inform server we are leaving
            try {
                if (didJoin) socket.emit('room:leave', { roomId });
            } catch (e) {}
            socket.off('connect', tryJoin);
            socket.off('room:participants', handleParticipantsUpdate);
            try {
                // Do not fully disconnect here; other parts of the app or middleware may rely on socket.
                // socket.disconnect();
            } catch (e) {}
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [socket, user, localStream]);

    const toggleCamera = () => {
        const willTurnOn = !isCameraOn;
        if (willTurnOn) {
            // Try to replace dummy with real camera track; if it fails, enable existing track
            replaceTrackWithDevice?.('video');
        }
        toggleMediaTrack('video', willTurnOn);
        setIsCameraOn(willTurnOn);
    };

    const toggleMicrophone = () => {
        const willTurnOn = !isMicOn;
        if (willTurnOn) {
            replaceTrackWithDevice?.('audio');
        }
        toggleMediaTrack('audio', willTurnOn);
        setIsMicOn(willTurnOn);
    };

    const handleTogglePanel = (view) => {
        if (isPanelOpen && panelView === view) {
            setIsPanelOpen(false);
        } else {
            setPanelView(view);
            setIsPanelOpen(true);
        }
    };

    if (!user || !localStream) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
                <Spinner />
                <p className="mt-4 text-lg">Initializing your workspace...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-screen bg-gray-800 text-white">
            {/* Permanent Header */}
            <RoomHeader roomId={roomId} />

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Whiteboard container */}
                <main className="flex-1 h-full relative">
                    <TldrawCanvas roomId={roomId} />
                </main>

                {/* Side Panel for participants/chat */}
                <SidePanel
                    isOpen={isPanelOpen}
                    view={panelView}
                    setView={setPanelView}
                    onClose={() => setIsPanelOpen(false)}
                    user={user}
                    localStream={localStream}
                    peers={peers}
                    participants={participants}
                    roomId={roomId}
                />
            </div>

            {/* Permanent Footer with Controls */}
            <RoomFooter
                isCameraOn={isCameraOn}
                isMicOn={isMicOn}
                panelView={panelView}
                isPanelOpen={isPanelOpen}
                toggleCamera={toggleCamera}
                toggleMicrophone={toggleMicrophone}
                togglePanel={handleTogglePanel}
                onLeave={() => navigate('/dashboard')}
            />
        </div>
    );
};

export default RoomPage;