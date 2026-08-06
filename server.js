const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store last 50 signals
let signals = [];

// Receive signal from MetaTrader indicator
app.post('/signal', (req, res) => {
  const signal = req.body;

  console.log('New signal received:', signal);

  // Add timestamp if missing
  if (!signal.time) {
    signal.time = new Date().toISOString();
  }

  // Add to history (newest first)
  signals.unshift(signal);
  if (signals.length > 50) signals.pop();

  // Send live to all connected phones
  io.emit('new_signal', signal);

  res.json({ success: true });
});

// Optional: get history
app.get('/history', (req, res) => {
  res.json(signals);
});

io.on('connection', (socket) => {
  console.log('Phone connected');
  // Send current history when phone connects
  socket.emit('history', signals);
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Open on your phone: http://YOUR_COMPUTER_IP:3000`);
});