const socket = io();
let peerConnection;
let localStream;
let timerInterval;
let seconds = 0;
let minutes = 0;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// UI Elements
const timerEl = document.getElementById('call-timer');
const muteBtn = document.getElementById('mute-btn');
const endCallBtn = document.getElementById('end-call-btn');
const callerName = document.getElementById('caller-name');

let isMuted = false;

// Timer
function startTimer() {
  timerInterval = setInterval(() => {
    seconds++;
    if (seconds === 60) {
      seconds = 0;
      minutes++;
    }
    timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, 1000);
}

// Start Call
async function startCall(isCaller) {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate);
    }
  };

  peerConnection.ontrack = (event) => {
    const remoteAudio = new Audio();
    remoteAudio.srcObject = event.streams[0];
    remoteAudio.autoplay = true;
    remoteAudio.play();
  };

  if (isCaller) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('voice-offer', offer);
    callerName.textContent = 'Waiting for response...';
  }

  startTimer();
}

// Accept offer if received
socket.on('voice-offer', async (offer) => {
  await startCall(false);
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('voice-answer', answer);
  callerName.textContent = 'Call Connected';
});

// Receive answer if you are caller
socket.on('voice-answer', async (answer) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  callerName.textContent = 'Call Connected';
});

// ICE candidate
socket.on('ice-candidate', async (candidate) => {
  if (peerConnection) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('ICE Error:', err);
    }
  }
});

// Call Ended
socket.on('call-ended', () => {
  endCall(true);
});

// End Call Logic
function endCall(remoteEnded = false) {
  clearInterval(timerInterval);
  if (peerConnection) peerConnection.close();
  if (localStream) localStream.getTracks().forEach(track => track.stop());
  if (!remoteEnded) socket.emit('end-call');
  window.close();
}

// Mute Button
muteBtn.onclick = () => {
  if (localStream) {
    const micTrack = localStream.getAudioTracks()[0];
    micTrack.enabled = !micTrack.enabled;
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? '🔊' : '🔇';
  }
};

// End Button
endCallBtn.onclick = () => endCall();

// Start WebRTC logic as caller by default
startCall(true);
