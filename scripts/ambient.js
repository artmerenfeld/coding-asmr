#!/usr/bin/env node
// ambient.js - Manages looping background sounds (typing clicks, read scanning)
// Usage:
//   node ambient.js start <sound-name>   → starts looping sound, kills any existing loop
//   node ambient.js stop                 → stops current loop

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PID_FILE = path.join(os.tmpdir(), 'coding-asmr-ambient.pid');
const LOCK_FILE = PID_FILE + '.lock';
const ROOT_DIR = path.resolve(__dirname, '..');
const MIN_PLAY_DURATION = 300; // 0.3s - don't replace a loop younger than this

// Default loop sounds (used when no preset is active or as fallback)
const DEFAULT_LOOPS = {
  'typing-loop': {
    file: 'sounds/handmade/typing.wav',
    maxOffset: 27, // 30s file, leave 3s buffer
  },
  'readloop': {
    files: ['sounds/handmade/readloop1.wav', 'sounds/handmade/readloop2.wav'],
    maxOffset: 7, // 10s files, leave 3s buffer
  },
};

// Load active preset (returns null if none set)
function loadPreset(config) {
  if (!config.preset) return null;
  const presetPath = path.join(ROOT_DIR, 'presets', config.preset + '.json');
  try { return JSON.parse(fs.readFileSync(presetPath, 'utf-8')); }
  catch { return null; }
}

// Resolve loop definition: preset overrides > defaults
function resolveLoop(soundName, preset) {
  const base = DEFAULT_LOOPS[soundName];
  if (preset && preset.loops && preset.loops[soundName]) {
    return { ...base, ...preset.loops[soundName] };
  }
  return base;
}

// --- Lock to prevent race conditions when parallel hooks fire ---
function acquireLock() {
  for (let i = 0; i < 20; i++) {
    try {
      fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: 'wx' });
      return true;
    } catch {
      // Check if lock holder is dead (stale lock)
      try {
        const lockPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf-8'));
        if (!isAlive(lockPid)) {
          try { fs.unlinkSync(LOCK_FILE); } catch {}
          continue; // retry immediately
        }
      } catch {}
      // Busy wait 50ms
      const end = Date.now() + 50;
      while (Date.now() < end) {}
    }
  }
  // Couldn't acquire after 1s, force remove stale lock and proceed
  try { fs.unlinkSync(LOCK_FILE); } catch {}
  return false;
}

function releaseLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch {}
}

// --- PID tracking ---
function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function readPid() {
  try {
    const raw = fs.readFileSync(PID_FILE, 'utf-8');
    if (raw.startsWith('{')) return JSON.parse(raw);
    return { pid: parseInt(raw), time: 0 };
  } catch { return null; }
}

function writePid(pid) {
  try { fs.writeFileSync(PID_FILE, JSON.stringify({ pid, time: Date.now() })); } catch {}
}

function killPid(data) {
  if (!data || !data.pid) return;
  if (!isAlive(data.pid)) return;
  try { process.kill(data.pid); } catch {}
  // Force kill if still alive
  if (isAlive(data.pid)) {
    try { process.kill(data.pid, 'SIGKILL'); } catch {}
  }
}

// Kill ALL ffplay/afplay processes playing our sound files
function killOrphans() {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      // taskkill is reliable on all Windows versions (wmic is deprecated on Win11)
      execSync('taskkill /IM ffplay.exe /F 2>NUL', { encoding: 'utf-8', timeout: 3000 });
    } else if (platform === 'darwin') {
      // Kill afplay processes playing our sounds
      const soundsDir = path.join(ROOT_DIR, 'sounds');
      execSync(`pkill -f "afplay.*${soundsDir}" 2>/dev/null`, { timeout: 3000 });
    } else {
      // Linux: kill paplay/aplay/ffplay playing our sounds
      const soundsDir = path.join(ROOT_DIR, 'sounds');
      execSync(`pkill -f "paplay.*${soundsDir}" 2>/dev/null; pkill -f "aplay.*${soundsDir}" 2>/dev/null; pkill -f "ffplay.*${soundsDir}" 2>/dev/null`, { timeout: 3000 });
    }
  } catch {}
}

// --- Main operations ---
function stopLoop() {
  acquireLock();
  try {
    killPid(readPid());
    try { fs.unlinkSync(PID_FILE); } catch {}
    // Safety net: kill any orphaned ffplay playing our sounds
    killOrphans();
  } finally {
    releaseLock();
  }
}

function startLoop(soundName) {
  acquireLock();
  try {
    // Don't replace a loop that just started (gives it time to be heard)
    const current = readPid();
    if (current && current.pid && isAlive(current.pid)) {
      const age = Date.now() - (current.time || 0);
      if (age < MIN_PLAY_DURATION) return;
    }

    // Kill any existing loop
    killPid(current);
    try { fs.unlinkSync(PID_FILE); } catch {}

    // Check config
    let config;
    try {
      config = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'config.json'), 'utf-8'));
    } catch {
      config = { enabled: true };
    }
    if (!config.enabled) return;
    if (config.sounds && config.sounds[soundName] && config.sounds[soundName].enabled === false) return;

    const preset = loadPreset(config);
    const loopDef = resolveLoop(soundName, preset);
    if (!loopDef) return;

    // Resolve the WAV file path
    let wavPath;
    if (loopDef.files) {
      const pick = loopDef.files[Math.floor(Math.random() * loopDef.files.length)];
      wavPath = path.join(ROOT_DIR, pick);
    } else {
      wavPath = path.join(ROOT_DIR, loopDef.file);
    }

    try { fs.accessSync(wavPath); } catch { return; }

    // Build ffplay args with volume and optional random start offset
    const vol = config.volume != null ? config.volume : 70;
    const args = ['-nodisp', '-loop', '0', '-loglevel', 'quiet', '-volume', String(vol)];
    if (loopDef.maxOffset > 0) {
      const offset = Math.floor(Math.random() * loopDef.maxOffset);
      args.push('-ss', String(offset));
    }
    // Smooth fade-in for readloop
    if (soundName === 'readloop') {
      args.push('-af', 'afade=t=in:d=0.1');
    }
    args.push(wavPath);

    const child = spawn('ffplay', args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });

    writePid(child.pid);
    child.unref();
  } finally {
    releaseLock();
  }
}

const action = process.argv[2];
const soundName = process.argv[3];

if (action === 'stop') {
  stopLoop();
} else if (action === 'start' && soundName) {
  startLoop(soundName);
}
