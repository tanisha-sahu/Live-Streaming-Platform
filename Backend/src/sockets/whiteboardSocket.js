// tldraw is efficient and handles its own state.
// We'll implement a lightweight coordination mechanism so late joiners can request a
// full document from existing clients. Server will simply forward requests and
// full documents between clients and broadcast incremental updates.

const whiteboardSocket = (io, socket) => {
  // When a client sends incremental updates, broadcast them to other clients
  socket.on('tldraw:update', ({ roomId, update }) => {
    if (roomId) {
      socket.to(roomId).emit('tldraw:update', update);
      console.log(`[whiteboardSocket] Forwarded tldraw:update from ${socket.id} to room ${roomId}`);
    }
  });

  // When a client joins the whiteboard, ask other clients in the room to send the full document
  socket.on('whiteboard:join', ({ roomId }) => {
    if (!roomId) return;
    // Ask other clients to provide the current document for this room
    socket.to(roomId).emit('whiteboard:request_full', { requesterId: socket.id });
    console.log(`[whiteboardSocket] ${socket.id} requested whiteboard full doc for room ${roomId}`);
  });

  // When a client responds with the full document, forward it to the requester
  socket.on('whiteboard:full', ({ roomId, requesterId, document }) => {
    if (!roomId || !requesterId || !document) return;
    // Forward the full document to the original requester only
    try {
      io.to(requesterId).emit('whiteboard:history', document);
      console.log(`[whiteboardSocket] Forwarded whiteboard:history to ${requesterId} for room ${roomId}`);
    } catch (e) {
      // ignore
    }
  });
};

module.exports = whiteboardSocket;