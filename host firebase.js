<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Asterisk WebRTC Phone (Debug)</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jssip/3.0.1/jssip.min.js"></script>
  <style>
    body { font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 20px; background: #f4f4f9; }
    .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
    .status { padding: 10px; border-radius: 5px; margin: 10px 0; font-weight: bold; text-align: center; }
    .connected { background: #d4edda; color: #155724; }
    .disconnected { background: #f8d7da; color: #721c24; }
    input, button { padding: 10px; margin: 5px 0; width: 100%; box-sizing: border-box; border-radius: 4px; border: 1px solid #ccc; }
    button { background: #007bff; color: white; border: none; cursor: pointer; font-weight: bold; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    #hangupBtn { background: #dc3545; }
    #answerBtn { background: #28a745; }
    #micBar, #speakerBar { height: 10px; background: #ddd; border-radius: 5px; overflow: hidden; margin-bottom: 10px; }
    .level { height: 100%; background: #28a745; width: 0%; transition: width 0.1s; }
    #log { margin-top: 20px; height: 220px; overflow-y: scroll; border: 1px solid #ccc; padding: 10px; font-size: 0.8em; background: #f8f9fa; font-family: monospace; }
    #log .error { color: #dc3545; font-weight: bold; }
    #log .ok { color: #155724; }
    #log .warn { color: #856404; }
    #diagPanel { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 10px; margin: 10px 0; font-size: 12px; display: none; }
  </style>
</head>
<body>
<div class="container">
  <h1>WebRTC Phone <span style="font-size:13px;color:#888;">[DEBUG]</span></h1>
  <div id="status" class="status disconnected">Disconnected</div>

  <label>SIP Server</label>
  <input type="text" id="sipServer" value="avoip.duckdns.org">
  <label>Extension</label>
  <input type="text" id="sipUser" value="101">
  <label>SIP Secret</label>
  <input type="password" id="sipPassword" placeholder="FreePBX Secret">

  <button onclick="connect()">1. Connect</button>
  <button onclick="disconnect()" id="disconnectBtn" disabled>Disconnect</button>

  <hr style="margin:20px 0">

  <div id="callControls" style="display:none;">
    <h3>Status: <span id="callStatus">Ready</span></h3>
    <label>Target Extension:</label>
    <input type="text" id="targetExt" placeholder="e.g. 1002">
    <button onclick="call()" id="callBtn">2. Call</button>
    <button onclick="answerCall()" id="answerBtn" disabled>Answer</button>
    <button onclick="hangup()" id="hangupBtn" disabled>Hang Up</button>
    <button onclick="forcePlayAudio()" id="forcePlayBtn" style="background:#6f42c1;display:none;">🔊 FORCE PLAY AUDIO</button>

    <p style="margin-bottom:2px;font-size:12px;">Mic:</p>
    <div id="micBar"><div class="level" id="micLevel"></div></div>
    <p style="margin-bottom:2px;font-size:12px;">Speaker:</p>
    <div id="speakerBar"><div class="level" id="speakerLevel"></div></div>

    <div id="diagPanel">
      <strong>Audio Diagnostics:</strong>
      <div id="diagContent"></div>
    </div>

    <label style="font-size:12px;margin-top:8px;display:block;">Audio Output Device:</label>
    <select id="audioOutputSelect" style="margin-top:4px;" onchange="changeAudioOutput()">
      <option value="">Default</option>
    </select>

    <audio id="remoteAudio" autoplay playsinline controls style="width:100%;margin-top:10px;"></audio>
  </div>

  <div id="log"></div>
</div>

<script>
let ua = null, session = null, localStream = null;
let sharedAudioCtx = null;
let pendingRemoteStream = null;
let pcPoller = null;          // ← NEW: interval handle for PC polling
let pcAttached = false;       // ← NEW: guard so we only attach once

const pcConfig = {
  iceServers: [],
  iceTransportPolicy: 'all',
  bundlePolicy: 'balanced',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 2
};

function log(msg, type='') {
  const el = document.getElementById('log');
  const div = document.createElement('div');
  div.className = type;
  div.innerHTML = `<strong>${new Date().toLocaleTimeString()}</strong>: ${msg}`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  console.log(msg);
}

function updateStatus(text, cls) {
  const el = document.getElementById('status');
  el.textContent = text;
  el.className = 'status ' + cls;
}

function getAudioCtx() {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return sharedAudioCtx;
}

function runAudioDiagnostics(stream, audioEl) {
  const panel = document.getElementById('diagPanel');
  const content = document.getElementById('diagContent');
  panel.style.display = 'block';
  const tracks = stream ? stream.getAudioTracks() : [];
  const trackInfo = tracks.map(t =>
    `[${t.label}] enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState}`
  ).join('<br>') || 'NO AUDIO TRACKS';
  content.innerHTML = `
    <b>AudioContext state:</b> ${sharedAudioCtx ? sharedAudioCtx.state : 'not created'}<br>
    <b>stream.active:</b> ${stream ? stream.active : 'no stream'}<br>
    <b>audio tracks (${tracks.length}):</b><br>${trackInfo}<br>
    <b>remoteAudio.paused:</b> ${audioEl.paused}<br>
    <b>remoteAudio.muted:</b> ${audioEl.muted}<br>
    <b>remoteAudio.volume:</b> ${audioEl.volume}<br>
    <b>remoteAudio.readyState:</b> ${audioEl.readyState}<br>
    <b>remoteAudio.srcObject:</b> ${audioEl.srcObject ? 'SET (id:' + audioEl.srcObject.id.slice(0,8) + ')' : 'NULL'}<br>
  `;
  log('🔬 DIAG — AudioCtx: ' + (sharedAudioCtx ? sharedAudioCtx.state : 'none'), 'warn');
  log('🔬 DIAG — stream.active: ' + (stream ? stream.active : 'no stream'), 'warn');
  log('🔬 DIAG — audio tracks: ' + tracks.length, tracks.length > 0 ? 'ok' : 'error');
  tracks.forEach(t => log(`🔬 track: ${t.label || t.id.slice(0,8)} enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState}`, t.readyState === 'live' ? 'ok' : 'error'));
  log('🔬 DIAG — paused=' + audioEl.paused + ' muted=' + audioEl.muted + ' vol=' + audioEl.volume + ' readyState=' + audioEl.readyState, audioEl.paused ? 'error' : 'ok');
}

async function populateAudioOutputs() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const select = document.getElementById('audioOutputSelect');
    select.innerHTML = '<option value="">Default</option>';
    devices.filter(d => d.kind === 'audiooutput').forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || 'Output ' + d.deviceId.slice(0,6);
      select.appendChild(opt);
    });
    log('🔊 Found ' + devices.filter(d => d.kind === 'audiooutput').length + ' audio output devices');
  } catch(e) {
    log('Could not enumerate audio devices: ' + e.message, 'warn');
  }
}

function changeAudioOutput() {
  const select = document.getElementById('audioOutputSelect');
  const audioEl = document.getElementById('remoteAudio');
  if (audioEl.setSinkId) {
    audioEl.setSinkId(select.value)
      .then(() => log('🔊 Audio output switched to: ' + (select.options[select.selectedIndex].text)))
      .catch(e => log('setSinkId failed: ' + e.message, 'error'));
  } else {
    log('setSinkId not supported on this browser', 'warn');
  }
}

function forcePlayAudio() {
  const audioEl = document.getElementById('remoteAudio');
  log('🔴 FORCE PLAY pressed by user', 'warn');
  getAudioCtx().resume().then(() => log('AudioCtx resumed: ' + sharedAudioCtx.state, 'ok'));
  if (pendingRemoteStream) {
    log('📌 Attaching pendingRemoteStream to audio element...');
    audioEl.srcObject = pendingRemoteStream;
  }
  if (!audioEl.srcObject) {
    log('❌ No srcObject on audio element — nothing to play!', 'error');
    return;
  }
  audioEl.muted = false;
  audioEl.volume = 1.0;
  audioEl.play()
    .then(() => { log('✅ FORCE PLAY succeeded!', 'ok'); runAudioDiagnostics(audioEl.srcObject, audioEl); })
    .catch(e => { log('❌ FORCE PLAY also failed: ' + e.message, 'error'); runAudioDiagnostics(audioEl.srcObject, audioEl); });
}

function visualizeAudio(stream, barId) {
  const audioCtx = getAudioCtx();
  audioCtx.resume().then(() => {
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    function draw() {
      if (!stream.active) return;
      requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      const volume = Math.max(...dataArray);
      const bar = document.getElementById(barId);
      if (bar) bar.style.width = (volume / 2.5) + '%';
    }
    draw();
  });
}

function attachRemoteStream(stream) {
  const audioEl = document.getElementById('remoteAudio');
  pendingRemoteStream = stream;
  log('📡 attachRemoteStream called. Tracks: ' + stream.getAudioTracks().length);
  stream.getAudioTracks().forEach(t => {
    log(`  track: ${t.id.slice(0,8)} readyState=${t.readyState} enabled=${t.enabled} muted=${t.muted}`,
        t.readyState === 'live' ? 'ok' : 'error');
  });
  audioEl.srcObject = stream;
  audioEl.muted = false;
  audioEl.volume = 1.0;
  visualizeAudio(stream, 'speakerLevel');
  audioEl.play()
    .then(() => {
      log('✅ remoteAudio.play() resolved — speaker active', 'ok');
      document.getElementById('forcePlayBtn').style.display = 'none';
    })
    .catch(err => {
      log('⚠️ remoteAudio.play() blocked: ' + err.message + ' — showing FORCE PLAY button', 'error');
      document.getElementById('forcePlayBtn').style.display = 'block';
    });
}

// ─── THE KEY FIX: poll until session.connection exists, then hook track ───
function startPCPoller() {
  if (pcPoller) { clearInterval(pcPoller); pcPoller = null; }
  pcAttached = false;
  let attempts = 0;
  log('🔍 Starting PC poller for incoming call...', 'warn');

  pcPoller = setInterval(() => {
    attempts++;

    // Try session.connection (JsSIP 3.x public API)
    const pc = session && (session.connection || (session._connection));

    if (pc && !pcAttached) {
      pcAttached = true;
      clearInterval(pcPoller);
      pcPoller = null;
      log('✅ PC found via poller after ' + attempts + ' attempt(s) — attaching track listener', 'ok');
      attachPeerConnectionEvents(pc);

      // If tracks already exist on the PC receivers (arrived before we polled in)
      if (pc.getReceivers) {
        pc.getReceivers().forEach(receiver => {
          if (receiver.track && receiver.track.kind === 'audio') {
            log('🎯 Found pre-existing receiver track — attaching directly', 'ok');
            const stream = new MediaStream([receiver.track]);
            receiver.track.addEventListener('unmute', () => {
              log('🔊 Pre-existing track unmuted!', 'ok');
              attachRemoteStream(stream);
            });
            // attach immediately regardless
            attachRemoteStream(stream);
          }
        });
      }
    }

    if (attempts >= 50) { // 5s timeout
      clearInterval(pcPoller);
      pcPoller = null;
      log('❌ PC poller timed out — track event will never fire', 'error');
      document.getElementById('forcePlayBtn').style.display = 'block';
    }
  }, 100);
}

function stopPCPoller() {
  if (pcPoller) { clearInterval(pcPoller); pcPoller = null; }
}

function attachPeerConnectionEvents(pc) {
  // Guard against double-attachment
  if (pc._eventsAttached) return;
  pc._eventsAttached = true;

  pc.addEventListener('iceconnectionstatechange', () => {
    log('❄️ ICE: ' + pc.iceConnectionState);
    if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
      if (session) { try { session.terminate(); } catch(e) {} }
      resetCallUI();
    }
  });

  pc.addEventListener('icegatheringstatechange', () => {
    log('ICE gathering: ' + pc.iceGatheringState);
  });

  pc.addEventListener('signalingstatechange', () => {
    log('Signaling: ' + pc.signalingState);
  });

  pc.addEventListener('track', (ev) => {
    log('🎯 track event: kind=' + ev.track.kind + ' readyState=' + ev.track.readyState);
    if (ev.track.kind !== 'audio') { log('  (skipping non-audio track)'); return; }

    const stream = (ev.streams && ev.streams.length > 0)
      ? ev.streams[0]
      : new MediaStream([ev.track]);

    log('  Stream ID: ' + stream.id.slice(0,8) + ' active=' + stream.active);

    ev.track.addEventListener('unmute', () => {
      log('🔊 Remote track unmuted!', 'ok');
      attachRemoteStream(stream);
    });
    ev.track.addEventListener('mute',   () => log('🔇 Remote track muted!', 'warn'));
    ev.track.addEventListener('ended',  () => log('Remote track ended', 'warn'));

    attachRemoteStream(stream);
  });
}

function connect() {
  const server   = document.getElementById('sipServer').value;
  const user     = document.getElementById('sipUser').value;
  const password = document.getElementById('sipPassword').value;
  if (!password) { alert('Enter your SIP Secret!'); return; }

  populateAudioOutputs();
  log('⏳ Connecting to ' + server + '...');

  const socket = new JsSIP.WebSocketInterface(`wss://${server}:8089/ws`);
  ua = new JsSIP.UA({
    sockets: [socket],
    uri: `sip:${user}@${server}`,
    password,
    display_name: user,
    register: true,
    session_timers: true
  });

  ua.on('connected',    () => log('🔗 WebSocket Connected', 'ok'));
  ua.on('disconnected', () => log('🔌 WebSocket Disconnected', 'warn'));
  ua.on('registered', () => {
    log('✅ Registered!', 'ok');
    updateStatus('Connected & Registered', 'connected');
    document.getElementById('callControls').style.display = 'block';
    document.getElementById('disconnectBtn').disabled = false;
  });
  ua.on('registrationFailed', (e) => {
    log('❌ Registration Failed: ' + e.cause, 'error');
    updateStatus('Registration Failed', 'disconnected');
  });

  ua.on('newRTCSession', (data) => {
    if (session && session !== data.session) {
      data.session.terminate();
      return;
    }

    session = data.session;

    // ── For outgoing: peerconnection event fires reliably ──
    session.on('peerconnection', (e) => {
      log('🔌 PeerConnection created (peerconnection event)');
      stopPCPoller(); // no need to poll, we got it directly
      pcAttached = true;
      attachPeerConnectionEvents(e.peerconnection);
    });

    log(data.originator === 'remote' ? '📞 INCOMING CALL' : '📤 Outgoing call...');

    if (data.originator === 'remote') {
      document.getElementById('answerBtn').disabled = false;
      document.getElementById('hangupBtn').disabled = false;
      document.getElementById('callBtn').disabled = true;
    }

    session.on('confirmed', () => {
      log('🗣️ Call CONFIRMED — SDP complete', 'ok');
      document.getElementById('callStatus').textContent = 'In Call';
      document.getElementById('answerBtn').disabled = true;

      const audioEl = document.getElementById('remoteAudio');
      log('Post-confirm check — srcObject: ' + (audioEl.srcObject ? 'SET' : 'NULL'));
      log('Post-confirm check — paused: ' + audioEl.paused);

      if (audioEl.srcObject) {
        runAudioDiagnostics(audioEl.srcObject, audioEl);
        if (audioEl.paused) {
          audioEl.play()
            .then(() => log('✅ play() on confirmed OK', 'ok'))
            .catch(e => {
              log('❌ play() on confirmed failed: ' + e.message, 'error');
              document.getElementById('forcePlayBtn').style.display = 'block';
            });
        }
      } else if (pendingRemoteStream) {
        log('⚠️ srcObject null after confirm — re-attaching pending stream', 'warn');
        attachRemoteStream(pendingRemoteStream);
      } else {
        log('❌ NO STREAM after confirmed — track event never fired!', 'error');
        document.getElementById('forcePlayBtn').style.display = 'block';
      }
    });

    session.on('ended',  resetCallUI);
    session.on('failed', (e) => { log('Call failed: ' + e.cause, 'error'); resetCallUI(); });
  });

  ua.start();
}

function call() {
  if (!ua || !ua.isRegistered()) { alert('Connect first!'); return; }
  if (session) { log('Already in call'); return; }

  const targetExt = document.getElementById('targetExt').value;
  if (!targetExt) { alert('Enter extension'); return; }

  document.getElementById('callBtn').disabled = true;
  document.getElementById('targetExt').disabled = true;

  const server = document.getElementById('sipServer').value;
  log('🎤 Getting mic...');

  navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then((stream) => {
      localStream = stream;
      visualizeAudio(stream, 'micLevel');
      log('📤 Dialing ' + targetExt + '...');
      session = ua.call(`sip:${targetExt}@${server}`, {
        mediaStream: stream,
        pcConfig,
        rtcOfferConstraints: { offerToReceiveAudio: 1, offerToReceiveVideo: 0 }
      });
      document.getElementById('hangupBtn').disabled = false;
    })
    .catch(err => { log('❌ Mic: ' + err.message, 'error'); resetCallUI(); });
}

function answerCall() {
  if (!session) return;
  document.getElementById('answerBtn').disabled = true;
  log('🎤 Resuming AudioContext + getting mic...');

  getAudioCtx().resume().then(() =>
    log('AudioCtx state after resume: ' + sharedAudioCtx.state, 'ok')
  );

  navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then((stream) => {
      localStream = stream;
      visualizeAudio(stream, 'micLevel');
      log('✅ Answering...');

      // ── THE FIX: start polling for PC RIGHT NOW, before answer() ──
      // answer() triggers PC creation internally; poll grabs it the moment it exists
      startPCPoller();

      session.answer({ mediaStream: stream, pcConfig });

      const audioEl = document.getElementById('remoteAudio');
      audioEl.play()
        .then(() => log('🔊 Initial play() on answer OK', 'ok'))
        .catch(e => log('play() right after answer: ' + e.message + ' (will retry)', 'warn'));
    })
    .catch(err => {
      log('❌ Mic blocked: ' + err.message, 'error');
      session.terminate();
    });
}

function hangup() {
  if (session) session.terminate();
}

function disconnect() {
  if (ua) {
    ua.stop(); ua = null;
    updateStatus('Disconnected', 'disconnected');
    document.getElementById('callControls').style.display = 'none';
  }
}

function resetCallUI() {
  stopPCPoller();
  pcAttached = false;
  document.getElementById('callStatus').textContent = 'Ready';
  document.getElementById('answerBtn').disabled = true;
  document.getElementById('hangupBtn').disabled = true;
  document.getElementById('callBtn').disabled = false;
  document.getElementById('targetExt').disabled = false;
  document.getElementById('forcePlayBtn').style.display = 'none';
  document.getElementById('diagPanel').style.display = 'none';

  const audioEl = document.getElementById('remoteAudio');
  if (audioEl.srcObject) {
    audioEl.srcObject.getTracks().forEach(t => t.stop());
    audioEl.srcObject = null;
  }
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  pendingRemoteStream = null;

  document.getElementById('micLevel').style.width = '0%';
  document.getElementById('speakerLevel').style.width = '0%';
  if (session) { try { session.terminate(); } catch(e) {} }
  session = null;
  log('📴 Call ended.');
}
</script>
</body>
</html>
