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

// Map sound names to file paths and random offset ranges
const LOOP_SOUNDS = {
  'typing-loop': {
    file: 'sounds/handmade/typing.wav',
    maxOffset: 27, // 30s file, leave 3s buffer
  },
  'readloop': {
    files: ['sounds/handmade/readloop1.wav', 'sounds/handmade/readloop2.wav'],
    maxOffset: 7, // 10s files, leave 3s buffer
  },
};

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

// Kill any orphaned ffplay processes playing our sound files
function killOrphans() {
  if (os.platform() !== 'win32') return;
  try {
    // Find ffplay processes whose command line contains our sounds directory
    const soundsDir = path.join(ROOT_DIR, 'sounds').replace(/\\/g, '\\\\');
    const cmd = `wmic process where "name='ffplay.exe' and commandline like '%${soundsDir}%'" get processid /format:list 2>NUL`;
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 3000 });
    const pids = output.match(/ProcessId=(\d+)/g);
    if (pids) {
      for (const match of pids) {
        const pid = parseInt(match.split('=')[1]);
        try { process.kill(pid); } catch {}
      }
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
    // Kill any existing loop first
    killPid(readPid());
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

    const loopDef = LOOP_SOUNDS[soundName];
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
