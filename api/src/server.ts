import http from 'node:http';
import createDebug from 'debug';

import app from './app.js';

const debug = createDebug('api:server');

/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(process.env.PORT ?? '3000');
app.set('port', port);

/**
 * Create HTTP server and listen on the provided port, on all network interfaces.
 */
const server = http.createServer(app);

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number or a named-pipe string.
 */
function normalizePort(val: string): number | string {
  const parsed = Number.parseInt(val, 10);

  if (Number.isNaN(parsed)) {
    // named pipe
    return val;
  }

  if (parsed >= 0) {
    // port number
    return parsed;
  }

  throw new Error(`Invalid port value: ${val}`);
}

/**
 * Event listener for HTTP server "error" event.
 */
function onError(error: NodeJS.ErrnoException): void {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
    case 'EADDRINUSE':
      console.error(`${bind} is already in use`);
      process.exit(1);
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */
function onListening(): void {
  const addr = server.address();
  const bind = addr === null ? '?' : typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
  debug(`Listening on ${bind}`);
}
