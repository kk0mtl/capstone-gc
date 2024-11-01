const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const PORT = process.env.PORT || 3001;
const path = require('path');
const { send } = require('process');
const { sensitiveHeaders } = require('http2');
const { type } = require('os');
const mongoose = require("mongoose");
const { timeStamp } = require('console');

let socketList = {};

// DB
const DB_URL = "mongodb+srv://Capstone:caps0123@capstonedb.oqpu0.mongodb.net/?retryWrites=true&w=majority&appName=CapstoneDb";

mongoose
  .connect(DB_URL)
  .then((err) => console.log("Connected to database!"))
  .catch((err) => console.log("Connection failed...", err));

const DataSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  userName: { type: String, required: true },
  sttMsg: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const Data = mongoose.model("Data", DataSchema);

// Express
app.use(express.static(path.join(__dirname, 'public')));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Route
app.get('/ping', (req, res) => {
  res
    .send({
      success: true,
    })
    .status(200);
});

// Socket
io.on('connection', (socket) => {
  console.log(`New User connected: ${socket.id}`);

  socket.on('disconnect', () => {
    socket.disconnect();
    console.log('User disconnected!');
  });

  socket.on('BE-check-user', ({ roomId, userName }) => {
    let error = false;

    io.sockets.in(roomId).clients((err, clients) => {
      clients.forEach((client) => {
        if (socketList[client] == userName) {
          error = true;
        }
      });
      socket.emit('FE-error-user-exist', { error });
    });
  });

  /**
   * Join Room
   */
  socket.on('BE-join-room', ({ roomId, userName }) => {
    // Socket Join RoomName
    socket.join(roomId);
    socketList[socket.id] = { userName, video: true, audio: true };

    // Set User List
    io.sockets.in(roomId).clients((err, clients) => {
      try {
        const users = [];
        clients.forEach((client) => {
          // Add User List
          users.push({ userId: client, info: socketList[client] });
        });

        // 서버 콘솔에 접속한 모든 사용자 출력
        console.log(`Users in room ${roomId}:`);
        users.forEach((user) => {
          console.log(`User ID: ${user.userId}, Username: ${user.info.userName}`);
        });

        socket.broadcast.to(roomId).emit('FE-user-join', users);
        // io.sockets.in(roomId).emit('FE-user-join', users);
      } catch (e) {
        io.sockets.in(roomId).emit('FE-error-user-exist', { err: true });
      }
    });
  });

  socket.on('BE-call-user', ({ userToCall, from, signal }) => {
    io.to(userToCall).emit('FE-receive-call', {
      signal,
      from,
      info: socketList[socket.id],
    });
  });

  socket.on('BE-accept-call', ({ signal, to }) => {
    io.to(to).emit('FE-call-accepted', {
      signal,
      answerId: socket.id,
    });
  });

  socket.on('BE-send-message', ({ roomId, msg, sender }) => {
    io.sockets.in(roomId).emit('FE-receive-message', { msg, sender });
  });

  socket.on('BE-leave-room', ({ roomId, leaver }) => {
    delete socketList[socket.id];
    socket.broadcast
      .to(roomId)
      .emit('FE-user-leave', { userId: socket.id, userName: [socket.id] });
    io.sockets.sockets[socket.id].leave(roomId);
  });

  socket.on('BE-toggle-camera-audio', ({ roomId, switchTarget }) => {
    if (switchTarget === 'video') {
      socketList[socket.id].video = !socketList[socket.id].video;
    } else {
      socketList[socket.id].audio = !socketList[socket.id].audio;
    }
    socket.broadcast
      .to(roomId)
      .emit('FE-toggle-camera', { userId: socket.id, switchTarget });
  });

  let prevBuf = '';
  socket.on('BE-stt-data-out', async ({ roomId, smsg = '', ssender, prev = '', timestamp }) => {
    prevBuf = prev;
    let cleanMsg = smsg.replace(prevBuf, '');
    console.log(`${roomId}번 방, ${ssender} : ${cleanMsg}`);

    // save form
    const newNode = new Data({
      roomId,
      userName: ssender,
      sttMsg: cleanMsg,
      timestamp: timestamp,
    })

    try {
      io.sockets.in(roomId).emit('FE-stt-dialog', { smsg: cleanMsg, ssender, timestamp });
      io.sockets.in(roomId).emit('FE-stt-sender', { smsg: cleanMsg, ssender });
      await newNode.save();
      console.log("데이터 저장 성공");
    } catch (err) {
      console.log("데이터 저장 실패", err);
    }
  });
});

http.listen(PORT, () => {
  console.log(`Connected : ${PORT}`);
});
