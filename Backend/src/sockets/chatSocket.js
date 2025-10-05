const { persistMessage } = require('../services/chat.service');
const logger = require('../config/logger');

const chatSocket = (io, socket) => {
  const sendMessage = async ({ roomId, message, user }) => {
    console.log(`[chatSocket] Received chat:send_message from ${socket.id} for room ${roomId}`);
    const messageData = {
      user: { id: user.id, username: user.username },
      text: message,
      timestamp: new Date().toISOString(),
    };
    
    // Broadcast to everyone EXCEPT the sender
    socket.to(roomId).emit('chat:message', messageData); // <-- forward to others
    console.log(`[chatSocket] Emitted chat:message to room ${roomId} (except ${socket.id})`);

    try {
      await persistMessage({
        text: message,
        userId: user.id,
        username: user.username,
        roomId,
      });
    } catch (error) {
      logger.error('Failed to save chat message:', error);
    }
  };

  socket.on('chat:send_message', sendMessage);
};

module.exports = chatSocket;