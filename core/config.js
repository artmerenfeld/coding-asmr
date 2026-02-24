// config.js - Configuration loader with defaults

const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  enabled: true,
  volume: 70, // 0-100
  soundsDir: null, // resolved at runtime
  sounds: {
    'session-start':     { enabled: true },
    'session-end':       { enabled: true },
    'write-start':       { enabled: true },
    'write-complete':    { enabled: true },
    'bash-start':        { enabled: true },
    'bash-complete':     { enabled: true },
    'read-start':        { enabled: true },
    'read-complete':     { enabled: true },
    'search-start':      { enabled: true },
    'search-complete':   { enabled: true },
    'error':             { enabled: true },
    'complete':          { enabled: true },
    'notification':      { enabled: true },
    'subagent-spawn':    { enabled: true },
    'subagent-complete': { enabled: true },
    'compact':           { enabled: true },
  },
};

function loadConfig(rootDir) {
  const configPath = path.join(rootDir, 'config.json');
  let userConfig = {};
  try {
    userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    // No config file or invalid JSON - use defaults
  }

  const merged = {
    ...DEFAULT_CONFIG,
    ...userConfig,
    sounds: { ...DEFAULT_CONFIG.sounds, ...(userConfig.sounds || {}) },
  };

  // Resolve sounds directory
  if (!merged.soundsDir) {
    merged.soundsDir = path.join(rootDir, 'sounds');
  }

  return merged;
}

module.exports = { loadConfig, DEFAULT_CONFIG };
