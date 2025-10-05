import { addMessage } from '../slices/chatSlice';
import { updateParticipants } from '../slices/roomSlice';
import { socket } from '../../services/socket';

const socketMiddleware = (store) => {
  let initialized = false;

  return (next) => (action) => {
    // Initialize listeners once when store middleware first runs
    if (!initialized) {
      initialized = true;
      // Ensure socket is connected
      try {
        socket.connect();
      } catch (e) {
        // ignore
      }

      socket.on('chat:message', (message) => {
        store.dispatch(addMessage(message));
      });

      socket.on('room:participants', (participants) => {
        store.dispatch(updateParticipants(participants));
      });
    }

    return next(action);
  };
};

export default socketMiddleware;