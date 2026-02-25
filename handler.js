#!/usr/bin/env node
// handler.js - Central hook handler for coding-asmr
// Called by Claude Code hooks with a sound name as argv[1]

const path = require('path');
const fs = require('fs');
const os = require('os');

const soundName = process.argv[2];
if (!soundName) process.exit(0);

const rootDir = __dirname;
const { play } = require(path.join(rootDir, 'core', 'player'));

// Sounds with multiple random variants in sounds/handmade/
const RANDOM_SOUNDS = {
  click: { prefix: 'click', count: 6 },
  check: { prefix: 'check', count: 3 },
  'session-start': { prefix: 'spacebar', count: 2 },
  thinking: { prefix: 'thinking', count: 17, volumeScale: 0.3, chance: 1.0 },
  'thinking-random': { prefix: 'thinking', count: 17, volumeScale: 0.3, chance: 0.07 },
  question: { prefix: 'question', count: 13, volumeScale: 0.3, chance: 0.7 },
};

// Cooldown: prevent spammy rapid-fire sounds
const COOLDOWN_FILE = path.join(os.tmpdir(), 'coding-asmr-cooldown.json');
const HARD_COOLDOWN = 500;     // 0.5s - skip entirely, too spammy
const VARIANT_COOLDOWN = 1000; // 1s - play different variant to avoid repetition

function readCooldowns() {
  try { return JSON.parse(fs.readFileSync(COOLDOWN_FILE, 'utf-8')); }
  catch { return {}; }
}

function writeCooldown(name, file) {
  const cd = readCooldowns();
  cd[name] = { time: Date.now(), file: file || null };
  try { fs.writeFileSync(COOLDOWN_FILE, JSON.stringify(cd)); } catch {}
}

// Check config
let config;
try {
  config = JSON.parse(fs.readFileSync(path.join(rootDir, 'config.json'), 'utf-8'));
} catch {
  config = { enabled: true, sounds: {}, volume: 70 };
}
const volume = config.volume != null ? config.volume : 70;
if (!config.enabled) process.exit(0);
// Check per-sound config (thinking-random uses the "thinking" toggle)
const configKey = soundName === 'thinking-random' ? 'thinking' : soundName;
if (config.sounds && config.sounds[configKey] && config.sounds[configKey].enabled === false) process.exit(0);

// Random variant sounds (handmade)
if (RANDOM_SOUNDS[soundName]) {
  const def = RANDOM_SOUNDS[soundName];
  const { prefix, count } = def;

  // Random chance — skip if roll fails
  if (def.chance != null && def.chance < 1 && Math.random() >= def.chance) process.exit(0);

  const cooldowns = readCooldowns();
  const last = cooldowns[soundName];
  const elapsed = last ? Date.now() - last.time : Infinity;

  // Hard cooldown: skip entirely
  if (elapsed < HARD_COOLDOWN) process.exit(0);

  // Pick a random variant, respecting variant cooldown
  let n;
  if (elapsed < VARIANT_COOLDOWN && last.file && count > 1) {
    // Exclude the last-played file, pick from remaining
    const all = Array.from({ length: count }, (_, i) => i + 1);
    const lastN = parseInt(last.file.replace(prefix, '').replace('.wav', ''));
    const pool = all.filter(i => i !== lastN);
    n = pool[Math.floor(Math.random() * pool.length)];
  } else {
    n = Math.floor(Math.random() * count) + 1;
  }

  const file = `${prefix}${n}.wav`;
  const wavPath = path.join(rootDir, 'sounds', 'handmade', file);
  try { fs.accessSync(wavPath); } catch { process.exit(0); }

  writeCooldown(soundName, file);
  const vol = def.volumeScale ? Math.round(volume * def.volumeScale) : volume;
  play(wavPath, vol);
  process.exit(0);
}

// Regular synth sounds (sounds/ directory)
const cooldowns = readCooldowns();
const last = cooldowns[soundName];
const elapsed = last ? Date.now() - last.time : Infinity;
if (elapsed < HARD_COOLDOWN) process.exit(0);

writeCooldown(soundName);
const { playSound } = require(path.join(rootDir, 'core'));
playSound(soundName, { rootDir, volume });
