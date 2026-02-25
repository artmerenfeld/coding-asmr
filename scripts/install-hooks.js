#!/usr/bin/env node
// install-hooks.js - Install coding-asmr hooks into .claude/settings.json

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Check ffplay is available
try {
  execSync('ffplay -version', { stdio: 'ignore' });
} catch {
  console.error('ERROR: ffplay not found. Install FFmpeg first:');
  console.error('  Windows: winget install FFmpeg');
  console.error('  macOS:   brew install ffmpeg');
  console.error('  Linux:   apt install ffmpeg');
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, '..');
const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');

const handlerPath = path.join(projectRoot, 'handler.js').replace(/\\/g, '/');
const ambientPath = path.join(projectRoot, 'scripts', 'ambient.js').replace(/\\/g, '/');

function makeHook(soundName) {
  return {
    type: 'command',
    command: `node "${handlerPath}" ${soundName}`,
    async: true,
    timeout: 10,
  };
}

function makeAmbientHook(action, soundName) {
  const args = soundName ? `${action} ${soundName}` : action;
  return {
    type: 'command',
    command: `node "${ambientPath}" ${args}`,
    async: true,
    timeout: 10,
  };
}

const soundHooks = {
  SessionStart: [
    { hooks: [makeHook('session-start')] },
  ],
  UserPromptSubmit: [
    { hooks: [makeHook('thinking')] },
  ],
  PreToolUse: [
    { hooks: [makeHook('click')] },
    { matcher: 'AskUserQuestion', hooks: [makeHook('question')] },
    { matcher: 'Read|Grep|Glob', hooks: [makeAmbientHook('start', 'readloop')] },
    { matcher: 'Write|Edit|Bash', hooks: [makeAmbientHook('start', 'typing-loop')] },
  ],
  PostToolUse: [
    { hooks: [makeHook('click')] },
    { matcher: 'Write|Edit|Bash', hooks: [makeAmbientHook('start', 'typing-loop')] },
    { matcher: 'TodoWrite', hooks: [makeHook('check')] },
  ],
  PostToolUseFailure: [
    { hooks: [makeHook('error'), makeAmbientHook('start', 'typing-loop')] },
  ],
  Stop: [
    { hooks: [makeAmbientHook('stop')] },
    { hooks: [makeHook('check')] },
  ],
  Notification: [
    { hooks: [makeHook('notification')] },
  ],
  PreCompact: [
    { hooks: [makeAmbientHook('stop'), makeHook('click'), makeHook('compact')] },
  ],
};

// Check if a hook entry belongs to coding-asmr
function isOurHook(entry) {
  const cmds = (entry.hooks || []).map(h => h.command || '').join(' ');
  return cmds.includes('handler.js') || cmds.includes('ambient.js');
}

// Load existing settings (preserve permissions and other plugins' hooks)
let settings = {};
try {
  settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
} catch {}

// Merge hooks: remove old coding-asmr hooks, then append new ones
if (!settings.hooks) settings.hooks = {};
for (const [event, entries] of Object.entries(soundHooks)) {
  if (!settings.hooks[event]) {
    settings.hooks[event] = entries;
  } else {
    // Remove any existing coding-asmr hooks (allows clean re-install)
    settings.hooks[event] = settings.hooks[event].filter(e => !isOurHook(e));
    settings.hooks[event].push(...entries);
  }
}

fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

console.log(`Coding ASMR hooks installed into ${settingsPath}`);
console.log(`Handler:  ${handlerPath}`);
console.log(`Ambient:  ${ambientPath}`);
console.log('\nHook flow:');
console.log('  SessionStart      → spacebar thunk');
console.log('  PreToolUse        → click + readloop (Read/Grep/Glob) or typing (Write/Edit/Bash)');
console.log('  PostToolUse       → click + typing');
console.log('  Stop              → check jingle');
console.log('\nRestart your Claude Code session for hooks to take effect.');
console.log('To uninstall: npm run uninstall');
