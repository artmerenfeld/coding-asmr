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

// Default sounds (used when no preset is active or as fallback)
const DEFAULT_SOUNDS = {
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

// Load active preset (returns null if none set)
function loadPreset(config) {
  if (!config.preset) return null;
  const presetPath = path.join(rootDir, 'presets', config.preset + '.json');
  try { return JSON.parse(fs.readFileSync(presetPath, 'utf-8')); }
  catch { return null; }
}

// Resolve sound definition: preset overrides > defaults
function resolveSoundDef(soundName, preset) {
  const base = DEFAULT_SOUNDS[soundName];
  if (preset && preset.sounds && preset.sounds[soundName]) {
    return { ...base, ...preset.sounds[soundName] };
  }
  return base;
}

// Resolve the directory to find sound files in
function resolveSoundDir(def, preset, config) {
  if (preset && config.preset) {
    const presetDir = path.join(rootDir, 'sounds', config.preset);
    // For files array, check if first file exists in preset dir
    if (def.files) {
      const testFile = path.join(presetDir, def.files[0]);
      try { fs.accessSync(testFile); return presetDir; } catch {}
    }
    // For prefix+count, check prefix1.wav
    if (def.prefix) {
      const testFile = path.join(presetDir, `${def.prefix}1.wav`);
      try { fs.accessSync(testFile); return presetDir; } catch {}
    }
  }
  return path.join(rootDir, 'sounds', 'handmade');
}

// Pick a random file from a sound definition (supports files array or prefix+count)
function pickFile(def, lastFile) {
  if (def.files) {
    // Files array: pick random, avoid repeating last
    const pool = def.files.length > 1 && lastFile
      ? def.files.filter(f => f !== lastFile)
      : def.files;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  // Prefix+count: existing behavior
  const { prefix, count } = def;
  if (count > 1 && lastFile) {
    const lastN = parseInt(lastFile.replace(prefix, '').replace('.wav', ''));
    const all = Array.from({ length: count }, (_, i) => i + 1);
    const pool = all.filter(i => i !== lastN);
    return `${prefix}${pool[Math.floor(Math.random() * pool.length)]}.wav`;
  }
  return `${prefix}${Math.floor(Math.random() * count) + 1}.wav`;
}

// Play a random variant from a sound definition
function playVariant(def, soundDir, vol) {
  const cooldowns = readCooldowns();
  const last = cooldowns[soundName];
  const elapsed = last ? Date.now() - last.time : Infinity;

  if (elapsed < HARD_COOLDOWN) return false;

  const lastFile = (elapsed < VARIANT_COOLDOWN && last.file) ? last.file : null;
  const file = pickFile(def, lastFile);

  const wavPath = path.join(soundDir, file);
  try { fs.accessSync(wavPath); } catch { return false; }

  writeCooldown(soundName, file);
  play(wavPath, vol);
  return true;
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

// Load preset
const preset = loadPreset(config);

// Random variant sounds (handmade or preset)
const def = resolveSoundDef(soundName, preset);
if (def) {
  // Random chance — skip if roll fails
  if (def.chance != null && def.chance < 1 && Math.random() >= def.chance) {
    // For thinking-random, still try extras even if base roll fails
    if (soundName === 'thinking-random' && preset && preset.extras && preset.extras.length > 0) {
      const extrasDir = path.join(rootDir, 'sounds', config.preset || 'handmade');
      for (const extra of preset.extras) {
        if (Math.random() < (extra.chance || 0)) {
          const vol = extra.volumeScale ? Math.round(volume * extra.volumeScale) : volume;
          const file = pickFile(extra, null);
          const wavPath = path.join(extrasDir, file);
          try { fs.accessSync(wavPath); } catch { continue; }
          play(wavPath, vol);
          process.exit(0);
        }
      }
    }
    process.exit(0);
  }

  const soundDir = resolveSoundDir(def, preset, config);
  const vol = def.volumeScale ? Math.round(volume * def.volumeScale) : volume;
  playVariant(def, soundDir, vol);
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
