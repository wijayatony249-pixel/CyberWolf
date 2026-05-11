const socket = io();

const joinCard = document.getElementById('joinCard');
const gameCard = document.getElementById('gameCard');
const usernameInput = document.getElementById('username');
const roomCodeInput = document.getElementById('roomCode');
const publicLobbyList = document.getElementById('publicLobbyList');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const startBtn = document.getElementById('startBtn');
const addBotBtn = document.getElementById('addBotBtn');
const dissolveBtn = document.getElementById('dissolveBtn');
const leaveBtn = document.getElementById('leaveBtn');
const copyRoomBtn = document.getElementById('copyRoomBtn');
const helpBtn = document.getElementById('helpBtn');
const closeHelpBtn = document.getElementById('closeHelpBtn');
const helpModal = document.getElementById('helpModal');

const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmOkBtn = document.getElementById('confirmOkBtn');

const alertModal = document.getElementById('alertModal');
const alertMessage = document.getElementById('alertMessage');
const alertOkBtn = document.getElementById('alertOkBtn');

const roomLabel = document.getElementById('roomLabel');
const meLabel = document.getElementById('meLabel');
const roleDesc = document.getElementById('roleDesc');
const missionHint = document.getElementById('missionHint');
const phaseLabel = document.getElementById('phaseLabel');
const timerLabel = document.getElementById('timerLabel');
const actionHelp = document.getElementById('actionHelp');

const roleRevealModal = document.getElementById('roleRevealModal');
const revealRoleName = document.getElementById('revealRoleName');
const revealRoleIcon = document.getElementById('revealRoleIcon');
const revealRoleDesc = document.getElementById('revealRoleDesc');
const idleAvatar = document.getElementById('idleAvatar');

const phaseTransitionOverlay = document.getElementById('phaseTransitionOverlay');
const phaseTransitionText = document.getElementById('phaseTransitionText');
const bgMusicLobby = document.getElementById('bgMusicLobby');
const bgMusicDay   = document.getElementById('bgMusicDay');
const bgMusicNight = document.getElementById('bgMusicNight');
const muteToggle = document.getElementById('muteToggle');
const targetLabel = document.getElementById('targetLabel');

const playersEl = document.getElementById('players');
const targetList = document.getElementById('targetList');
const targetSelect = document.getElementById('targetSelect');
const voteBtn = document.getElementById('voteBtn');
const roleActionBtn = document.getElementById('roleActionBtn');
const sysSaveBtn = document.getElementById('sysSaveBtn');
const sysKillBtn = document.getElementById('sysKillBtn');
const statusList = document.getElementById('statusList');
const setupCard = document.getElementById('setupCard');
const setupVisibility = document.getElementById('setupVisibility');
const dayMinutesInput = null;
const nightSecondsInput = null;
const roleUserInput = document.getElementById('roleUserInput');
const maxPlayersInput = document.getElementById('maxPlayersInput');
const saveSetupBtn = document.getElementById('saveSetupBtn');

const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');

const malwareErrorScene = document.getElementById('malwareErrorScene');
const errorBoxContainer = document.getElementById('errorBoxContainer');
const bsodLayer = document.getElementById('bsodLayer');
const sfxError = document.getElementById('sfxError');

const securityWinScene = document.getElementById('securityWinScene');
const purgeTerminal = document.getElementById('purgeTerminal');
const hologramShield = document.getElementById('hologramShield');
const sfxSuccess = document.getElementById('sfxSuccess');

const malwareSuccessScene = document.getElementById('malwareSuccessScene');
const malwareDeletedScene = document.getElementById('malwareDeletedScene');

const gameOverOverlay = document.getElementById('gameOverOverlay');
const gameOverIcon    = document.getElementById('gameOverIcon');
const gameOverTitle   = document.getElementById('gameOverTitle');
const gameOverDesc    = document.getElementById('gameOverDesc');
const gameOverBtn     = document.getElementById('gameOverBtn');

let state = null;
let timerInterval = null;
let publicLobbies = [];
let hasRevealedRoleThisGame = false;
let hasShownGameOverThisGame = false;
let selectedPlayerId = null; // tracks selected card in custom target picker

const ROLE_EMOJIS = {
  malware: '🦠',
  user: '🙂',
  analyst: '🕵️',
  defender: '🛡️',
  logicbomb: '💣',
  sysadmin: '🧑‍💻',
};

// --- 3-Theme Background Music System ---
const allMusics = [bgMusicLobby, bgMusicDay, bgMusicNight];
allMusics.forEach(a => { if (a) a.volume = 0.35; });

let isMuted = false;
let currentMusic = null;

function stopAllMusic() {
  allMusics.forEach(a => {
    if (a) { a.pause(); a.currentTime = 0; }
  });
  currentMusic = null;
}

function playMusic(audioEl) {
  if (!audioEl || isMuted) return;
  
  // REALLY Stop everything else
  allMusics.forEach(a => { 
    if (a && a !== audioEl) { 
      a.pause(); 
      a.currentTime = 0; 
    } 
  });

  // Don't restart if it's already this track playing
  if (currentMusic === audioEl && !audioEl.paused) return;
  
  console.log("Playing track:", audioEl.id);
  
  currentMusic = audioEl;
  audioEl.currentTime = 0;
  const playPromise = audioEl.play();
  if (playPromise !== undefined) {
    playPromise.catch(e => {
      console.log('Audio blocked (waiting for interaction):', audioEl.id);
    });
  }
}

function switchMusicForPhase(phase) {
  console.log("Switching music for phase:", phase);
  if (phase === 'lobby' || !phase) playMusic(bgMusicLobby);
  else if (phase === 'day')        playMusic(bgMusicDay);
  else if (phase === 'night')      playMusic(bgMusicNight);
  else if (phase === 'ended')      stopAllMusic();
}


muteToggle.onclick = () => {
  isMuted = !isMuted;
  if (isMuted) {
    stopAllMusic();
    muteToggle.textContent = '🔇';
  } else {
    muteToggle.textContent = '🔊';
    // Resume music for current phase
    if (state) switchMusicForPhase(state.phase);
    else playMusic(bgMusicLobby);
  }
};

function attemptPlayMusic() {
  if (!isMuted) playMusic(bgMusicLobby);
}

// --- Modern Confirm Notification ---
let onConfirmCallback = null;
function showConfirm(title, message, onConfirm) {
  confirmTitle.innerText = title;
  confirmMessage.innerText = message;
  onConfirmCallback = onConfirm;
  confirmModal.classList.remove('hidden');
}

confirmCancelBtn.onclick = () => {
  confirmModal.classList.add('hidden');
  onConfirmCallback = null;
};

confirmOkBtn.onclick = () => {
  if (onConfirmCallback) onConfirmCallback();
  confirmModal.classList.add('hidden');
  onConfirmCallback = null;
};

confirmModal.onclick = (e) => {
  if (e.target === confirmModal) {
    confirmModal.classList.add('hidden');
    onConfirmCallback = null;
  }
};

function showAlert(message) {
  alertMessage.innerText = message;
  alertModal.classList.remove('hidden');
}

alertOkBtn.onclick = () => alertModal.classList.add('hidden');
alertModal.onclick = (e) => {
  if (e.target === alertModal) alertModal.classList.add('hidden');
};

function backToLanding() {
  state = null;
  if (timerInterval) clearInterval(timerInterval);
  gameCard.classList.remove('game-started');
  gameCard.classList.add('hidden');
  joinCard.classList.remove('hidden');
  gameOverOverlay.classList.add('hidden');

  // Hide malware scene
  if (malwareErrorScene) malwareErrorScene.classList.add('hidden');
  if (bsodLayer) bsodLayer.classList.add('hidden');
  if (errorBoxContainer) errorBoxContainer.innerHTML = '';
  document.body.classList.remove('glitch-active');

  // Hide security scene
  if (securityWinScene) securityWinScene.classList.add('hidden');
  if (purgeTerminal) purgeTerminal.innerHTML = '';
  if (hologramShield) hologramShield.classList.add('hidden');

  // Hide new malware scenes
  if (malwareSuccessScene) malwareSuccessScene.classList.add('hidden');
  if (malwareDeletedScene) malwareDeletedScene.classList.add('hidden');

  stopAllMusic();
  playMusic(bgMusicLobby);
}

function showGameOver(winner) {
  try {
    // winner: 'malware' or 'security'
    stopAllMusic();
    const isMalwareWin = winner === 'malware';
    const myRole = (state && state.me) ? state.me.role : 'user';
    const isIMalware = (myRole === 'malware');

    console.log("Game Over Triggered. Winner:", winner, "My Role:", myRole);

    // Initial sequence trigger
    if (isMalwareWin) {
      if (isIMalware) triggerMalwareSuccessScene();
      else triggerMalwareVictoryScene();
    } else {
      if (isIMalware) triggerMalwareDeletedScene();
      else triggerSecurityVictoryScene();
    }



    // Delay the final "Malware Menang!" / "Security Menang!" modal
    // so background animations (XP errors, Purge terminal, etc.) can run first.
    // We delay by 6-8 seconds to allow the sequence to feel premium.
    const modalDelay = isMalwareWin ? 7500 : 4000;

    setTimeout(() => {
      if (gameOverOverlay) {
        gameOverOverlay.classList.remove('hidden');
        gameOverOverlay.className = `game-over-overlay ${isMalwareWin ? 'malware-wins' : 'security-wins'}`;
        if (gameOverIcon) gameOverIcon.textContent = isMalwareWin ? '🦠' : '🛡️';
        if (gameOverTitle) gameOverTitle.textContent = isMalwareWin ? '🚨 Malware Menang!' : '✅ Malware Telah Dikalahkan!';
        if (gameOverDesc) gameOverDesc.textContent = isMalwareWin 
          ? 'Malware berhasil mengeliminasi seluruh tim Security. Sistem telah dikompromikan sepenuhnya.' 
          : 'Tim Security berhasil memberantas semua Malware. Jaringan aman kembali!';
      }
    }, modalDelay);

  } catch (err) {
    console.error("Error showing game over:", err);
  }
}

function triggerSecurityVictoryScene() {
  try {
    if (!securityWinScene) return;
    securityWinScene.classList.remove('hidden');
    if (purgeTerminal) {
      purgeTerminal.classList.remove('hidden');
      purgeTerminal.innerHTML = '';
    }
    if (hologramShield) hologramShield.classList.add('hidden');

    if (sfxSuccess) {
      sfxSuccess.volume = 0.6;
      sfxSuccess.play().catch(e => console.log('Success SFX blocked'));
    }

    const logs = [
      "[INIT] System integrity check starting...",
      "[SCAN] Deep scanning core kernel...",
      "[WARN] Foreign payload detected in /sys/temp/malware.exe",
      "[PURGE] Deleting suspicious processes...",
      "[INFO] Restoring firewall rules...",
      "[INFO] Flushing compromised cache...",
      "[OK] All 🦠 Malware nodes eliminated.",
      "[DONE] SYSTEM INTEGRITY: 100%"
    ];

    let i = 0;
    const logInterval = setInterval(() => {
      if (!purgeTerminal || i >= logs.length) {
        clearInterval(logInterval);
        setTimeout(() => {
          if (purgeTerminal) purgeTerminal.classList.add('hidden');
          if (hologramShield) hologramShield.classList.remove('hidden');
        }, 800);
        return;
      }
      const p = document.createElement('p');
      p.className = 'purge-line';
      p.textContent = logs[i];
      purgeTerminal.appendChild(p);
      purgeTerminal.scrollTop = purgeTerminal.scrollHeight;
      i++;
    }, 350);
  } catch (e) { console.error(e); }
}

function triggerMalwareSuccessScene() {
  if (malwareSuccessScene) malwareSuccessScene.classList.remove('hidden');
  
  // Play Malware Victory Sound
  const sound = new Audio('/audio/malware_win.mp3');
  sound.volume = 0.6;
  sound.play().catch(e => console.log('Malware SFX blocked:', e));
}


function triggerMalwareDeletedScene() {
  if (malwareDeletedScene) malwareDeletedScene.classList.remove('hidden');
}

function triggerMalwareVictoryScene() {
  if (!malwareErrorScene) return;
  malwareErrorScene.classList.remove('hidden');
  document.body.classList.add('glitch-active');
  
  let boxCount = 0;
  const maxBoxes = 15;
  
  const spawnInterval = setInterval(() => {
    if (boxCount >= maxBoxes) {
      clearInterval(spawnInterval);
      setTimeout(() => {
        if (bsodLayer) bsodLayer.classList.remove('hidden');
        document.body.classList.remove('glitch-active');
      }, 2500);
      return;
    }
    
    createXPErrorBox();
    boxCount++;
  }, 350);
}

function createXPErrorBox() {
  // Use a fresh Audio object to avoid cloning issues with source tags
  const sound = new Audio('/audio/windowsXP_Error.mp3');


  sound.volume = 0.5;
  sound.play().catch(e => console.log('SFX blocked:', e));

  
  const box = document.createElement('div');
  box.className = 'xp-error-box';
  
  // Random position within safe bounds
  const x = Math.random() * (window.innerWidth - 340);
  const y = Math.random() * (window.innerHeight - 220);
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
  box.style.zIndex = 10000 + (errorBoxContainer ? errorBoxContainer.children.length : 0);
  
  box.innerHTML = `
    <div class="xp-error-title">
      <span>System Critical Error</span>
      <div class="xp-error-close">X</div>
    </div>
    <div class="xp-error-body">
      <div class="xp-error-icon">X</div>
      <div>A critical malware infection has been detected. System integrity compromised. Your files are being deleted.</div>
    </div>
    <div class="xp-error-footer">
      <button class="xp-button">OK</button>
    </div>
  `;
  
  box.querySelector('.xp-button').onclick = () => box.remove();
  box.querySelector('.xp-error-close').onclick = () => box.remove();
  
  if (errorBoxContainer) errorBoxContainer.appendChild(box);
}

gameOverBtn.onclick = () => backToLanding();


// populateRoleSelect removed - no longer needed



function appendBox(el, text) {
  const p = document.createElement('p');
  p.textContent = text;
  el.appendChild(p);
  el.scrollTop = el.scrollHeight;
}

function selectedTargetId() {
  // Use the custom card picker value first, fallback to hidden select
  return selectedPlayerId || targetSelect.value || null;
}

function joinRoom(roomCode) {
  const code = String(roomCode || roomCodeInput.value || '').trim();
  const username = String(usernameInput.value || '').trim();
  if (!username) {
    alert('Nama agent wajib diisi sebelum bergabung ke lobby.');
    return;
  }
  if (!code) {
    alert('Token room wajib diisi untuk bergabung ke lobby.');
    return;
  }
  roomCodeInput.value = code;
  socket.emit('room:join', { username, roomCode: code });
}

function renderPublicLobbies() {
  const historyList = document.getElementById('historyList');

  // -- ACTIVE LOBBIES --
  publicLobbyList.innerHTML = '';
  const activeRooms = Array.isArray(publicLobbies)
    ? publicLobbies                        // backward compat
    : (publicLobbies.active || []);

  if (!activeRooms.length) {
    const li = document.createElement('li');
    li.className = 'lobby-empty';
    li.innerHTML = '<span>🔍 Tidak ada lobby aktif saat ini.</span>';
    publicLobbyList.appendChild(li);
  } else {
    for (const lobby of activeRooms) {
      if (lobby.phase === 'ended') continue; // skip ended in active section
      const isPrivate = String(lobby.visibility || '').toLowerCase() === 'private';
      const li = document.createElement('li');
      li.className = 'lobby-card';

      li.innerHTML = `
        <div class="lobby-card-header">
          <span class="lobby-status-dot active-dot"></span>
          <span class="lobby-card-host">${isPrivate ? '🔒' : '🌐'} ${lobby.host}'s Room</span>
          <span class="lobby-card-badge open-badge">OPEN</span>
        </div>
        <div class="lobby-card-meta">
          👥 ${lobby.players} pemain &bull; ${isPrivate ? 'Privat' : 'Publik'}
        </div>
      `;

      if (!isPrivate) {
        const btn = document.createElement('button');
        btn.textContent = '▶ Join Room';
        btn.className = 'lobby-join-btn';
        btn.onclick = () => joinRoom(lobby.code);
        li.appendChild(btn);
      } else {
        const btn = document.createElement('button');
        btn.textContent = '🔒 Butuh Token';
        btn.className = 'lobby-join-btn btn-muted';
        btn.disabled = true;
        li.appendChild(btn);
      }

      publicLobbyList.appendChild(li);
    }
  }

  // -- GAME HISTORY --
  if (!historyList) return;
  historyList.innerHTML = '';
  const ended = Array.isArray(publicLobbies) ? [] : (publicLobbies.history || []);

  if (!ended.length) {
    const li = document.createElement('li');
    li.className = 'lobby-empty';
    li.innerHTML = '<span>📭 Belum ada riwayat permainan.</span>';
    historyList.appendChild(li);
  } else {
    for (const game of ended) {
      const li = document.createElement('li');
      li.className = 'lobby-card history-card';
      const isMalwareWin = game.winner === 'malware';
      const winnerLabel = isMalwareWin
        ? '<span class="winner-badge malware-badge">🦠 Malware Menang</span>'
        : '<span class="winner-badge security-badge">🛡️ Security Menang</span>';

      li.innerHTML = `
        <div class="lobby-card-header">
          <span class="lobby-status-dot ended-dot"></span>
          <span class="lobby-card-host">Host: ${game.host}</span>
          <span class="lobby-card-badge ended-badge">SELESAI</span>
        </div>
        <div class="lobby-card-meta">
          👥 ${game.players} pemain &bull; ${winnerLabel}
        </div>
      `;
      historyList.appendChild(li);
    }
  }
}

function phaseText(phase) {
  if (phase === 'discussion') return 'DISKUSI - Cari Malware';
  if (phase === 'voting') return 'VOTING - Pilih Target';
  if (phase === 'night') return 'MALAM - Aksi Rahasia';
  if (phase === 'resolving_night') return 'RESOLUSI - Hasil Malam';
  if (phase === 'resolving_voting') return 'RESOLUSI - Hasil Voting';
  if (phase === 'lobby') return 'LOBBY - Menunggu Pemain';
  if (phase === 'ended') return 'GAME OVER';
  return phase.toUpperCase();
}

function buildActionGuide() {
  if (!state || !state.me) return 'Menunggu data...';
  if (!state.me.alive && state.phase !== 'ended') return 'Kamu sudah tereliminasi. Pantau jalannya game dari status operasi dan chat.';

  const role = state.me.role;
  if (state.phase === 'lobby') return 'Tunggu pembuat room menekan tombol Mulai Game.';
  if (state.phase === 'discussion') return 'Silakan berdiskusi di chat. Gunakan fase ini untuk menganalisis perilaku pemain.';
  if (state.phase === 'voting') return 'FASE VOTING: Pilih pemain yang mencurigakan, lalu klik Kirim Voting.';
  if (state.phase === 'night') {
    if (role === 'malware') return '🦠 Malware: Pilih target infeksi malam ini.';
    if (role === 'analyst') return '🕵️ Analyst: Pilih target untuk discan.';
    if (role === 'defender') return '🛡️ Firewall: Pilih target untuk dilindungi.';
    if (role === 'sysadmin') return '🧑‍💻 SysAdmin: Pantau log atau gunakan skill aktif.';
    if (role === 'logicbomb') return '💣 Logic Bomb: Kunci target "bom" mu malam ini.';
    return 'Tunggu fase berikutnya.';
  }
  if (state.phase === 'ended') return 'Game selesai.';
  return 'Ikuti instruksi fase yang berjalan.';
}

function showRoleReveal(roleId, roleLabel, roleDescText) {
  revealRoleName.textContent = roleLabel;
  revealRoleDesc.textContent = roleDescText;
  
  const icon = ROLE_EMOJIS[roleId] || '🐺';
  revealRoleIcon.textContent = icon;
  
  // Set modal animation classes
  roleRevealModal.classList.remove('hidden');
  roleRevealModal.classList.remove('reveal-animate');
  
  // Trigger animation after a brief delay
  setTimeout(() => {
    roleRevealModal.classList.add('reveal-animate');
  }, 100);
  
  // Hide modal after 4 seconds
  setTimeout(() => {
    roleRevealModal.classList.add('hidden');
    roleRevealModal.classList.remove('reveal-animate');
  }, 4000);
}

function renderState(nextState, prevPhase = null) {
  console.log(`Rendering State. Phase: ${prevPhase} -> ${nextState.phase}`);

  // Check if we need to reveal role
  if (nextState.me && nextState.started && nextState.phase !== 'ended' && !hasRevealedRoleThisGame) {
    showRoleReveal(nextState.me.role, nextState.me.roleLabel, nextState.me.roleDesc);
    hasRevealedRoleThisGame = true;
  }
  if (!nextState.started || nextState.phase === 'ended') {
    hasRevealedRoleThisGame = false;
  }

  // Phase Transition Overlays + Music switch
  if (prevPhase !== nextState.phase) {

    const isNight = nextState.phase === 'night';
    const isDay = nextState.phase === 'day';
    const isFirstNight = (isNight && nextState.round === 0);
    const transitionDelay = isFirstNight ? 4000 : 0; // Wait for role reveal if it's first night

    // Handle Music with proper timing
    setTimeout(() => {
      switchMusicForPhase(nextState.phase);
    }, transitionDelay);

    // Handle Phase Overlay
    if (isNight || isDay) {
      setTimeout(() => {
        if (!phaseTransitionOverlay) return;
        
        // Remove hidden, add active and appropriate theme
        phaseTransitionOverlay.classList.remove('hidden');
        const isNightPhase = nextState.phase === 'night';
        phaseTransitionOverlay.className = isNightPhase ? 'phase-transition active' : 'phase-transition morning active';
        
        if (phaseTransitionText) {
          if (nextState.phase === 'night') phaseTransitionText.textContent = '🌙 Malam Telah Tiba...';
          else if (nextState.phase === 'discussion') phaseTransitionText.textContent = '☀️ Waktu Sudah Pagi...';
          else if (nextState.phase === 'voting') phaseTransitionText.textContent = '🗳️ Saatnya Voting!';
          else phaseTransitionText.textContent = phaseText(nextState.phase);
          // Trigger a re-flow for animation
          phaseTransitionText.style.animation = 'none';
          void phaseTransitionText.offsetWidth;
          phaseTransitionText.style.animation = 'phaseTextScale 3s forwards ease-out';
        }

        // Hide after 3.5 seconds
        setTimeout(() => {
          if (phaseTransitionOverlay) {
            phaseTransitionOverlay.classList.remove('active');
            setTimeout(() => phaseTransitionOverlay.classList.add('hidden'), 1500); // Wait for fade out
          }
        }, 3500);
      }, transitionDelay);
    }
    // Game Over Screen
    if (nextState.phase === 'ended') {
      if (!hasShownGameOverThisGame) {
        hasShownGameOverThisGame = true;
        const winner = nextState.winner || 'security';
        setTimeout(() => showGameOver(winner), 1200);
      }
    } else {
      hasShownGameOverThisGame = false;
    }
  } else if (nextState.phase === 'ended' && !hasShownGameOverThisGame) {
    // Failsafe for refresh: if we are in 'ended' phase but haven't shown it yet
    hasShownGameOverThisGame = true;
    const winner = nextState.winner || 'security';
    showGameOver(winner);
  } else if (nextState.phase !== 'ended') {
    // Failsafe: if we missed music switch due to refresh
    switchMusicForPhase(nextState.phase);
  }

  // Lobby vs In-Game panel separation
  if (nextState.started && nextState.phase !== 'lobby') {
    gameCard.classList.add('game-started');
  } else {
    gameCard.classList.remove('game-started');
  }

  // Idle Avatar
  if (idleAvatar) {
    if (nextState.started && nextState.me && nextState.me.role && nextState.phase !== 'ended') {
      idleAvatar.textContent = ROLE_EMOJIS[nextState.me.role] || '🐺';
      idleAvatar.className = `idle-avatar role-${nextState.me.role}`;
    } else {
      idleAvatar.textContent = '';
      idleAvatar.className = 'idle-avatar';
    }
  }

  state = nextState;
  roomLabel.textContent = `ROOM: ${state.code}`;
  if (copyRoomBtn) copyRoomBtn.disabled = !state.code;
  meLabel.textContent = `${state.me.username} | Role: ${state.me.roleLabel} | ${state.me.alive ? 'ALIVE' : 'ELIMINATED'}`;
  roleDesc.textContent = `📌 ${state.me.roleDesc || ''}`;
  missionHint.textContent = buildActionGuide();
  phaseLabel.textContent = phaseText(state.phase);
  actionHelp.textContent = buildActionGuide();

  // Set Role Avatar
  if (state.me && state.started && state.phase !== 'ended') {
    const roleId = state.me.role;
    roleAvatarIcon.textContent = ROLE_EMOJIS[roleId] || '🐺';
    roleAvatarIcon.className = `avatar-${roleId}`;
    roleAvatarContainer.style.display = 'flex';
  } else {
    roleAvatarIcon.textContent = '👤';
    roleAvatarIcon.className = '';
    roleAvatarContainer.style.display = 'none';
  }

  const isCreator = state.me.isCreator;
  const isNight = state.phase === 'night';
  const isVoting = state.phase === 'voting';
  const isDiscussion = state.phase === 'discussion';
  const isLobby = state.phase === 'lobby';
  const alive = state.me.alive;
  const role = state.me.role;

  playersEl.innerHTML = '';
  // Build custom target card list
  if (targetList) {
    targetList.innerHTML = '';
    selectedPlayerId = null; // reset selection on each re-render

    const PLAYER_AVATARS = {
      malware: '🦠', analyst: '🕵️', defender: '🛡️',
      logicbomb: '💣', sysadmin: '🧑‍💻', user: '🙂',
    };
    const phaseHint = isDay ? 'Kandidat Eksekusi' : isNight ? 'Target Malam' : 'Agent';

    const targets = state.players.filter(p => p.alive && p.id !== state.me.id);

    if (targets.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'target-card';
      empty.style.justifyContent = 'center';
      empty.style.cursor = 'default';
      empty.innerHTML = '<span style="color:var(--muted);font-size:13px;">Tidak ada target tersedia</span>';
      targetList.appendChild(empty);
    }

    targets.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'target-card';
      card.dataset.id = p.id;
      card.style.animationDelay = `${idx * 0.06}s`;

      const avatar = PLAYER_AVATARS[p.role] || '👤';

      card.innerHTML = `
        <div class="target-card-dot"></div>
        <div class="target-card-avatar">${avatar}</div>
        <div class="target-card-info">
          <div class="target-card-name">${p.username}</div>
          <div class="target-card-sub">${phaseHint} &bull; ONLINE</div>
        </div>
        <div class="target-card-check">&#x2713;</div>
      `;

      card.onclick = () => {
        targetList.querySelectorAll('.target-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedPlayerId = p.id;
        targetSelect.value = p.id;
      };

      targetList.appendChild(card);
    });

    // Auto-select first card
    const firstCard = targetList.querySelector('.target-card[data-id]');
    if (firstCard) {
      firstCard.classList.add('selected');
      selectedPlayerId = firstCard.dataset.id;
      targetSelect.value = selectedPlayerId;
    }
  }


  // Dynamic UI Target Labels
  if (targetLabel) {
    if (!alive) {
      targetLabel.textContent = "👻 Kamu sudah tereliminasi, tidak bisa melakukan aksi.";
    } else if (isDiscussion) {
      targetLabel.textContent = "💬 Fase Diskusi: Silakan berdiskusi di chat sebelum voting dibuka.";
    } else if (isVoting) {
      targetLabel.textContent = "🗳️ Fase Voting: Pilih siapa yang ingin kamu eksekusi:";
    } else if (isNight) {
      if (role === 'malware') targetLabel.textContent = "🦠 Pilih target korban infeksi:";
      else if (role === 'analyst') targetLabel.textContent = "🕵️ Pilih siapa yang ingin di-scan:";
      else if (role === 'defender') targetLabel.textContent = "🛡️ Pilih siapa yang ingin dilindungi:";
      else if (role === 'sysadmin') targetLabel.textContent = "🧑‍💻 Pilih target untuk Restore / Force Delete:";
      else if (role === 'logicbomb') targetLabel.textContent = "💣 Kunci target yang akan meledak jika kamu mati:";
      else targetLabel.textContent = "Pilih target (Role kamu tidak punya aksi malam):";
    } else {
      targetLabel.textContent = "Menunggu instruksi selanjutnya...";
    }
  }

  // Button styling for clarity
  if (voteBtn) {
    if (isVoting && alive) {
      voteBtn.style.display = 'inline-block';
      voteBtn.style.background = 'linear-gradient(90deg, #ff3b5c, #cc0033)';
      voteBtn.style.color = '#fff';
      voteBtn.textContent = '✅ Konfirmasi Voting';
    } else {
      voteBtn.style.display = 'none';
    }
  }

  if (roleActionBtn) {
    if (isNight && alive && role !== 'user' && role !== 'sysadmin') {
      roleActionBtn.style.display = 'inline-block';
      if (role === 'logicbomb') roleActionBtn.textContent = '💣 Kunci Target Bom';
    } else {
      roleActionBtn.style.display = 'none';
    }
  }

  for (const p of state.players) {
    const li = document.createElement('li');
    li.textContent = `${p.username} ${p.alive ? 'online' : 'tereliminasi'}`;
    
    // Add kick button if lobby and creator
    if (isLobby && isCreator && p.id !== state.me.id) {
      const kickBtn = document.createElement('button');
      kickBtn.className = 'btn-kick';
      kickBtn.textContent = '❌ Kick';
      kickBtn.onclick = () => socket.emit('room:kick', { targetId: p.id });
      li.appendChild(kickBtn);
    }

    if (!p.alive) li.classList.add('dead');
    if (p.id === state.me.id) li.classList.add('me');
    playersEl.appendChild(li);

    // (target list built above via custom cards)
  }

  startBtn.style.display = isCreator && !state.started ? 'inline-block' : 'none';
  addBotBtn.style.display = isCreator && isLobby ? 'inline-block' : 'none';
  dissolveBtn.style.display = isCreator && isLobby ? 'inline-block' : 'none';
  leaveBtn.style.display = isLobby ? 'inline-block' : 'none';
  // setupCard and saveSetupBtn are no longer inside the game view

  voteBtn.disabled = !(isVoting && alive);
  roleActionBtn.disabled = !(isNight && alive);
  sysSaveBtn.disabled = !(isNight && alive);
  sysKillBtn.disabled = !(isNight && alive);

  // Voting button is shown only during voting phase, others are phase-dependent
  // voteBtn.style.display handled above now
  roleActionBtn.style.display = (isNight && alive && ['malware', 'analyst', 'defender', 'logicbomb'].includes(role)) ? 'inline-block' : 'none';
  sysSaveBtn.style.display = (isNight && alive && role === 'sysadmin' && !state.me.abilities.sysadminSaveUsed) ? 'inline-block' : 'none';
  sysKillBtn.style.display = (isNight && alive && role === 'sysadmin' && !state.me.abilities.sysadminKillUsed) ? 'inline-block' : 'none';


  if (role === 'malware') roleActionBtn.textContent = '🦠 Infect Target';
  if (role === 'analyst') roleActionBtn.textContent = '🕵️ Scan Target';
  if (role === 'defender') roleActionBtn.textContent = '🛡️ Protect Target';
  sysSaveBtn.textContent = '💾 Restore (1x)';
  sysKillBtn.textContent = '🔥 Force Delete (1x)';

  statusList.innerHTML = '';
  const statusRows = [
    `Agent aktif: ${state.status.aliveCount}`,
    `Agent tereliminasi: ${state.status.eliminatedCount}`,
  ];
  if (isDiscussion || isVoting) {
    statusRows.push(`Progres voting: ${state.status.dayVotesSubmitted}/${state.status.dayVotesTotal}`);
  } else if (state.phase === 'night') {
    statusRows.push(`Progres aksi malam: ${state.status.nightProgressSubmitted}/${state.status.nightProgressTotal}`);
  } else if (state.phase === 'lobby') {
    statusRows.push(`Pemain siap: ${state.players.length}/${state.minPlayers} (minimal start)`);
  }
  for (const row of statusRows) {
    const li = document.createElement('li');
    li.textContent = row;
    statusList.appendChild(li);
  }

  if (state.settings) {
    setupVisibility.value = state.settings.visibility || 'public';
    if (maxPlayersInput) maxPlayersInput.value = String(state.settings.maxPlayers || 12);
  }

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!state || !state.localEndsAt) {
      timerLabel.textContent = 'Timer: -';
      return;
    }
    const sec = Math.max(0, Math.floor((state.localEndsAt - Date.now()) / 1000));
    timerLabel.textContent = `Timer: ${sec}s`;
  }, 500);
}

createBtn.onclick = () => {
  attemptPlayMusic();
  const maxPlayers = Number(maxPlayersInput.value || 12);
  socket.emit('room:create', {
    username: usernameInput.value,
    settings: {
      visibility: setupVisibility.value,
      maxPlayers: maxPlayers
    }
  });
};

joinBtn.onclick = () => {
  attemptPlayMusic();
  joinRoom(roomCodeInput.value);
};

startBtn.onclick = () => socket.emit('game:start');
addBotBtn.onclick = () => socket.emit('room:addBot');
dissolveBtn.onclick = () => {
  showConfirm('Bubar Lobby', 'Apakah Anda yakin ingin membubarkan lobby ini? Semua pemain akan dikeluarkan.', () => {
    socket.emit('room:dissolve');
  });
};

leaveBtn.onclick = () => {
  showConfirm('Keluar Lobby', 'Apakah Anda yakin ingin meninggalkan room ini?', () => {
    socket.emit('room:leave');
  });
};
helpBtn.onclick = () => helpModal.classList.remove('hidden');
closeHelpBtn.onclick = () => helpModal.classList.add('hidden');
helpModal.onclick = (e) => {
  if (e.target === helpModal) helpModal.classList.add('hidden');
};

if (copyRoomBtn) {
  copyRoomBtn.onclick = () => {
    if (!state || !state.code) return;
    navigator.clipboard.writeText(state.code).then(() => {
      showAlert(`Kode room ${state.code} berhasil disalin ke clipboard.`);
    }).catch(() => {
      showAlert('Gagal menyalin kode room. Coba ulangi.');
    });
  };
}

voteBtn.onclick = () => {
  const targetId = selectedTargetId();
  if (!targetId) return;
  socket.emit('vote:day', { targetId });
};

roleActionBtn.onclick = () => {
  if (!state) return;
  const targetId = selectedTargetId();
  if (!targetId) return;

  const roleActionMap = {
    malware: 'malware:infect',
    analyst: 'analyst:scan',
    defender: 'defender:protect',
    logicbomb: 'logicbomb:target',
  };
  const action = roleActionMap[state.me.role];
  if (!action) return;
  socket.emit('action:night', { action, targetId });
};

sysSaveBtn.onclick = () => {
  const targetId = selectedTargetId();
  if (!targetId) return;
  socket.emit('action:night', { action: 'sysadmin:save', targetId });
};

sysKillBtn.onclick = () => {
  const targetId = selectedTargetId();
  if (!targetId) return;
  socket.emit('action:night', { action: 'sysadmin:kill', targetId });
};

// saveSetupBtn removed, settings are defined on room creation

sendChatBtn.onclick = () => {
  socket.emit('chat:send', { text: chatInput.value });
  chatInput.value = '';
};

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChatBtn.click();
});

socket.on('room:state', (newState) => {
  const oldPhase = state ? state.phase : null;
  const oldCode = state ? state.code : null;

  // Clear chat if entering a new room or returning to lobby from game
  if (newState.code !== oldCode || (oldPhase && oldPhase !== 'lobby' && newState.phase === 'lobby')) {
    chatBox.innerHTML = '';
  }

  joinCard.classList.add('hidden');
  gameCard.classList.remove('hidden');

  const remainingMs = newState.phaseEndsAt ? (newState.phaseEndsAt - newState.serverNow) : null;
  newState.localEndsAt = remainingMs !== null ? (Date.now() + remainingMs) : null;

  // Pass oldPhase to renderState BEFORE updating the global state variable
  renderState(newState, oldPhase);
  state = newState;
});

socket.on('room:created', ({ roomCode }) => {
  roomCodeInput.value = roomCode;
  showAlert(`Room berhasil dibuat. Token room kamu: ${roomCode}`);
});

socket.on('room:left', ({ message }) => {
  backToLanding();
  if (message) showAlert(message);
});

socket.on('room:kicked', ({ message }) => {
  backToLanding();
  if (message) showAlert(message);
});

socket.on('room:dissolved', ({ message }) => {
  backToLanding();
  showAlert(message || 'Lobby dibubarkan oleh host.');
});

socket.on('lobby:list', (data) => {
  // data is now { active: [...], history: [...] }
  publicLobbies = data || { active: [], history: [] };
  renderPublicLobbies();
});

socket.on('chat:new', (msg) => {
  appendBox(chatBox, `[${new Date(msg.at).toLocaleTimeString()}] ${msg.from}: ${msg.text}`);
});

socket.on('action:logicbomb:available', () => {
  showAlert('💣 Logic Bomb aktif! Pilih target di dropdown lalu klik OK.');
  const targetId = selectedTargetId();
  if (targetId) socket.emit('action:logicbomb:shot', { targetId });
});

socket.on('action:analyst:result', ({ username, isMalware }) => {
  const title = isMalware ? '⚠️ ANCAMAN TERDETEKSI' : '✅ TARGET BERSIH';
  const message = isMalware 
    ? `Hasil scanning menunjukkan bahwa ${username} adalah MALWARE. Segera koordinasikan dengan tim Security!` 
    : `Hasil scanning menunjukkan bahwa ${username} adalah Non-Malware (User Biasa/Spesial).`;
  
  showAlert(message);
});

socket.on('error:message', (err) => {
  showAlert(err);
});

// --- Fetch game history from Supabase via /api/history ---
async function fetchHistory() {
  try {
    const res = await fetch('/api/history');
    if (!res.ok) return;
    const rows = await res.json();
    // Merge into publicLobbies.history and re-render
    if (!Array.isArray(publicLobbies)) {
      publicLobbies = { active: publicLobbies.active || [], history: rows };
    } else {
      publicLobbies = { active: publicLobbies, history: rows };
    }
    renderPublicLobbies();
  } catch (e) {
    console.log('History fetch failed:', e.message);
  }
}

renderPublicLobbies();
fetchHistory(); // load history from Supabase on startup
// Refresh history every 30 seconds
setInterval(fetchHistory, 30000);
