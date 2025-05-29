require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');


const User = require('./models/User');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const onlineUsers = {};

// ✅ Twilio setup
const twilio = require('twilio');
const TWILIO_SID = process.env.TWILIO_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH;
const twilioClient = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
const FROM_NUMBER = process.env.FROM_NUMBER;
const TO_NUMBER = process.env.TO_NUMBER;

//Telegram setup
const axios = require('axios');
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// ✅ MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((error) => console.error('❌ MongoDB connection error:', error));// Serve static files
  
app.use('/style.css', express.static(path.join(__dirname, 'style.css')));
app.use('/SF_Home_Page.css', express.static(path.join(__dirname, 'SF_Home_Page.css')));
app.use('/client.js', express.static(path.join(__dirname, 'client.js')));
app.use('/VoiceCall.css', express.static(path.join(__dirname, 'VoiceCall.css')));
app.use('/VoiceCall.js', express.static(path.join(__dirname, 'VoiceCall.js')));

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'SF_Home_Page.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.use(express.static(path.join(__dirname)));
app.get('/VoiceCall.html', (req, res) => res.sendFile(path.join(__dirname, 'VoiceCall.html')));

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

      // ✅ Send SMS if Pig logs in
/*      if (user.username === 'Pig') {
        twilioClient.messages
          .create({
            body: 'Online Ready!',
            from: FROM_NUMBER,
            to: TO_NUMBER
          })
          .then(message => console.log(`✅ SMS sent: ${message.sid}`))
          .catch(err => console.error('❌ SMS error:', err));

                  // Make Voice Call
          twilioClient.calls
          .create({
            twiml: '<Response><Say voice="alice">Wake up! Pig is online!</Say></Response>',
            from: FROM_NUMBER,
            to: TO_NUMBER
          })
          .then(call => console.log(`✅ Call initiated: ${call.sid}`))
          .catch(err => console.error('❌ Call error:', err));
      }
*/

      // ✅ Send SMS if Pig logs in
      if (user.username === 'Pig') {
        // Send Telegram message
        axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: CHAT_ID,
          text: 'Online Ready!!'
        })
        .then(() => console.log('✅ Telegram message sent'))
        .catch(err => console.error('❌ Telegram error:', err));

                // Make Voice Call
        twilioClient.calls
        .create({
          twiml: '<Response><Say voice="alice">Wake up! Pig is online!</Say></Response>',
          from: FROM_NUMBER,
          to: TO_NUMBER
        })
        .then(call => console.log(`✅ Call initiated: ${call.sid}`))
        .catch(err => console.error('❌ Call error:', err));
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

/*
  socket.on('send sms notify', ({ from }) => {
  if (from === 'Pig') {
    twilioClient.messages
      .create({
        body: 'WakeUp!!!',
        from: FROM_NUMBER,
        to: TO_NUMBER
      })
      .then(message => console.log(`📩 SMS sent from Pig: ${message.sid}`))
      .catch(err => console.error('❌ SMS error:', err));
  }
});

*/

  socket.on('send sms notify', ({ from }) => {
    if (from === 'Pig') {
      axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: CHAT_ID,
          text: 'Notified!'
        })
        .then(() => console.log('✅ Telegram message sent'))
        .catch(err => console.error('❌ Telegram error:', err));
      }
    }
  );

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
