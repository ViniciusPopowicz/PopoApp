const net = require('net');
const cp = require('child_process');

let currentPipe = null;
let heartbeatSocket = null;

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

function maintainHeartbeat() {
  if (heartbeatSocket && !heartbeatSocket.destroyed) return;
  const pipe = ensureLocalDb();
  if (!pipe) return;
  heartbeatSocket = net.connect(pipe, () => {
    // Keep alive connection
  });
  heartbeatSocket.on('error', () => {
    heartbeatSocket = null;
  });
  heartbeatSocket.on('close', () => {
    heartbeatSocket = null;
  });
}

function startProxy(port = 1433) {
  ensureLocalDb();
  maintainHeartbeat();
  setInterval(maintainHeartbeat, 5000);

  const server = net.createServer((tcpSocket) => {
    const pipe = ensureLocalDb();
    if (!pipe) {
      tcpSocket.destroy(new Error('LocalDB pipe not found'));
      return;
    }
    const pipeSocket = net.connect(pipe, () => {
      tcpSocket.pipe(pipeSocket);
      pipeSocket.pipe(tcpSocket);
    });

    tcpSocket.on('error', (err) => {
      pipeSocket.destroy();
    });
    pipeSocket.on('error', (err) => {
      tcpSocket.destroy();
    });
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
