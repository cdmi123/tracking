const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { authRouter, SECRET_KEY } = require('./auth');

const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*'
  }
});

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname,'client')));
app.get('/',(req,res) => {
  res.sendFile(__dirname , 'client', 'index.html');
})

app.use('/auth', authRouter);

let locations = {};
let sockets = {};

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication error"));

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error("Authentication error"));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user.userId;
  sockets[userId] = socket;
  console.log(`User connected: ${userId}`);

  socket.on('locationUpdate', (data) => {
    const { latitude, longitude } = data;
    locations[userId] = { latitude, longitude };

    // Broadcast to all clients
    io.emit('locationUpdate', {
      userId,
      latitude,
      longitude
    });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${userId}`);
    delete locations[userId];
    delete sockets[userId];
  });
});

app.get('/locations', (req, res) => {
  res.json(locations);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
