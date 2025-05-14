const socket = io();
let userName = '';

let selectedMessageId = null;
let selectedMessageSender = null;
let replyTo = null;
let pendingMessages = [];
let chatReady = false;
let typingTimeout;

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
    window.open('/VoiceCall.html', '_blank', 'width=400,height=600');
    popup.remove();
  });

  document.getElementById('start-video-call').addEventListener('click', () => {
    alert('Video call functionality coming soon!');
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


// === Message History ===
socket.on('chat history', (messages) => {
  if (!chatReady) {
    pendingMessages = messages; // hold onto them
  } else {
    messages.forEach(data => addMessageToDOM(data));
  }
});

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
