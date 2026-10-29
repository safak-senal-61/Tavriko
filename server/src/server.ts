import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { db } from './db/dbAdapter';
import { GameRoomManager } from './engine/GameRoomManager';
import { Matchmaker } from './engine/Matchmaker';
import { setupSocketHandlers } from './socket/socketHandler';
import authRoutes from './routes/authRoutes';
import triviaRoutes from './routes/triviaRoutes';
import socialRoutes from './routes/socialRoutes';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Wire up authoritative room manager with DB question provider
  const roomManager = new GameRoomManager((category, difficulty, count) => {
    return db.getQuestions(category, difficulty, count);
  });

  const matchmaker = new Matchmaker(roomManager);

  setupSocketHandlers(io, roomManager, matchmaker);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // REST API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api', triviaRoutes);
  app.use('/api/social', socialRoutes);

  const close = () => {
    matchmaker.destroy();
    roomManager.cleanupAll();
  };

  return { app, httpServer, io, roomManager, matchmaker, close };
}

if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  const { httpServer } = createApp();
  httpServer.listen(PORT, () => {
    console.log(`[Trivia Server] Online on port ${PORT}`);
  });
}
