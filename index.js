require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const axios = require('axios');

const User = require('./models/User');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const onlineUsers = {};

// Telegram Bot Credentials
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// NTFY Secret Topic for Urgent Loud Phone Alarms
// You can set NTFY_TOPIC in your .env or Render dashboard (default: qcapp-satvik-alarm-99)
const NTFY_TOPIC = process.env.NTFY_TOPIC || 'qcapp-satvik-alarm-99';

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((error) => console.error('❌ MongoDB connection error:', error));

// Serve static files
app.use('/style.css', express.static(path.join(__dirname, 'style.css')));
app.use('/SF_Home_Page.css', express.static(path.join(__dirname, 'SF_Home_Page.css')));
app.use('/client.js', express.static(path.join(__dirname, 'client.js')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'SF_Home_Page.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.use(express.static(path.join(__dirname)));

// Helper function to trigger max-priority emergency phone alarm
function triggerUrgentAlarm(messageText) {
  // 1. Send Telegram Message
  if (BOT_TOKEN && CHAT_ID) {
    axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: messageText
    })
    .then(() => console.log('✅ Telegram message sent'))
    .catch(err => console.error('❌ Telegram error:', err.message));
  }

  // 2. Trigger Loud Emergency Phone Ring & Alarm via ntfy
  axios.post(`https://ntfy.sh/${NTFY_TOPIC}`, messageText, {
    headers: {
      'Title': 'QCApp: Wake Up!',
      'Priority': 'urgent',
      'Tags': 'rotating_light,loudspeaker',
      'Click': 'https://quick-chat-fumk.onrender.com/'
    }
  })
  .then(() => console.log('✅ Urgent ntfy phone alarm sent'))
  .catch(err => console.error('❌ ntfy alarm error:', err.message));
}

// === Socket.IO Logic ===
io.on('connection', (socket) => {
  console.log('🔌 A user connected');

  socket.on('set name', async (data) => {
    try {
      const user = await User.findOne({ username: data.name });

      if (!user || user.password !== data.password) {
        socket.emit('auth error', 'Invalid username or password.');
        return;
      }

      user.online = true;
      await user.save();

      socket.username = user.username;
      onlineUsers[user.username] = socket.id;

      socket.emit('name set', { name: user.username });

      // ✅ Trigger urgent wake-up alarm when Pig logs in
      if (user.username === 'Pig') {
        triggerUrgentAlarm('🐷 Wake up! Pig is online ready!');
      }

      const allMessages = await Message.find().sort({ createdAt: -1 }).lean();
      const deletedIds = (user.deletedMessages || []).map(id => id.toString());
      const filteredMessages = allMessages.filter(msg => !deletedIds.includes(msg._id.toString()));
      socket.emit('chat history', filteredMessages.reverse());

      const otherUser = await User.findOne({ username: { $ne: user.username } });
      if (otherUser) {
        socket.emit('otherUserStatus', {
          username: otherUser.username,
          online: otherUser.online,
          lastSeen: otherUser.lastSeen
        });
      }

      io.emit('userStatus', { user: user.username, status: 'online' });

    } catch (error) {
      console.error('❌ Auth error:', error);
      socket.emit('auth error', 'Server error.');
    }
  });

  // Manual Wake-Up Trigger (Bell Icon in Header)
  socket.on('send sms notify', ({ from }) => {
    if (from === 'Pig') {
      triggerUrgentAlarm('🚨 Urgent: Pig is waiting in chat!');
    }
  });

  socket.on('chat message', async (data) => {
    console.log('📩 Message received from:', data.sender, '-', data.msg);
    try {
      const msg = new Message({
        sender: data.sender,
        message: data.msg,
        time: data.time,
        reply: data.reply
      });
      await msg.save();
      data._id = msg._id;
      io.emit('chat message', data);
    } catch (err) {
      console.error('❌ Error saving message:', err);
    }
  });

  socket.on('message seen', (data) => {
    data.status = 'seen';
    io.emit('update status', data);
  });

  socket.on('typing', (user) => socket.broadcast.emit('typing', user));
  socket.on('stopTyping', (user) => socket.broadcast.emit('stopTyping', user));

  socket.on('delete for me', async ({ username, messageId }) => {
    try {
      await User.updateOne(
        { username },
        { $addToSet: { deletedMessages: messageId } }
      );
      socket.emit('message removed', messageId);
    } catch (err) {
      console.error('❌ Failed to delete message for user:', err);
    }
  });

  socket.on('delete for everyone', async (messageId) => {
    try {
      await Message.deleteOne({ _id: messageId });
      io.emit('message removed', messageId);
    } catch (err) {
      console.error('❌ Error deleting message from DB:', err);
    }
  });

  socket.on('clear history for me', async (username) => {
    try {
      const allMessageIds = await Message.find({}, '_id').lean();
      const ids = allMessageIds.map(msg => msg._id);
      await User.updateOne(
        { username },
        { $addToSet: { deletedMessages: { $each: ids } } }
      );
      socket.emit('all messages removed');
    } catch (err) {
      console.error('❌ Error clearing history for user:', err);
    }
  });

  socket.on('clear history for everyone', async () => {
    try {
      await Message.deleteMany({});
      io.emit('all messages removed');
    } catch (err) {
      console.error('❌ Error clearing history for all:', err);
    }
  });

  socket.on('disconnect', async () => {
    if (socket.username) {
      try {
        const user = await User.findOne({ username: socket.username });
        if (user) {
          user.online = false;
          user.lastSeen = new Date();
          await user.save();

          io.emit('userStatus', {
            user: user.username,
            status: 'offline',
            lastSeen: user.lastSeen
          });
        }
        delete onlineUsers[socket.username];
      } catch (err) {
        console.error('❌ Error updating user status on disconnect:', err);
      }
    }
    console.log('🔌 A user disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});