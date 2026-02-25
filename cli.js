#!/usr/bin/env node
// cli.js - Control panel for Coding ASMR
// Usage:
//   node cli.js on              → enable all sounds
//   node cli.js off             → disable all sounds + stop loops
//   node cli.js volume <0-100>  → set volume
//   node cli.js preset [name]   → list/switch presets
//   node cli.js install         → install hooks into .claude/settings.json
//   node cli.js uninstall       → remove hooks + stop loops + clean temp files
//   node cli.js stop            → emergency: kill all loops
//   node cli.js status          → show current config

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT_DIR = __dirname;
const CONFIG_PATH = path.join(ROOT_DIR, 'config.json');
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const AMBIENT_PATH = path.join(ROOT_DIR, 'scripts', 'ambient.js');

const TEMP_FILES = [
  path.join(os.tmpdir(), 'coding-asmr-ambient.pid'),
  path.join(os.tmpdir(), 'coding-asmr-ambient.pid.lock'),
  path.join(os.tmpdir(), 'coding-asmr-cooldown.json'),
];

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); }
  catch { return { enabled: true, volume: 35, sounds: {} }; }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

function stopLoops() {
  try { execSync(`node "${AMBIENT_PATH}" stop`, { stdio: 'ignore', timeout: 5000 }); } catch {}
}

function isOurHook(entry) {
  const cmds = (entry.hooks || []).map(h => h.command || '').join(' ');
  return cmds.includes('handler.js') || cmds.includes('ambient.js');
}

function cleanTempFiles() {
  for (const f of TEMP_FILES) {
    try { fs.unlinkSync(f); } catch {}
  }
}

const cmd = process.argv[2];
const arg = process.argv[3];

switch (cmd) {
  case 'on':
  case 'enable': {
    const config = loadConfig();
    config.enabled = true;
    saveConfig(config);
    console.log('Coding ASMR: enabled');
    console.log('Restart your Claude Code session for full effect.');
    break;
  }

  case 'off':
  case 'disable': {
    const config = loadConfig();
    config.enabled = false;
    saveConfig(config);
    stopLoops();
    console.log('Coding ASMR: disabled');
    console.log('All sounds muted. Use "node cli.js on" to re-enable.');
    break;
  }

  case 'volume':
  case 'vol': {
    if (arg == null) {
      const config = loadConfig();
      console.log(`Volume: ${config.volume}/100`);
      break;
    }
    const vol = parseInt(arg);
    if (isNaN(vol) || vol < 0 || vol > 100) {
      console.error('Volume must be 0-100');
      process.exit(1);
    }
    const config = loadConfig();
    config.volume = vol;
    saveConfig(config);
    console.log(`Volume set to ${vol}/100`);
    break;
  }

  case 'install': {
    execSync(`node "${path.join(ROOT_DIR, 'scripts', 'install-hooks.js')}"`, { stdio: 'inherit' });
    break;
  }

  case 'uninstall': {
    stopLoops();
    cleanTempFiles();
    try {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
      if (settings.hooks) {
        // Remove only coding-asmr hooks, keep other plugins' hooks
        for (const event of Object.keys(settings.hooks)) {
          settings.hooks[event] = settings.hooks[event].filter(e => !isOurHook(e));
          if (settings.hooks[event].length === 0) delete settings.hooks[event];
        }
        if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
      }
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
      console.log(`Coding ASMR hooks removed from ${SETTINGS_PATH}`);
    } catch {
      console.log('No hooks found to remove.');
    }
    console.log('Temp files cleaned. Restart your Claude Code session.');
    break;
  }

  case 'stop':
  case 'kill': {
    stopLoops();
    console.log('All loops stopped.');
    break;
  }

  case 'preset': {
    const presetsDir = path.join(ROOT_DIR, 'presets');
    if (!arg || arg === 'list') {
      // List available presets
      let files;
      try { files = fs.readdirSync(presetsDir).filter(f => f.endsWith('.json')); }
      catch { files = []; }
      const config = loadConfig();
      const active = config.preset || 'default';
      console.log('Available presets:');
      for (const f of files) {
        const name = f.replace('.json', '');
        const marker = name === active ? ' (active)' : '';
        try {
          const data = JSON.parse(fs.readFileSync(path.join(presetsDir, f), 'utf-8'));
          console.log(`  ${name}${marker} — ${data.description || ''}`);
        } catch {
          console.log(`  ${name}${marker}`);
        }
      }
      break;
    }
    if (arg === 'off' || arg === 'none' || arg === 'reset') {
      // Clear preset, revert to defaults
      const config = loadConfig();
      delete config.preset;
      saveConfig(config);
      console.log('Preset cleared. Using default sounds.');
      break;
    }
    // Switch to a preset
    const presetPath = path.join(presetsDir, arg + '.json');
    if (!fs.existsSync(presetPath)) {
      console.error(`Preset "${arg}" not found. Run "node cli.js preset list" to see available presets.`);
      process.exit(1);
    }
    const presetData = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));
    const config = loadConfig();
    config.preset = arg;
    // Apply preset volume if defined
    if (presetData.volume != null) {
      config.volume = presetData.volume;
    }
    // Sync error toggle: enable if preset defines error sounds, disable otherwise
    if (!config.sounds) config.sounds = {};
    if (!config.sounds.error) config.sounds.error = {};
    config.sounds.error.enabled = !!(presetData.sounds && presetData.sounds.error);
    saveConfig(config);
    console.log(`Preset: ${presetData.name || arg}`);
    console.log(`  ${presetData.description || ''}`);
    console.log(`  Volume: ${config.volume}/100`);
    break;
  }

  case 'status': {
    const config = loadConfig();
    console.log(`Coding ASMR status:`);
    console.log(`  Enabled: ${config.enabled}`);
    console.log(`  Volume:  ${config.volume}/100`);
    console.log(`  Preset:  ${config.preset || 'default'}`);
    console.log(`  Sounds:`);
    for (const [name, opts] of Object.entries(config.sounds || {})) {
      console.log(`    ${name.padEnd(16)} ${opts.enabled === false ? 'OFF' : 'ON'}`);
    }
    try {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
      const hasOurHooks = settings.hooks && Object.values(settings.hooks).some(
        entries => entries.some(e => isOurHook(e))
      );
      console.log(`  Hooks:   ${hasOurHooks ? 'installed' : 'not installed'}`);
    } catch {
      console.log(`  Hooks:   not installed`);
    }
    break;
  }

  default:
    console.log(`Coding ASMR - Sound control

Usage:
  node cli.js on                Enable sounds
  node cli.js off               Disable sounds + stop loops
  node cli.js volume <0-100>    Set volume (current: ${loadConfig().volume}/100)
  node cli.js volume            Show current volume
  node cli.js preset            List presets
  node cli.js preset <name>     Switch to a preset
  node cli.js preset off        Clear preset (use defaults)
  node cli.js install           Install hooks
  node cli.js uninstall         Remove hooks + clean up
  node cli.js stop              Emergency: kill all running loops
  node cli.js status            Show current configuration`);
}
