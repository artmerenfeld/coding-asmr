// index.js - Public API for the coding-asmr core engine

const fs = require('fs');
const path = require('path');
const synth = require('./synth');
const { SOUNDS } = require('./sounds');
const { play } = require('./player');
const { loadConfig } = require('./config');

const ROOT_DIR = path.resolve(__dirname, '..');

function getConfig(rootDir) {
  return loadConfig(rootDir || ROOT_DIR);
}

/**
 * Play a named sound effect.
 * @param {string} name - Sound name (e.g. 'write-start', 'error', 'complete')
 * @param {object} [opts] - Optional overrides
 * @param {string} [opts.rootDir] - Root directory of coding-asmr (for config/sounds lookup)
 */
function playSound(name, opts = {}) {
  const rootDir = opts.rootDir || ROOT_DIR;
  const config = getConfig(rootDir);

  if (!config.enabled) return;
  if (config.sounds[name] && config.sounds[name].enabled === false) return;

  const wavPath = path.join(config.soundsDir, `${name}.wav`);

  try {
    fs.accessSync(wavPath);
  } catch {
    // WAV file doesn't exist (not generated yet), skip silently
    return;
  }

  play(wavPath, opts.volume != null ? opts.volume : config.volume);
}

/**
 * List all available sound names.
 * @returns {string[]}
 */
function listSounds() {
  return Object.keys(SOUNDS);
}

/**
 * Get metadata for a sound.
 * @param {string} name
 * @returns {{ name: string, description: string } | undefined}
 */
function getSoundInfo(name) {
  const def = SOUNDS[name];
  if (!def) return undefined;
  return { name: def.name, description: def.description };
}

/**
 * Generate all WAV files into the target directory.
 * @param {string} [outputDir] - Directory to write WAVs to (defaults to sounds/)
 */
function generateAll(outputDir) {
  const dir = outputDir || path.join(ROOT_DIR, 'sounds');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const results = [];
  for (const [name, def] of Object.entries(SOUNDS)) {
    const samples = def.recipe(synth);
    const wavBuffer = synth.createWavBuffer(samples);
    const outputPath = path.join(dir, `${name}.wav`);
    fs.writeFileSync(outputPath, wavBuffer);
    results.push({ name, path: outputPath, bytes: wavBuffer.length });
  }
  return results;
}

module.exports = { playSound, listSounds, getSoundInfo, generateAll };
