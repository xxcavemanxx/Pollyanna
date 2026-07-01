// @ts-expect-error boardgame.io CJS server import does not have direct declaration files
import { Server, Origins } from 'boardgame.io/dist/cjs/server.js';
import { PollyannaGame } from './utils/boardgameGame';

const server = Server({
  games: [PollyannaGame],
  origins: [Origins.LOCALHOST],
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8000;
server.run(port, () => {
  console.log(`🎮 boardgame.io server running on port ${port}...`);
});
