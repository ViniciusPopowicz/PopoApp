const net = require('net');
const cp = require('child_process');

let currentPipe = null;
let heartbeatSocket = null;

/**
 * Starts the LocalDB instance (if needed) and resolves its named pipe.
 * NOTE: this uses execSync and blocks the event loop (~1s), so it must NOT be
 * called on every incoming connection. Use getPipe() instead, which caches.
 */
function ensureLocalDb() {
  try {
    cp.execSync('sqllocaldb start MSSQLLocalDB', { stdio: 'pipe' });
  } catch (e) {
    // Already running or error
  }
  const info = cp.execSync('sqllocaldb info MSSQLLocalDB').toString();
  const match = info.match(/np:(\\\\[^\r\n]+)/);
  if (match) {
    currentPipe = match[1].trim();
  }
  return currentPipe;
}

/** Returns the cached pipe name, resolving it only when unknown. */
function getPipe() {
  return currentPipe || ensureLocalDb();
}

function maintainHeartbeat() {
  if (heartbeatSocket && !heartbeatSocket.destroyed) return;
  const pipe = getPipe();
  if (!pipe) return;
  heartbeatSocket = net.connect(pipe, () => {
    // Keep alive connection
  });
  heartbeatSocket.on('error', () => {
    heartbeatSocket = null;
    // Pipe may have changed (instance restarted); force re-resolution next time.
    currentPipe = null;
  });
  heartbeatSocket.on('close', () => {
    heartbeatSocket = null;
  });
}

function bridge(tcpSocket, retried = false) {
  const pipe = retried ? ensureLocalDb() : getPipe();
  if (!pipe) {
    tcpSocket.destroy(new Error('LocalDB pipe not found'));
    return;
  }

  let connected = false;
  const pipeSocket = net.connect(pipe, () => {
    connected = true;
    tcpSocket.pipe(pipeSocket);
    pipeSocket.pipe(tcpSocket);
    tcpSocket.resume();
  });

  pipeSocket.on('error', () => {
    if (!connected && !retried && !tcpSocket.destroyed) {
      // Stale pipe name (LocalDB restarted): refresh once and retry.
      currentPipe = null;
      bridge(tcpSocket, true);
      return;
    }
    tcpSocket.destroy();
  });
  tcpSocket.on('error', () => pipeSocket.destroy());
  tcpSocket.on('close', () => pipeSocket.destroy());
}

function startProxy(port = 1433) {
  ensureLocalDb();
  maintainHeartbeat();
  setInterval(maintainHeartbeat, 5000);

  const server = net.createServer((tcpSocket) => {
    // Buffer client data until the pipe is connected.
    tcpSocket.pause();
    bridge(tcpSocket);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} already in use; proxy or server is already active.`);
    } else {
      console.error('LocalDB proxy server error:', err);
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`LocalDB TCP proxy listening on 127.0.0.1:${port} -> ${currentPipe}`);
  });

  return server;
}

if (require.main === module) {
  startProxy(1433);
}

module.exports = { startProxy, ensureLocalDb };
