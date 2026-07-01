// @ts-expect-error boardgame.io CJS server import does not have direct declaration files
import { Server, Origins } from 'boardgame.io/dist/cjs/server.js';
import { PollyannaGame } from './utils/boardgameGame';

const allowedOrigins = [Origins.LOCALHOST];
if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(','));
} else {
  // Fallback default for production domain
  allowedOrigins.push('https://pollyanna.zportal.dev');
}

const server = Server({
  games: [PollyannaGame],
  origins: allowedOrigins,
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8000;
server.run(port, () => {
  console.log(`🎮 boardgame.io server running on port ${port}...`);
});

