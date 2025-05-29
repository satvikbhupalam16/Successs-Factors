const socket = io();
let userName = '';
let isInCall = false;
let selectedMessageId = null;
let selectedMessageSender = null;
let replyTo = null;
let pendingMessages = [];
let chatReady = false;
let localStream, peerConnection;
let typingTimeout;

function updateCallStatusUI(message) {
  const indicator = document.getElementById('typing-indicator');
  const statusText = document.getElementById('typing-user');
  indicator.style.display = 'flex';
  statusText.textContent = message;
}

console.log('🚀 client.js loaded');
// === Secret Code Flow ===
document.getElementById('submit-code').addEventListener('click', () => {
  const secretCode = document.getElementById('secret-code').value.trim();
  if (secretCode === "RSS") {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('name-container').style.display = 'block';
  } else {
    alert("Incorrect secret code. Try again.");
  }
});

// === Login Validation ===
document.getElementById('submit-login').addEventListener('click', () => {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  socket.emit('set name', { name: username, password });
});

// === Handle Login Success ===
socket.on('name set', (data) => {
  userName = data.name;
  chatReady = true;

  socket.emit('user-joined', userName);

  if (userName === 'Dog' && 'Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission().then((permission) => {
      console.log('Notification permission:', permission);
    });
  }

  document.getElementById('name-container').style.display = 'none';
  document.getElementById('chat').style.display = 'flex';

  pendingMessages.forEach(data => addMessageToDOM(data));
  pendingMessages = [];
});

socket.on('auth error', (msg) => {
  alert(msg);
});

// === Toggle Password Visibility ===
document.getElementById('toggle-password').addEventListener('click', () => {
  const passwordInput = document.getElementById('password');
  const icon = document.querySelector('#toggle-password i');

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  } else {
    passwordInput.type = 'password';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  }
});

// === Chat History
socket.on('chat history', (messages) => {
  if (!chatReady) {
    pendingMessages = messages;
  } else {
    messages.forEach(data => addMessageToDOM(data));
  }
});

// === Send Message
document.getElementById('send-btn').addEventListener('click', (e) => {
  e.preventDefault();
  const msgInput = document.getElementById('message');
  const msg = msgInput.value.trim();
  if (msg) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    socket.emit('chat message', {
      sender: userName,
      msg,
      time,
      reply: replyTo ? {
        sender: replyTo.sender,
        message: replyTo.message,
        _id: replyTo._id
      } : null
    });

    msgInput.value = '';
    msgInput.focus();
    replyTo = null;
    document.getElementById('reply-preview').style.display = 'none';
    socket.emit('stopTyping', userName);
  }
});

// === Typing Event
const msgInput = document.getElementById('message');
msgInput.addEventListener('input', () => {
  if (msgInput.value.trim()) {
    socket.emit('typing', userName);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit('stopTyping', userName);
    }, 3000);
  } else {
    socket.emit('stopTyping', userName);
    clearTimeout(typingTimeout);
  }
});

// === Typing Indicator
socket.on('typing', (user) => {
  if (user !== userName) {
    document.getElementById('typing-user').textContent = `${user === 'Pig' ? '🐷 Pig' : '🐶 Dog'}`;
    document.getElementById('typing-indicator').style.display = 'flex';
  }
});

socket.on('stopTyping', (user) => {
  if (user !== userName) {
    document.getElementById('typing-indicator').style.display = 'none';
  }
});

// === Online Status Indicator
socket.on('userStatus', ({ user, status, lastSeen }) => {
  if (user !== userName) {
    const icon = user === 'Dog' ? '🐶' : '🐷';
    const displayStatus = status === 'online'
      ? '🟢 Online'
      : `🔴 Last seen: ${new Date(lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    document.getElementById('status-display').innerHTML = `
      ${icon} ${user}<br>
      ${displayStatus}
    `;
  }

  if (userName === 'Dog' && user !== userName && status === 'online') {
    showBrowserNotification('QCApp', `${user} is online`);
  }
});

// === Notify Button
document.getElementById('notify-btn').addEventListener('click', () => {
  socket.emit('send sms notify', { from: userName });
});

// === Clear Chat
document.getElementById('clear-btn').addEventListener('click', () => {
  showClearChatMenu();
});

// === Back to Home
document.getElementById('back-btn').addEventListener('click', () => {
  if (confirm('Are you sure you want to logout?')) {
    window.location.href = 'https://quick-chat-fumk.onrender.com/';
  }
});

// === Call Button
document.getElementById('goto-call').addEventListener('click', () => {
  const popup = document.createElement('div');
  popup.className = 'call-popup';
  popup.innerHTML = `
    <div class="call-popup-box">
      <p>Start a call:</p>
      <button id="start-audio-call">📞 Audio Call</button>
      <button id="start-video-call">🎥 Video Call</button>
      <button id="cancel-call">❌ Cancel</button>
    </div>
  `;
  document.body.appendChild(popup);

document.getElementById('start-audio-call').addEventListener('click', () => {
  socket.emit('initiate-call', { from: userName, type: 'voice' });
  updateCallStatusUI(`Calling ${userName === 'Pig' ? 'Dog' : 'Pig'}...`);
  window.open('/VoiceCall.html', '_blank', 'width=400,height=600');
  popup.remove();
});

document.getElementById('start-video-call').addEventListener('click', () => {
  socket.emit('call-initiate', { from: userName, type: 'video' });
  showOutgoingCallUI('video');
  popup.remove();
});


  document.getElementById('cancel-call').addEventListener('click', () => {
    popup.remove();
  });
});

// === Cancel Reply
document.getElementById('cancel-reply').addEventListener('click', () => {
  replyTo = null;
  document.getElementById('reply-preview').style.display = 'none';
});

// AddMessageToDOM, Clear/Delete menus, Notification, ScrollToOriginal functions
// ... No change needed in those. Keep all your existing definitions for those.

function showClearChatMenu() {
  const oldMenu = document.getElementById('clear-menu');
  if (oldMenu) oldMenu.remove();

  const menu = document.createElement('div');
  menu.style.position = 'absolute';
  menu.style.zIndex = '1000';
  menu.id = 'clear-menu';
  menu.className = 'delete-popup';
  menu.style.top = '60px';
  menu.style.right = '10px';

  // ✅ Option 1: Delete for Me
  const deleteMe = document.createElement('div');
  deleteMe.textContent = 'Clear History for Me';
  deleteMe.onclick = () => {
    socket.emit('clear history for me', userName);
    menu.remove();
  };
  menu.appendChild(deleteMe);

  // ✅ Option 2: Delete for Everyone
  const deleteAll = document.createElement('div');
  deleteAll.textContent = 'Clear History for Everyone';
  deleteAll.onclick = () => {
    if (confirm('Clear entire chat for everyone?')) {
      socket.emit('clear history for everyone');
    }
    menu.remove();
  };
  
  menu.appendChild(deleteAll);

  // Cancel
  const cancel = document.createElement('div');
  cancel.textContent = 'Cancel';
  cancel.onclick = () => menu.remove();
  menu.appendChild(cancel);

  document.body.appendChild(menu);
}


function showDeleteMenu(x, y, canDeleteForEveryone) {
  const oldMenu = document.getElementById('delete-menu');
  if (oldMenu) oldMenu.remove();

  const menu = document.createElement('div');
  menu.id = 'delete-menu';
  menu.className = 'delete-popup';
  const popupWidth = 160; // match your popup CSS
  const popupHeight = 120;
  
  const maxX = window.innerWidth - popupWidth - 10;

  let top = y;
  const overflowY = y + popupHeight > window.innerHeight;

  if (overflowY) {
    top = y - popupHeight - 10; // position it above
    if (top < 0) top = 10; // don’t go above viewport
  }

  menu.style.left = `${Math.min(x, maxX)}px`;
  menu.style.top = `${top}px`;
  

  // ✅ 1. Reply Option
  const replyOption = document.createElement('div');
  replyOption.textContent = 'Reply';
  replyOption.onclick = () => {
    const originalMsg = document.querySelector(`[data-id="${selectedMessageId}"]`);
    let msgBody = originalMsg?.cloneNode(true);
    
    // Remove elements like the sender label, menu button, and timestamp
    if (msgBody) {
      msgBody.querySelector('strong')?.remove();
      msgBody.querySelector('.timestamp')?.remove();
      msgBody.querySelector('.message-menu-btn')?.remove();
    }
    
    const replyText = msgBody?.textContent.trim() || '[No message]';
    
    replyTo = {
      sender: selectedMessageSender,
      message: replyText,
      _id: selectedMessageId
    };
    
    document.getElementById('reply-text').textContent = replyText;
    document.getElementById('reply-preview').style.display = 'block';
    menu.remove();
    
  };
  menu.appendChild(replyOption);

  // ✅ 2. Delete for Me
  const deleteMe = document.createElement('div');
  deleteMe.textContent = 'Delete for Me';
  deleteMe.onclick = () => {
    socket.emit('delete for me', { username: userName, messageId: selectedMessageId });
    menu.remove();
  };
  menu.appendChild(deleteMe);

  // ✅ 3. Delete for Everyone (only if sender)
  if (selectedMessageSender === userName) {
    const deleteAll = document.createElement('div');
    deleteAll.textContent = 'Delete for Everyone';
    deleteAll.onclick = () => {
      if (confirm('Delete this message for everyone?')) {
        socket.emit('delete for everyone', selectedMessageId);
      }
      menu.remove();
    };    
    menu.appendChild(deleteAll);
  }

  // ❌ 4. Cancel
  const cancel = document.createElement('div');
  cancel.textContent = 'Cancel';
  cancel.onclick = () => menu.remove();
  menu.appendChild(cancel);

  document.body.appendChild(menu);
}


function showBrowserNotification(title, message) {
  console.log('🚨 Showing notification:', title, message); // ✅ Add this
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body: message,
      icon: '/favicon.ico' // Optional: add your logo
    });
  }
}

function formatMessageText(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

function showOutgoingCallUI(type) {
  document.getElementById('typing-indicator').style.display = 'flex';
  document.getElementById('call-ui').innerHTML = `
    <span>Calling ${userName === 'Pig' ? 'Dog' : 'Pig'}...</span>
    <span id="cancel-call-btn">❌</span>
  `;

  document.getElementById('cancel-call-btn').onclick = () => {
    document.getElementById('typing-indicator').style.display = 'none';
    socket.emit('call-decline', { from: userName });
  };
}


// === Add Message to DOM ===
function addMessageToDOM(data) {
  const isUser = userName && data.sender === userName;
  const senderName = data.sender || 'Unknown';
  const rawMessage = data.msg || data.message || '[No message]';
  const messageText = formatMessageText(rawMessage);
  const timeText = data.time || '';

  const message = document.createElement('div'); // ✅ Now we define it
  message.classList.add('message', isUser ? 'user' : 'friend');

  // ✅ Attach ID and contextmenu
  if (data._id) {
    message.setAttribute('data-id', data._id);
    message.setAttribute('id', `msg-${data._id}`);
    message.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      selectedMessageId = data._id;
      selectedMessageSender = data.sender;
      showDeleteMenu(e.pageX, e.pageY, data.sender === userName);
    });
  }

  // ✅ Reply Preview
  let replyHtml = '';
  if (data.reply && data._id) {
    replyHtml = `
      <div class="reply-bubble" data-source-id="${data.reply._id}" onclick="scrollToOriginal('${data.reply._id}')">
        <strong>${data.reply.sender}:</strong> ${data.reply.message}
      </div>
    `;
  }

  // ✅ Add message content
  message.innerHTML = `
    ${replyHtml}
    ${!isUser ? `<strong>${senderName}:</strong>` : '<strong>You:</strong>'}
    ${messageText}
    <div class="timestamp">${timeText}</div>
  `;
  
    const menuBtn = document.createElement('span');
    menuBtn.classList.add('message-menu-btn');
    menuBtn.textContent = '⋮';
    menuBtn.style.position = 'absolute';
    menuBtn.style.top = '4px';
    menuBtn.style.right = '8px';
    menuBtn.style.cursor = 'pointer';
    menuBtn.onclick = (e) => {
    e.stopPropagation();
    selectedMessageId = data._id;
    selectedMessageSender = data.sender;
    showDeleteMenu(e.pageX, e.pageY, data.sender === userName);
  };
  message.appendChild(menuBtn);
  message.style.position = 'relative'; // Required for absolute positioning inside it


  document.getElementById('messages').prepend(message);
  document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
}

// === Incoming Call Handling ===
socket.on('incoming-call', ({ from, type }) => {
  const indicator = document.getElementById('typing-indicator');
  indicator.style.display = 'flex';

  const oldCallUI = indicator.querySelector('.incoming-call-ui');
  if (oldCallUI) oldCallUI.remove();

  const ui = document.createElement('div');
  ui.className = 'incoming-call-ui';
  ui.innerHTML = `
    <button id="accept-call">Accept</button>
    <button id="decline-call">Reject</button>
  `;
  indicator.appendChild(ui);

  document.getElementById('accept-call').onclick = () => {
    socket.emit('call-accept', { from });
    isInCall = true;
    window.open(`/${type === 'video' ? 'VideoCall.html' : 'VoiceCall.html'}`, '_blank', 'width=600,height=600');
    ui.remove();
  };

  document.getElementById('decline-call').onclick = () => {
    socket.emit('call-decline', { from });
    indicator.style.display = 'none';
    ui.remove();
  };
});

// === Call Response Handling ===
socket.on('call-accepted', () => {
  updateCallStatusUI('Call Connected');
  isInCall = true;
});

socket.on('call-declined', () => {
  updateCallStatusUI('Call Declined');
  isInCall = false;  // ✅ reset call state
  setTimeout(() => {
    document.getElementById('typing-indicator').style.display = 'none';
  }, 3000);
});


socket.on('call-ended', () => {
  if (isInCall) {
    updateCallStatusUI('Call Ended');
    isInCall = false;
    setTimeout(() => {
      document.getElementById('typing-indicator').style.display = 'none';
    }, 3000);
  }
});

// === Cancel Reply ===
document.getElementById('cancel-reply').addEventListener('click', () => {
  replyTo = null;
  document.getElementById('reply-preview').style.display = 'none';
});

function showInCallUI(type) {
  let timer = 0;
  const interval = setInterval(() => {
    timer++;
    const minutes = Math.floor(timer / 60).toString().padStart(2, '0');
    const seconds = (timer % 60).toString().padStart(2, '0');
    document.getElementById('call-ui').querySelector('.call-timer').textContent = `${minutes}:${seconds}`;
  }, 1000);

  document.getElementById('call-ui').innerHTML = `
    <div>${type.toUpperCase()} Call with ${userName === 'Pig' ? 'Dog' : 'Pig'}</div>
    <div class="call-timer">00:00</div>
    <button id="mute-btn">🔇</button>
    ${type === 'video' ? '<button id="cam-toggle">📷</button>' : ''}
    <button id="end-call-btn">❌</button>
  `;

  document.getElementById('mute-btn').onclick = () => {
    const mic = localStream.getAudioTracks()[0];
    mic.enabled = !mic.enabled;
  };

  if (type === 'video') {
    document.getElementById('cam-toggle').onclick = () => {
      const cam = localStream.getVideoTracks()[0];
      cam.enabled = !cam.enabled;
    };
  }

  document.getElementById('end-call-btn').onclick = () => {
    clearInterval(interval);
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    document.getElementById('typing-indicator').style.display = 'none';
  };
}

// === Typing Indicator ===
socket.on('typing', (user) => {
  if (user !== userName) {
    document.getElementById('typing-user').textContent = `${user === 'Pig' ? '🐷 Pig' : '🐶 Dog'}`;
    document.getElementById('typing-indicator').style.display = 'flex';
  }
});

socket.on('stopTyping', (user) => {
  if (user !== userName) {
    document.getElementById('typing-indicator').style.display = 'none';
  }
});

const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function startWebRTCCall(type, isCaller) {
  localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: type === 'video'
  });

  peerConnection = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.onicecandidate = (e) => {
    if (e.candidate) socket.emit('ice-candidate', e.candidate);
  };

  peerConnection.ontrack = (e) => {
    if (type === 'video') {
      const video = document.createElement('video');
      video.srcObject = e.streams[0];
      video.autoplay = true;
      video.style.width = '100%';
      document.getElementById('call-ui').appendChild(video);
    } else {
      const audio = new Audio();
      audio.srcObject = e.streams[0];
      audio.play();
    }
  };

  if (isCaller) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit(`${type}-offer`, offer);
  }

  // ICE and answer logic already handled in socket events
}

socket.on('voice-offer', async (offer) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('voice-answer', answer);
});

socket.on('voice-answer', (answer) => {
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', (candidate) => {
  peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});


// === Online Status Indicator ===
socket.on('userStatus', ({ user, status, lastSeen }) => {
  if (user !== userName) {
    const icon = user === 'Dog' ? '🐶' : '🐷';
    const displayStatus = status === 'online'
      ? '🟢 Online'
      : `🔴 Last seen: ${new Date(lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    document.getElementById('status-display').innerHTML = `
      ${icon} ${user}<br>
      ${displayStatus}
    `;
  }
  if (userName === 'Dog' && user !== userName && status === 'online') {
    showBrowserNotification('QCApp', `${user} is online`);
  }
  
});

/* Commenting duplicate history
// === Message History ===
socket.on('chat history', (messages) => {
  if (!chatReady) {
    pendingMessages = messages; // hold onto them
  } else {
    messages.forEach(data => addMessageToDOM(data));
  }
}); */

// === Live Messages ===
socket.on('chat message', (data) => {
  console.log('🔥 chat message received:', data);
  addMessageToDOM(data);
  if (userName === 'Dog' && data.sender !== userName && document.hidden) {
    showBrowserNotification('QCApp', `${data.sender}: ${data.msg}`);
  }
  
});

// === Delete for Me ===
socket.on('message removed', (messageId) => {
  const msgEl = document.querySelector(`[data-id="${messageId}"]`);
  if (msgEl) msgEl.remove();
});

socket.on('all messages removed', () => {
  document.getElementById('messages').innerHTML = '';
});


// === Other User's Status Display ===
socket.on('otherUserStatus', ({ username, online, lastSeen }) => {
  const iconMap = { 'Dog': '🐶', 'Pig': '🐷' };
  const icon = iconMap[username] || '👤';

  const displayStatus = online
    ? `<span class="online-dot"></span> Online`
    : `<span class="offline-dot"></span> Last seen: ${new Date(lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  document.getElementById('status-display').innerHTML = `
    <div class="status-name">${icon} ${username}</div>
    <div class="status-info">${displayStatus}</div>
  `;
});

function scrollToOriginal(messageId) {
  const target = document.getElementById(`msg-${messageId}`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('flash');

    setTimeout(() => {
      target.classList.remove('flash');
    }, 1000);
  }
}
