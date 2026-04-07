<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Asterisk WebRTC Phone</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jssip/3.0.1/jssip.min.js"></script>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f9;
    }
    .container {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0px 4px 10px rgba(0,0,0,0.1);
    }
    .status { padding: 10px; border-radius: 5px; margin: 10px 0; font-weight: bold; text-align: center;}
    .connected { background: #d4edda; color: #155724; }
    .disconnected { background: #f8d7da; color: #721c24; }
    input, button {
      padding: 10px; margin: 5px 0; width: 100%; box-sizing: border-box; border-radius: 4px; border: 1px solid #ccc;
    }
    button { background-color: #007bff; color: white; border: none; cursor: pointer; font-weight: bold; }
    button:disabled { background-color: #cccccc; cursor: not-allowed; }
    button#hangupBtn { background-color: #dc3545; }
    button#answerBtn { background-color: #28a745; }
    #micBar, #speakerBar {
      height: 10px; background: #ddd; border-radius: 5px; overflow: hidden; margin-bottom: 10px;
    }
    .level { height: 100%; background: #28a745; width: 0%; transition: width 0.1s; }
  </style>
</head>
<body>
<div class="container">
  <h1>Asterisk WebRTC Phone</h1>

  <div id="status" class="status disconnected">Disconnected</div>

  <label>SIP Server (DuckDNS)</label>
  <input type="text" id="sipServer" value="avoip.duckdns.org">

  <label>Your Extension (e.g., 101 or 1004)</label>
  <input type="text" id="sipUser" value="101">

  <label>SIP Secret (From FreePBX)</label>
  <input type="password" id="sipPassword" placeholder="Paste FreePBX Secret Here">

  <button onclick="connect()">1. Connect to PBX</button>
  <button onclick="disconnect()" id="disconnectBtn" disabled>Disconnect</button>

  <hr style="margin: 20px 0;">

  <div id="callControls" style="display:none;">
    <h3>Call Status: <span id="callStatus">Ready</span></h3>
    
    <label>Target Extension to Call:</label>
    <input type="text" id="targetExt" placeholder="e.g. 1002 or *43">
    
    <button onclick="call()" id="callBtn">2. Make Call</button>
    <button onclick="answerCall()" id="answerBtn" disabled>Answer Incoming</button>
    <button onclick="hangup()" id="hangupBtn" disabled>Hang Up</button>

    <p style="margin-bottom: 2px; font-size: 12px;">Mic Level:</p>
    <div id="micBar"><div class="level" id="micLevel"></div></div>
    
    <p style="margin-bottom: 2px; font-size: 12px;">Speaker Level:</p>
    <div id="speakerBar"><div class="level" id="speakerLevel"></div></div>

<audio id="remoteAudio" autoplay playsinline></audio>
  </div>

  <div id="log" style="margin-top:20px; height:150px; overflow-y:scroll; border:1px solid #ccc; padding:10px; font-size: 0.85em; background: #f8f9fa;"></div>
</div>

<script>
let ua = null, session = null, localStream = null;

const pcConfig = {
  iceServers: [ ],
  iceTransportPolicy: 'all',
  bundlePolicy: 'balanced',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 2
};

function log(msg) {
  const el = document.getElementById('log');
  el.innerHTML += `<div><strong>${new Date().toLocaleTimeString()}</strong>: ${msg}</div>`;
  el.scrollTop = el.scrollHeight;
  console.log(msg);
}

function updateStatus(text, cls) {
  const el = document.getElementById('status');
  el.textContent = text;
  el.className = `status ${cls}`;
}

// YOUR original working audio binder!
function attachPeerConnectionEvents(pc) {
  pc.addEventListener("iceconnectionstatechange", () => {
    log("❄️ ICE Connection: " + pc.iceConnectionState);
    
    // THE AUTO-HANGUP DETECTOR:
    if (pc.iceConnectionState === "disconnected" || 
        pc.iceConnectionState === "failed" || 
        pc.iceConnectionState === "closed") {
        
        log("⚠️ Phone hung up! Auto-closing...");
        
        // I ADDED THIS: It forces JsSIP to cleanly kill the Ghost Session so your next call doesn't break!
        if (session) {
            try { session.terminate(); } catch(e) {} 
        }
        
        resetCallUI(); 
    }
  });

  pc.addEventListener("track", (ev) => {
    if (ev.streams[0]) {
      document.getElementById("remoteAudio").srcObject = ev.streams[0];
      log("🔊 Remote audio stream attached!");
      visualizeAudio(ev.streams[0], "speakerLevel");
    }
  });
}

function connect() {
  const server = document.getElementById('sipServer').value;
  const user = document.getElementById('sipUser').value;
  const password = document.getElementById('sipPassword').value;

  if(!password) {
      alert("You must enter your FreePBX SIP Secret!");
      return;
  }

  log("⏳ Connecting to " + server + "...");

  const socket = new JsSIP.WebSocketInterface(`wss://${server}:8089/ws`);
  ua = new JsSIP.UA({
    sockets: [socket],
    uri: `sip:${user}@${server}`,
    password: password,
    display_name: user,
    register: true,
    session_timers: true 
  });

  ua.on('connected', () => log("🔗 WebSocket Connected"));
  ua.on('disconnected', () => log("🔌 WebSocket Disconnected"));

  ua.on('registered', () => {
    log("✅ Successfully Registered with Asterisk!");
    updateStatus("Connected & Registered", "connected");
    document.getElementById("callControls").style.display = "block";
    document.getElementById("disconnectBtn").disabled = false;
  });

  ua.on('registrationFailed', (e) => {
    log("❌ Registration Failed: " + e.cause);
    updateStatus("Registration Failed", "disconnected");
  });

  ua.on('newRTCSession', (data) => {
    if (session && session !== data.session) {
        data.session.terminate();
        return;
    }

    session = data.session;
    log(data.originator === 'remote' ? "📞 Incoming Call Ringing..." : "📤 Dialing out...");

    if (data.originator === 'remote') {
      document.getElementById("answerBtn").disabled = false;
      document.getElementById("hangupBtn").disabled = false;
      document.getElementById("callBtn").disabled = true; // Lock Call Button
    }

    session.on('confirmed', () => {
      log("🗣️ Call connected and active!");
      document.getElementById("callStatus").textContent = "In Call";
      document.getElementById("answerBtn").disabled = true;
    });

    session.on('ended', resetCallUI);
    session.on('failed', resetCallUI);
  });

  ua.start();
}

function call() {
  if (!ua || ua.isRegistered() === false) {
    alert("You must connect and register first!");
    return;
  }

  if (session) {
    log("⚠️ Already in a call.");
    return;
  }

  const targetExt = document.getElementById('targetExt').value;
  if(!targetExt) {
      alert("Please enter an extension to call (like *43)");
      return;
  }

  // Lock UI
  document.getElementById("callBtn").disabled = true;
  document.getElementById("targetExt").disabled = true;

  const server = document.getElementById('sipServer').value;
  const targetUri = `sip:${targetExt}@${server}`;

  session = ua.call(targetUri, {
    mediaConstraints: { audio: true, video: false },
    pcConfig: pcConfig,
    rtcOfferConstraints: { offerToReceiveAudio: 1, offerToReceiveVideo: 0 }
  });

  session.connection && attachPeerConnectionEvents(session.connection);
  document.getElementById("hangupBtn").disabled = false;

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    localStream = stream; // Save mic
    visualizeAudio(stream, "micLevel");
  }).catch(err => log("🎤 Mic error: " + err.message));
}

function answerCall() {
  if (!session) return;
  session.answer({
    mediaConstraints: { audio: true, video: false },
    pcConfig: pcConfig
  });
  log("✅ Answered call");
  document.getElementById("answerBtn").disabled = true;

  setTimeout(() => {
    if (session.connection) attachPeerConnectionEvents(session.connection);
  }, 500);

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    localStream = stream; // Save mic
    visualizeAudio(stream, "micLevel");
  }).catch(err => log("🎤 Mic error: " + err.message));
}

function hangup() {
  if (session) session.terminate();
}

function disconnect() {
  if (ua) {
    ua.stop();
    ua = null;
    updateStatus("Disconnected", "disconnected");
    document.getElementById("callControls").style.display = "none";
  }
}

function resetCallUI() {
  document.getElementById("callStatus").textContent = "Ready";
  document.getElementById("answerBtn").disabled = true;
  document.getElementById("hangupBtn").disabled = true;
  
  // Unlock UI for the next call
  document.getElementById("callBtn").disabled = false;
  document.getElementById("targetExt").disabled = false;

  // Kill Speakers
  const remoteAudio = document.getElementById("remoteAudio");
  if (remoteAudio.srcObject) {
    remoteAudio.srcObject.getTracks().forEach(t => t.stop());
    remoteAudio.srcObject = null;
  }

  // Kill Microphone
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }

  document.getElementById("micLevel").style.width = "0%";
  document.getElementById("speakerLevel").style.width = "0%";

  // I ADDED THIS: Failsafe to guarantee no ghost sessions survive
  if (session) {
      try { session.terminate(); } catch(e) {}
  }

  session = null;
  log("📴 Call ended. Memory cleared.");
}

function visualizeAudio(stream, barId) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioCtx.createAnalyser();
  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);
  analyser.fftSize = 256;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function draw() {
    if(!stream.active) return;
    requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);
    const volume = Math.max(...dataArray);
    document.getElementById(barId).style.width = `${volume / 2.5}%`;
  }
  draw();
}
</script>
</body>
</html>
