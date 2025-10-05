const roomSocket = (io, socket, rooms) => {
  const joinRoom = ({ roomId, user }) => {
    socket.join(roomId);
    socket.data.roomId = roomId; // Store roomId on socket for disconnect handling

    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    const participant = { id: socket.id, username: user.username };
    // Avoid duplicates if the same socket already exists in the room
    const existingIndex = rooms[roomId].findIndex(p => p.id === socket.id);
    if (existingIndex === -1) {
      rooms[roomId].push(participant);
    } else {
      // Update username if it changed
      rooms[roomId][existingIndex] = participant;
    }
  console.log(`[roomSocket] ${socket.id} joined room ${roomId} as ${user.username}`);
  socket.to(roomId).emit('user:joined', { userId: socket.id, user });
  io.to(roomId).emit('room:participants', rooms[roomId]);
  console.log(`[roomSocket] Broadcasted room:participants for ${roomId}`);

    socket.on('webrtc:offer', ({ to, offer }) => {
      io.to(to).emit('webrtc:offer', { from: socket.id, offer });
    });

    socket.on('webrtc:answer', ({ to, answer }) => {
      io.to(to).emit('webrtc:answer', { from: socket.id, answer });
    });
    
    socket.on('webrtc:ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('webrtc:ice-candidate', { from: socket.id, candidate });
    });
  };
  
  const leaveRoom = ({ roomId }) => {
    socket.leave(roomId);
    if (rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(p => p.id !== socket.id);
      io.to(roomId).emit('room:participants', rooms[roomId]);
      console.log(`[roomSocket] Broadcasted room:participants for ${roomId} after leave`);
    }
    socket.to(roomId).emit('user:left', { userId: socket.id });
    console.log(`[roomSocket] Notified room ${roomId} that ${socket.id} left`);
  };

  socket.on('room:join', joinRoom);
  socket.on('room:leave', leaveRoom);
};

module.exports = roomSocket;