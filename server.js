require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// --- Supabase client ---
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function saveGameHistory(room) {
  try {
    const host = [...room.players.values()].find(p => p.isCreator);
    const { error } = await supabase.from('game_history').insert({
      room_code:    room.code,
      host:         host ? host.username : 'Unknown',
      player_count: room.players.size,
      winner:       room.winner,
      round_count:  room.round,
    });
    if (error) console.error('[Supabase] saveGameHistory error:', error.message);
    else console.log(`[Supabase] Game history saved: ${room.code} → ${room.winner} wins`);
  } catch (e) {
    console.error('[Supabase] saveGameHistory exception:', e.message);
  }
}

const CONFIG = {
  minPlayers: 6,
  maxPlayers: 12,
  nightDurationSec: 30,
  discussionDurationSec: 90,
  votingDurationSec: 45,
};

const ROLE_LABEL = {
  malware: '🦠 Malware',
  user: '🙂 Regular User',
  analyst: '🕵️ Security Analyst',
  defender: '🛡️ Firewall / Defender',
  logicbomb: '💣 Logic Bomb',
  sysadmin: '🧑‍💻 System Admin',
};
const ROLE_DESC = {
  malware: 'Misi: infeksi target tiap malam sampai jumlah Malware menyamai tim lawan.',
  user: 'Misi: analisis chat, cari pelaku, dan voting dengan tepat saat siang.',
  analyst: 'Misi: scan 1 target tiap malam untuk cek status Malware.',
  defender: 'Misi: lindungi 1 pemain tiap malam agar kebal serangan Malware.',
  logicbomb: 'Misi: pilih target bom tiap malam. Jika kamu mati, target tersebut ikut terhapus.',
  sysadmin: 'Misi: pantau log aktivitas sistem dan gunakan Restore/Force Delete di waktu kritis.',
};

const rooms = new Map();

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createRoom(roomCode) {
  return {
    code: roomCode,
    phase: 'lobby',
    round: 0,
    players: new Map(),
    started: false,
    dayVotes: new Map(),
    nightActions: {
      malwareVotes: new Map(),
      analystTarget: null,
      defenderTarget: null,
      sysadminSaveTarget: null,
      sysadminKillTarget: null,
      logicBombTarget: null,
    },
    sysadminUsed: {
      save: false,
      kill: false,
    },
    pendingHunterShot: null,
    logs: [],
    settings: {
      nightDurationSec: CONFIG.nightDurationSec,
      discussionDurationSec: CONFIG.discussionDurationSec,
      votingDurationSec: CONFIG.votingDurationSec,
      maxPlayers: CONFIG.maxPlayers,
      visibility: 'public',
    },
    timer: null,
    phaseEndsAt: null,
  };
}

function normalizeRoomSettings(raw) {
  const defaultSettings = {
    nightDurationSec: CONFIG.nightDurationSec,
    discussionDurationSec: CONFIG.discussionDurationSec,
    votingDurationSec: CONFIG.votingDurationSec,
    maxPlayers: CONFIG.maxPlayers,
    visibility: 'public',
  };
  const next = raw || {};
  const parsed = {
    nightDurationSec: defaultSettings.nightDurationSec,
    discussionDurationSec: defaultSettings.discussionDurationSec,
    votingDurationSec: defaultSettings.votingDurationSec,
    maxPlayers: Math.max(CONFIG.minPlayers, Math.min(CONFIG.maxPlayers, Number(next.maxPlayers) || defaultSettings.maxPlayers)),
    visibility: String(next.visibility || defaultSettings.visibility) === 'private' ? 'private' : 'public',
  };
  return parsed;
}

function summarizePlayer(player) {
  return {
    id: player.id,
    username: player.username,
    alive: player.alive,
    role: player.role,
    protected: player.protected,
    eliminatedRound: player.eliminatedRound,
  };
}

function roomViewForPlayer(room, socketId) {
  const me = room.players.get(socketId);
  const players = [...room.players.values()].map((p) => ({
    id: p.id,
    username: p.username,
    alive: p.alive,
    isCreator: p.isCreator,
    eliminatedRound: p.eliminatedRound,
  }));
  const alive = players.filter((p) => p.alive);
  const aliveCount = alive.length;
  const eliminatedCount = players.length - aliveCount;

  const dayVotesSubmitted = alive.filter((p) => room.dayVotes.has(p.id)).length;

  const aliveMalwareIds = new Set(aliveByRole(room, 'malware').map((p) => p.id));
  const malwareVotesSubmitted = [...room.nightActions.malwareVotes.keys()].filter((id) => aliveMalwareIds.has(id)).length;
  const hasAnalyst = aliveByRole(room, 'analyst').length > 0;
  const hasDefender = aliveByRole(room, 'defender').length > 0;
  const hasSysadmin = aliveByRole(room, 'sysadmin').length > 0;
  const canSysSave = hasSysadmin && !room.sysadminUsed.save;
  const canSysKill = hasSysadmin && !room.sysadminUsed.kill;

  const nightProgressTotal =
    aliveMalwareIds.size + (hasAnalyst ? 1 : 0) + (hasDefender ? 1 : 0) + (canSysSave ? 1 : 0) + (canSysKill ? 1 : 0);
  const nightProgressSubmitted =
    malwareVotesSubmitted +
    (hasAnalyst && room.nightActions.analystTarget ? 1 : 0) +
    (hasDefender && room.nightActions.defenderTarget ? 1 : 0) +
    (canSysSave && room.nightActions.sysadminSaveTarget ? 1 : 0) +
    (canSysKill && room.nightActions.sysadminKillTarget ? 1 : 0);

  return {
    code: room.code,
    phase: room.phase,
    round: room.round,
    started: room.started,
    winner: room.winner || null,
    minPlayers: CONFIG.minPlayers,
    phaseEndsAt: room.phaseEndsAt,
    serverNow: Date.now(),
    settings: room.settings,
    me: me
      ? {
          id: me.id,
          username: me.username,
          role: me.role,
          roleLabel: ROLE_LABEL[me.role],
          roleDesc: ROLE_DESC[me.role],
          alive: me.alive,
          isCreator: me.isCreator,
          abilities: {
            sysadminSaveUsed: room.sysadminUsed.save,
            sysadminKillUsed: room.sysadminUsed.kill,
          },
        }
      : null,
    players,
    status: {
      aliveCount,
      eliminatedCount,
      dayVotesSubmitted,
      dayVotesTotal: aliveCount,
      nightProgressSubmitted,
      nightProgressTotal,
    },
  };
}

function getPublicLobbies() {
  const active = [];
  const history = [];

  for (const room of rooms.values()) {
    const host = [...room.players.values()].find((p) => p.isCreator);
    const entry = {
      code: room.code,
      host: host ? host.username : 'Unknown',
      players: room.players.size,
      phase: room.phase,
      started: room.started,
      visibility: room.settings.visibility,
      winner: room.winner || null,
    };

    if (room.phase === 'ended') {
      history.push(entry);
    } else {
      // Only show non-started (lobby waiting) rooms
      active.push(entry);
    }
  }

  return {
    active: active.sort((a, b) => b.players - a.players).slice(0, 15),
    history: history.slice(-10).reverse(), // last 10 finished games
  };
}

function emitPublicLobbyList() {
  io.emit('lobby:list', getPublicLobbies());
}

function emitRoomState(room) {
  for (const socketId of room.players.keys()) {
    io.to(socketId).emit('room:state', roomViewForPlayer(room, socketId));
  }
}

function addLog(room, message, visibility = 'all', targetRole = null, targetSocketId = null) {
  room.logs.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    message,
    visibility,
    targetRole,
    targetSocketId,
    at: new Date().toISOString(),
  });
}

function sendLog(room, message, opts = {}) {
  const { visibility = 'all', targetRole = null, targetSocketId = null } = opts;
  addLog(room, message, visibility, targetRole, targetSocketId);
  for (const player of room.players.values()) {
    if (visibility === 'all') {
      io.to(player.id).emit('log:new', message);
    } else if (visibility === 'role' && player.role === targetRole) {
      io.to(player.id).emit('log:new', message);
    } else if (visibility === 'private' && player.id === targetSocketId) {
      io.to(player.id).emit('log:new', message);
    }
  }
}

function alivePlayers(room) {
  return [...room.players.values()].filter((p) => p.alive);
}

function aliveByRole(room, role) {
  return alivePlayers(room).filter((p) => p.role === role);
}

function clearPhaseTimer(room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}

function majorityVote(votesMap, eligibleIds) {
  const tally = new Map();
  for (const targetId of votesMap.values()) {
    if (!eligibleIds.has(targetId)) continue;
    tally.set(targetId, (tally.get(targetId) || 0) + 1);
  }
  let winner = null;
  let top = 0;
  let tie = false;
  for (const [targetId, count] of tally.entries()) {
    if (count > top) {
      top = count;
      winner = targetId;
      tie = false;
    } else if (count === top) {
      tie = true;
    }
  }
  if (!winner || tie) return null;
  return winner;
}

function eliminatePlayer(room, targetId, reason) {
  const target = room.players.get(targetId);
  if (!target || !target.alive) return null;
  target.alive = false;
  target.eliminatedRound = room.round;
  sendLog(room, `${target.username} dieliminasi (${reason}). Role: ${ROLE_LABEL[target.role]}`);

  if (target.role === 'logicbomb') {
    // New Logic: If they have a pre-set target from the night, use it.
    const revengeTargetId = room.nightActions.logicBombTarget;
    if (revengeTargetId) {
      const revengeTarget = room.players.get(revengeTargetId);
      if (revengeTarget && revengeTarget.alive) {
        sendLog(room, `Mekanisme Logic Bomb aktif! ${target.username} membawa ${revengeTarget.username} ikut terhapus.`);
        // Note: Recursion safety handled by eliminatePlayer's alive check
        eliminatePlayer(room, revengeTargetId, `efek Logic Bomb dari ${target.username}`);
      }
    }
  }

  checkWinCondition(room);
  return target;
}

function checkWinCondition(room) {
  const malwareCount = aliveByRole(room, 'malware').length;
  const goodCount = alivePlayers(room).length - malwareCount;

  if (malwareCount === 0) {
    room.phase = 'ended';
    room.winner = 'security';
    clearPhaseTimer(room);
    sendLog(room, 'Game selesai: Tim Security menang. Semua Malware telah dihapus.');
    saveGameHistory(room); // persist to Supabase
    emitRoomState(room);
    emitPublicLobbyList();
    return true;
  }
  if (malwareCount >= goodCount) {
    room.phase = 'ended';
    room.winner = 'malware';
    clearPhaseTimer(room);
    sendLog(room, 'Game selesai: Tim Malware menang. Sistem telah dikompromikan.');
    saveGameHistory(room); // persist to Supabase
    emitRoomState(room);
    emitPublicLobbyList();
    return true;
  }
  return false;
}

function resetNightActions(room) {
  room.nightActions = {
    malwareVotes: new Map(),
    analystTarget: null,
    defenderTarget: null,
    sysadminSaveTarget: null,
    sysadminKillTarget: null,
  };
  for (const p of room.players.values()) {
    p.protected = false;
  }
}

function startDiscussion(room) {
  room.phase = 'discussion';
  room.round += 1;
  room.dayVotes = new Map();
  room.phaseEndsAt = Date.now() + room.settings.discussionDurationSec * 1000;
  sendLog(room, `--- FASE DISKUSI DIMULAI (Ronde ${room.round}) ---`);
  sendLog(room, "Silakan berdiskusi, cari jejak Malware. Voting akan dibuka setelah ini.");
  emitRoomState(room);

  clearPhaseTimer(room);
  room.timer = setTimeout(() => startVoting(room), room.settings.discussionDurationSec * 1000);
}

function startVoting(room) {
  room.phase = 'voting';
  room.phaseEndsAt = Date.now() + room.settings.votingDurationSec * 1000;
  sendLog(room, "--- FASE VOTING DIBUKA ---");
  sendLog(room, "Pilih pemain yang paling mencurigakan untuk dieliminasi.");
  emitRoomState(room);

  clearPhaseTimer(room);
  room.timer = setTimeout(() => resolveVoting(room.code), room.settings.votingDurationSec * 1000);
  
  simulateBotDayActions(room); // Bots vote during voting phase
}

function checkVotingCompletion(room) {
  if (room.phase !== 'voting') return;
  const aliveCount = alivePlayers(room).length;
  if (room.dayVotes.size >= aliveCount) {
    resolveVoting(room.code);
  }
}

async function resolveVoting(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.phase !== 'voting') return;

  room.phase = 'resolving_voting';
  clearPhaseTimer(room);
  emitRoomState(room);

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  sendLog(room, "--- VOTING BERAKHIR. MENGHITUNG SUARA... ---");
  await sleep(2000);

  const eligible = new Set(alivePlayers(room).map((p) => p.id));
  const executedId = majorityVote(room.dayVotes, eligible);

  if (executedId) {
    const target = room.players.get(executedId);
    sendLog(room, `Hasil voting mayoritas: Node ${target.username} akan dieliminasi.`);
    await sleep(2500);
    eliminatePlayer(room, executedId, 'voting siang');
    await sleep(2000);
  } else {
    sendLog(room, 'Hasil voting seri atau tidak ada mayoritas. Tidak ada eliminasi ronde ini.');
    await sleep(2000);
  }

  if (checkWinCondition(room)) return;
  startNight(room);
}

function startNight(room) {
  room.phase = 'night';
  resetNightActions(room);
  room.phaseEndsAt = Date.now() + room.settings.nightDurationSec * 1000;
  sendLog(room, `Malam tiba. Role khusus dapat menggunakan skill.`);
  emitRoomState(room);

  clearPhaseTimer(room);
  room.timer = setTimeout(() => resolveNight(room.code), room.settings.nightDurationSec * 1000);

  simulateBotNightActions(room);
}

function checkNightCompletion(room) {
  if (room.phase !== 'night') return;
  
  // If time is up, resolve immediately regardless of bot completion
  if (Date.now() >= room.phaseEndsAt) {
      resolveNight(room.code);
      return;
  }

  const aliveList = alivePlayers(room);

  // 1. Malware MUST all vote
  const malwares = aliveList.filter(p => p.role === 'malware');
  if (malwares.length > 0 && room.nightActions.malwareVotes.size < malwares.length) return;

  // 2. Analyst MUST scan
  const analysts = aliveList.filter(p => p.role === 'analyst');
  if (analysts.length > 0 && !room.nightActions.analystTarget) return;

  // 3. Defender MUST protect
  const defenders = aliveList.filter(p => p.role === 'defender');
  const defendersActed = defenders.every(p => !!room.nightActions.defenderTarget);
  if (defenders.length > 0 && !defendersActed) return;

  // 4. Logic Bomb MUST pick a target
  const logicbombs = aliveList.filter(p => p.role === 'logicbomb');
  const logicbombsActed = logicbombs.every(p => !!room.nightActions.logicBombTarget);
  if (logicbombs.length > 0 && !logicbombsActed) return;

  // 5. Sysadmin - Wait if they have skills left
  const sysadmins = aliveList.filter(p => p.role === 'sysadmin');
  if (sysadmins.length > 0) {
    const canSave = !room.sysadminUsed.save;
    const canKill = !room.sysadminUsed.kill;
    const usedSaveThisNight = !!room.nightActions.sysadminSaveTarget;
    const usedKillThisNight = !!room.nightActions.sysadminKillTarget;
    if ((canSave && !usedSaveThisNight) || (canKill && !usedKillThisNight)) {
      return;
    }
  }

  resolveNight(room.code);
}

async function resolveNight(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.phase !== 'night') return;

  // Transition to a internal resolving state to prevent duplicate triggers
  room.phase = 'resolving_night';
  clearPhaseTimer(room);
  emitRoomState(room);

  const aliveIds = new Set(alivePlayers(room).map((p) => p.id));
  const malwareTargetId = majorityVote(room.nightActions.malwareVotes, aliveIds);
  const defenderTarget = room.nightActions.defenderTarget;
  const analystTarget = room.nightActions.analystTarget;
  const saveId = room.nightActions.sysadminSaveTarget;
  const killId = room.nightActions.sysadminKillTarget;

  // Process Defender protection internally
  if (defenderTarget && aliveIds.has(defenderTarget)) {
    const defenderProtected = room.players.get(defenderTarget);
    if (defenderProtected) defenderProtected.protected = true;
  }

  // Dramatic sequence helper
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  sendLog(room, "--- SISTEM SEDANG MEMPROSES AKTIVITAS MALAM ---");
  await sleep(2000);

  // 1. Analyst Results (More dramatic and clear)
  if (analystTarget) {
    const target = room.players.get(analystTarget);
    const analysts = aliveByRole(room, 'analyst');
    if (target) {
      const resultText = `[SCAN REPORT] Node: ${target.username} | Status: ${target.role === 'malware' ? '⚠️ MALWARE DETECTED' : '✅ CLEAN'}`;
      for (const analyst of analysts) {
        sendLog(room, resultText, { visibility: 'private', targetSocketId: analyst.id });
        io.to(analyst.id).emit('action:analyst:result', { username: target.username, isMalware: target.role === 'malware' });
      }
      await sleep(2000);
    }
  }

  // 2. Sysadmin System Logs (New feature)
  const sysadmins = aliveByRole(room, 'sysadmin');
  if (sysadmins.length > 0) {
    const logs = [];
    if (malwareTargetId) logs.push("Deteksi aktivitas intrusi ilegal.");
    if (defenderTarget) logs.push("Firewall melakukan shielding pada satu node.");
    if (analystTarget) logs.push("Analyst melakukan sniffing data paket.");
    
    const logSummary = `[SYS LOG] ${logs.length > 0 ? logs.join(' ') : 'Tidak ada aktivitas mencurigakan.'}`;
    for (const sys of sysadmins) {
      sendLog(room, logSummary, { visibility: 'private', targetSocketId: sys.id });
    }
    await sleep(1500);
  }

  // 3. Malware Attack Sequence
  let killedByMalwareId = null;
  if (malwareTargetId) {
    sendLog(room, "Mendeteksi upaya infeksi Malware pada jaringan...");
    await sleep(2500);
    const target = room.players.get(malwareTargetId);
    if (target && target.alive) {
      if (target.protected) {
        sendLog(room, `Firewall berhasil memblokir serangan pada ${target.username}!`);
      } else if (saveId === target.id) {
        sendLog(room, `System Admin melakukan Restore pada ${target.username}. Infeksi digagalkan.`);
      } else {
        killedByMalwareId = target.id;
        sendLog(room, `Node ${target.username} telah terinfeksi.`);
      }
    }
    await sleep(2000);
  }

  // Finalize eliminations
  if (killedByMalwareId) eliminatePlayer(room, killedByMalwareId, 'serangan Malware malam');
  if (killId) eliminatePlayer(room, killId, 'Force Delete oleh System Admin');

  sendLog(room, "Transisi ke mode operasional siang hari...");
  await sleep(1500);

  if (checkWinCondition(room)) return;
  startDiscussion(room);
}

function assignRoles(room) {
  const allPlayers = [...room.players.values()];
  const total = allPlayers.length;

  // 1 Malware for 6-7 players, 2 Malware for 8-12 players
  const malwareCount = (total >= 8) ? 2 : 1;
  const pool = [];
  for (let i = 0; i < malwareCount; i++) pool.push('malware');

  // Distribute other roles evenly
  const others = ['analyst', 'defender', 'logicbomb', 'sysadmin', 'user'];
  let idx = 0;
  while (pool.length < total) {
    pool.push(others[idx % others.length]);
    idx++;
  }

  const shuffledPool = shuffle(pool);
  const playersShuffled = shuffle(allPlayers);

  playersShuffled.forEach((player, idx) => {
    player.role = shuffledPool[idx];
    player.alive = true;
    player.protected = false;
    player.eliminatedRound = null;
  });
}

function sanitizeRoomCode(input) {
  return String(input || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 16);
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 6; i += 1) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function cleanupRoomIfEmpty(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  // Don't close if only bots remain (for testing purposes), wait no, if 0 real players, close it.
  const realPlayersCount = [...room.players.values()].filter(p => !p.isBot).length;
  if (realPlayersCount === 0) {
    clearPhaseTimer(room);
    rooms.delete(roomCode);
    emitPublicLobbyList();
  }
}

// === BOT SIMULATION LOGIC ===

const BOT_CHAT_TEMPLATES = [
  "Hmm, siapa ya pelakunya?",
  "Saya cuma user biasa kok 😅",
  "Ayo voting yang benar!",
  "Agent_{random} agak mencurigakan menurut saya.",
  "Jangan lupa pakai skill kalau ada!",
  "Feeling saya kita menang ronde ini.",
  "Kenapa sepi banget sih?",
  "Tolong jangan serang saya 🛡️",
];

function botRandomPick(aliveIds, excludeId = null) {
  const choices = aliveIds.filter(id => id !== excludeId);
  if (choices.length === 0) return null;
  return choices[Math.floor(Math.random() * choices.length)];
}

function simulateBotLogicBomb(room, botPlayer) {
  if (room.pendingHunterShot !== botPlayer.id) return;
  const aliveIds = alivePlayers(room).map(p => p.id);
  const targetId = botRandomPick(aliveIds, botPlayer.id);
  if (!targetId) return;
  
  room.pendingHunterShot = null;
  const target = room.players.get(targetId);
  eliminatePlayer(room, target.id, `efek Logic Bomb dari ${botPlayer.username}`);
  checkWinCondition(room);
  emitRoomState(room);
}

function simulateBotDayActions(room) {
  const bots = alivePlayers(room).filter(p => p.isBot);
  const aliveIds = alivePlayers(room).map(p => p.id);
  
  bots.forEach((bot, idx) => {
    // Random chat
    if (Math.random() > 0.5) {
      setTimeout(() => {
        if (!['discussion', 'voting'].includes(room.phase) || !bot.alive) return;
        let text = BOT_CHAT_TEMPLATES[Math.floor(Math.random() * BOT_CHAT_TEMPLATES.length)];
        const randomTarget = botRandomPick(aliveIds, bot.id);
        if (randomTarget) {
          const tName = room.players.get(randomTarget).username;
          text = text.replace('{random}', tName.replace('Agent_', ''));
        }
        io.to(room.code).emit('chat:new', {
          from: bot.username,
          text: text,
          at: new Date().toISOString(),
        });
      }, (Math.random() * 5000) + 2000 + (idx * 1000));
    }

    // Voting
    setTimeout(() => {
      if (room.phase !== 'voting' || !bot.alive) return;
      const targetId = botRandomPick(aliveIds, bot.id);
      if (targetId) {
        room.dayVotes.set(bot.id, targetId);
        sendLog(room, `${bot.username} telah memasukkan voting.`);
        emitRoomState(room);
        checkVotingCompletion(room);
      }
    }, (Math.random() * 8000) + 5000);
  });
}

function simulateBotNightActions(room) {
  const bots = alivePlayers(room).filter(p => p.isBot);
  const aliveList = alivePlayers(room);
  const aliveIds = aliveList.map(p => p.id);
  
  bots.forEach(bot => {
    setTimeout(() => {
      if (room.phase !== 'night' || !bot.alive) return;
      
      if (bot.role === 'malware') {
        const nonMalwareIds = aliveList.filter(p => p.role !== 'malware').map(p => p.id);
        const targetId = botRandomPick(nonMalwareIds.length > 0 ? nonMalwareIds : aliveIds, bot.id);
        if (targetId) room.nightActions.malwareVotes.set(bot.id, targetId);
      } 
      else if (bot.role === 'analyst') {
        const targetId = botRandomPick(aliveIds, bot.id);
        if (targetId) room.nightActions.analystTarget = targetId;
      }
      else if (bot.role === 'defender') {
        const targetId = botRandomPick(aliveIds); // can protect themselves
        if (targetId) room.nightActions.defenderTarget = targetId;
      }
      else if (bot.role === 'logicbomb') {
        const targetId = botRandomPick(aliveIds, bot.id);
        if (targetId) {
          room.nightActions.logicBombTarget = targetId;
          console.log(`[Bot] Logic Bomb ${bot.username} set target to ${targetId}`);
        }
      }
      else if (bot.role === 'sysadmin') {
        // 50% chance to use Restore on a random ally (save skill - helpful)
        if (!room.sysadminUsed.save && Math.random() > 0.5) {
          const targetId = botRandomPick(aliveIds);
          if (targetId) {
            room.nightActions.sysadminSaveTarget = targetId;
            room.sysadminUsed.save = true;
          }
        }
        // Sysadmin bots do NOT use Force Delete - too disruptive for game balance
      }

      checkNightCompletion(room);
    }, (Math.random() * 4000) + 2000);
  });
}

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  socket.emit('lobby:list', getPublicLobbies());

  socket.on('room:create', ({ username, visibility, settings }) => {
    const cleanName = String(username || '').trim().slice(0, 20);
    if (!cleanName) {
      socket.emit('error:message', 'Nama agent wajib diisi.');
      return;
    }

    const roomCode = generateRoomCode();
    const room = createRoom(roomCode);
    
    if (settings) {
      room.settings = normalizeRoomSettings(settings);
    } else {
      room.settings.visibility = String(visibility || 'public') === 'private' ? 'private' : 'public';
    }
    rooms.set(roomCode, room);

    const isFirst = room.players.size === 0;
    room.players.set(socket.id, {
      id: socket.id,
      socketId: socket.id,
      username: cleanName,
      isCreator: isFirst,
      role: 'user',
      alive: true,
      protected: false,
      eliminatedRound: null,
    });

    socket.data.roomCode = roomCode;
    socket.join(roomCode);

    sendLog(room, `${cleanName} membuat room ${roomCode}.`);
    socket.emit('room:created', { roomCode });
    emitRoomState(room);
    emitPublicLobbyList();
  });

  socket.on('room:join', ({ username, roomCode }) => {
    const cleanName = String(username || '').trim().slice(0, 20);
    const cleanRoomCode = sanitizeRoomCode(roomCode || '');

    if (!cleanName || !cleanRoomCode) {
      socket.emit('error:message', 'Username dan room code wajib diisi.');
      return;
    }

    const room = rooms.get(cleanRoomCode);
    if (!room) {
      socket.emit('error:message', 'Room tidak ditemukan. Minta token room dari pembuat room.');
      return;
    }

    if (room.started && room.phase !== 'ended') {
      socket.emit('error:message', 'Game sedang berjalan. Room terkunci.');
      return;
    }

    if (room.players.size >= room.settings.maxPlayers) {
      socket.emit('error:message', `Room penuh (maksimal ${room.settings.maxPlayers} pemain).`);
      return;
    }

    const duplicateName = [...room.players.values()].some((p) => p.username.toLowerCase() === cleanName.toLowerCase());
    if (duplicateName) {
      socket.emit('error:message', 'Username sudah dipakai di room ini.');
      return;
    }

    room.players.set(socket.id, {
      id: socket.id,
      username: cleanName,
      isCreator: false,
      role: 'user',
      alive: true,
      protected: false,
      eliminatedRound: null,
    });

    socket.data.roomCode = cleanRoomCode;
    socket.join(cleanRoomCode);

    sendLog(room, `${cleanName} bergabung ke room ${cleanRoomCode}.`);
    emitRoomState(room);
    emitPublicLobbyList();
  });

  socket.on('room:addBot', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    const me = room.players.get(socket.id);
    if (!me || !me.isCreator) {
      socket.emit('error:message', 'Hanya pembuat room yang bisa menambah bot.');
      return;
    }

    if (room.started && room.phase !== 'ended') {
      socket.emit('error:message', 'Game sedang berjalan. Tidak bisa tambah bot.');
      return;
    }

    if (room.players.size >= room.settings.maxPlayers) {
      socket.emit('error:message', `Room penuh (maksimal ${room.settings.maxPlayers} pemain). Tidak bisa menambah bot.`);
      return;
    }

    const botNames = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Echo', 'Zeta', 'Sigma', 'Omega', 'Neo', 'Trinity'];
    const usedNames = new Set([...room.players.values()].map(p => p.username));
    
    let botName = 'Agent_X';
    for (const name of botNames) {
      const candidate = `Agent_${name}`;
      if (!usedNames.has(candidate)) {
        botName = candidate;
        break;
      }
    }
    
    if (usedNames.has(botName)) botName = `Agent_${Math.floor(Math.random() * 9999)}`;

    const botId = `bot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    room.players.set(botId, {
      id: botId,
      username: botName,
      isCreator: false,
      role: 'user',
      alive: true,
      protected: false,
      eliminatedRound: null,
      isBot: true
    });

    sendLog(room, `${botName} (Bot) ditambahkan ke room.`);
    emitRoomState(room);
    emitPublicLobbyList();
  });

  socket.on('game:start', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    const me = room.players.get(socket.id);
    if (!me || !me.isCreator) {
      socket.emit('error:message', 'Hanya pembuat room yang bisa memulai game.');
      return;
    }

    if (room.players.size < CONFIG.minPlayers) {
      socket.emit('error:message', `Minimal ${CONFIG.minPlayers} pemain untuk memulai.`);
      return;
    }

    room.started = true;
    room.phase = 'starting';
    room.round = 0;
    room.logs = [];
    room.sysadminUsed = { save: false, kill: false };
    room.pendingHunterShot = null;

    assignRoles(room);
    sendLog(room, 'Game Cyberwolf dimulai. Role telah dibagikan secara rahasia.');
    for (const p of room.players.values()) {
      sendLog(room, `Role kamu: ${ROLE_LABEL[p.role]}. ${ROLE_DESC[p.role]}`, {
        visibility: 'private',
        targetSocketId: p.id,
      });
    }
    emitRoomState(room);
    startNight(room);
    emitPublicLobbyList();
  });

  socket.on('game:updateSettings', (payload) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    const me = room.players.get(socket.id);
    if (!me || !me.isCreator) {
      socket.emit('error:message', 'Hanya pembuat room yang bisa mengubah setting game.');
      return;
    }
    if (room.started && room.phase !== 'ended') {
      socket.emit('error:message', 'Game sedang berjalan. Setting tidak bisa diubah.');
      return;
    }

    const nextSettings = normalizeRoomSettings(payload || {});
    const referencePlayerCount = Math.max(room.players.size || 0, CONFIG.minPlayers);
    const roleConfigError = validateRoleConfig(nextSettings, referencePlayerCount);
    if (roleConfigError) {
      socket.emit('error:message', roleConfigError);
      return;
    }

    room.settings = nextSettings;
    sendLog(
      room,
      `${me.username} mengubah setting game: akses ${room.settings.visibility}, durasi siang ${Math.floor(
        room.settings.dayDurationSec / 60
      )} menit, role dikustomisasi.`
    );
    emitRoomState(room);
    emitPublicLobbyList();
  });

  socket.on('room:leave', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) {
      socket.emit('room:left', { message: 'Kamu tidak sedang berada di lobby mana pun.' });
      return;
    }
    const room = rooms.get(roomCode);
    if (!room) {
      socket.data.roomCode = null;
      socket.emit('room:left', { message: 'Lobby sudah tidak tersedia.' });
      return;
    }

    const leaving = room.players.get(socket.id);
    if (!leaving) return;

    if (room.phase !== 'lobby') {
      socket.emit('error:message', 'Tombol keluar hanya tersedia saat fase lobby.');
      return;
    }

    room.players.delete(socket.id);
    socket.leave(roomCode);
    socket.data.roomCode = null;
    socket.emit('room:left', { message: 'Kamu keluar dari lobby.' });

    if (room.players.size > 0 && leaving.isCreator) {
      const nextCreator = room.players.values().next().value;
      nextCreator.isCreator = true;
      sendLog(room, `${nextCreator.username} menjadi pembuat room baru.`);
    }

    sendLog(room, `${leaving.username} keluar dari room.`);
    emitRoomState(room);
    cleanupRoomIfEmpty(roomCode);
    emitPublicLobbyList();
  });

  socket.on('room:dissolve', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    const me = room.players.get(socket.id);
    if (!me || !me.isCreator) {
      socket.emit('error:message', 'Hanya host yang bisa membubarkan lobby.');
      return;
    }
    if (room.phase !== 'lobby') {
      socket.emit('error:message', 'Lobby hanya bisa dibubarkan saat fase lobby.');
      return;
    }

    clearPhaseTimer(room);
    const memberIds = [...room.players.keys()];
    for (const memberId of memberIds) {
      const memberSocket = io.sockets.sockets.get(memberId);
      if (memberSocket) {
        memberSocket.leave(roomCode);
        memberSocket.data.roomCode = null;
        memberSocket.emit('room:dissolved', { message: `Lobby ${roomCode} dibubarkan oleh host.` });
      }
    }

    rooms.delete(roomCode);
    emitPublicLobbyList();
  });

  socket.on('room:kick', ({ targetId }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    const me = room.players.get(socket.id);
    if (!me || !me.isCreator) {
      socket.emit('error:message', 'Hanya host yang bisa nge-kick pemain.');
      return;
    }
    if (room.phase !== 'lobby') {
      socket.emit('error:message', 'Pemain hanya bisa di-kick saat fase lobby.');
      return;
    }

    const target = room.players.get(targetId);
    if (!target) return;
    if (target.id === me.id) {
      socket.emit('error:message', 'Kamu tidak bisa nge-kick diri sendiri.');
      return;
    }

    room.players.delete(targetId);

    // If target is real player, leave socket room and notify them
    if (!target.isBot) {
      const targetSocket = io.sockets.sockets.get(targetId);
      if (targetSocket) {
        targetSocket.leave(roomCode);
        targetSocket.data.roomCode = null;
        targetSocket.emit('room:kicked', { message: 'Kamu telah di-kick dari room oleh host.' });
      }
    }

    sendLog(room, `${target.username} dikeluarkan dari room oleh host.`);
    emitRoomState(room);
    emitPublicLobbyList();
  });

  socket.on('chat:send', ({ text }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    const me = room.players.get(socket.id);
    if (!me) return;

    const message = String(text || '').trim().slice(0, 240);
    if (!message) return;

    if (!me.alive && room.phase !== 'ended') {
      socket.emit('error:message', 'Player yang tereliminasi tidak bisa chat saat game berjalan.');
      return;
    }

    io.to(roomCode).emit('chat:new', {
      from: me.username,
      text: message,
      at: new Date().toISOString(),
    });
  });

  socket.on('vote:day', ({ targetId }) => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'voting') return;

    const me = room.players.get(socket.id);
    const target = room.players.get(targetId);
    if (!me || !me.alive) return;
    if (!target || !target.alive) return;

    room.dayVotes.set(me.id, target.id);
    sendLog(room, `${me.username} telah memasukkan voting.`);
    emitRoomState(room);
    checkVotingCompletion(room);
  });

  socket.on('action:night', ({ action, targetId }) => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'night') return;

    const me = room.players.get(socket.id);
    if (!me || !me.alive) return;

    const target = room.players.get(targetId);
    if (!target || !target.alive) return;

    if (action === 'malware:infect' && me.role === 'malware') {
      room.nightActions.malwareVotes.set(me.id, target.id);
      sendLog(room, `${me.username} memilih target infeksi.`, { visibility: 'private', targetSocketId: me.id });
    }

    if (action === 'analyst:scan' && me.role === 'analyst') {
      room.nightActions.analystTarget = target.id;
      sendLog(room, `${me.username} memilih target scanning.`, { visibility: 'private', targetSocketId: me.id });
    }

    if (action === 'defender:protect' && me.role === 'defender') {
      room.nightActions.defenderTarget = target.id;
      sendLog(room, `${me.username} memilih target protection.`, { visibility: 'private', targetSocketId: me.id });
    }

    if (action === 'sysadmin:save' && me.role === 'sysadmin' && !room.sysadminUsed.save) {
      room.nightActions.sysadminSaveTarget = target.id;
      room.sysadminUsed.save = true;
      sendLog(room, `${me.username} menyiapkan Restore.`, { visibility: 'private', targetSocketId: me.id });
    }

    if (action === 'sysadmin:kill' && me.role === 'sysadmin' && !room.sysadminUsed.kill) {
      room.nightActions.sysadminKillTarget = target.id;
      room.sysadminUsed.kill = true;
      sendLog(room, `${me.username} menyiapkan Force Delete.`, { visibility: 'private', targetSocketId: me.id });
    }

    if (action === 'logicbomb:target' && me.role === 'logicbomb') {
      room.nightActions.logicBombTarget = target.id;
      sendLog(room, `Target bom dikunci pada ${target.username}.`, { visibility: 'private', targetSocketId: me.id });
    }

    emitRoomState(room);
    checkNightCompletion(room);
  });

  socket.on('action:logicbomb:shot', ({ targetId }) => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);
    if (!room) return;

    if (room.pendingHunterShot !== socket.id) return;
    const me = room.players.get(socket.id);
    if (!me || me.role !== 'logicbomb') return;

    const target = room.players.get(targetId);
    if (!target || !target.alive) return;

    room.pendingHunterShot = null;
    
    // Add delay for Logic Bomb effect
    sendLog(room, `Logic Bomb ${me.username} sedang menargetkan sistem balik...`);
    setTimeout(() => {
      eliminatePlayer(room, target.id, `efek Logic Bomb dari ${me.username}`);
      checkWinCondition(room);
      emitRoomState(room);
    }, 2500);
  });

  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    const leaving = room.players.get(socket.id);
    if (!leaving) return;

    room.players.delete(socket.id);

    if (room.players.size > 0 && leaving.isCreator) {
      const nextCreator = room.players.values().next().value;
      nextCreator.isCreator = true;
      sendLog(room, `${nextCreator.username} menjadi pembuat room baru.`);
    }

    sendLog(room, `${leaving.username} keluar dari room.`);
    emitRoomState(room);
    cleanupRoomIfEmpty(roomCode);
    emitPublicLobbyList();
  });
});

// --- REST API: Game History ---
app.get('/api/history', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('game_history')
      .select('*')
      .order('ended_at', { ascending: false })
      .limit(20);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Cyberwolf server running at http://0.0.0.0:${PORT}`);
});
