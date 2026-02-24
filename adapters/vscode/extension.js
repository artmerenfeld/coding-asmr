// extension.js - VS Code / Cursor extension adapter for Coding ASMR
// Maps VS Code editor events to the core sound engine

const vscode = require('vscode');
const path = require('path');
const { playSound, listSounds, getSoundInfo } = require('../../core');

// Debounce helper to prevent rapid-fire sounds
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Throttle helper - fires at most once per interval
function throttle(fn, ms) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  };
}

function getConfig() {
  return vscode.workspace.getConfiguration('coding-asmr');
}

function activate(context) {
  const rootDir = path.resolve(__dirname, '..', '..');

  // Helper that checks global enable before playing
  function play(name) {
    const config = getConfig();
    if (!config.get('enabled', true)) return;
    playSound(name, { rootDir });
  }

  // --- Typing sounds (debounced to avoid machine-gun clicks) ---
  const onTypeSound = throttle(() => {
    if (getConfig().get('typingSounds', true)) {
      play('write-start');
    }
  }, 150); // At most one click per 150ms

  const textChangeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
    // Only trigger for user edits in visible editors (not output panels, etc.)
    if (e.document.uri.scheme === 'file' && e.contentChanges.length > 0) {
      onTypeSound();
    }
  });

  // --- File open sound ---
  const fileOpenDisposable = vscode.workspace.onDidOpenTextDocument((doc) => {
    if (doc.uri.scheme === 'file' && getConfig().get('fileSounds', true)) {
      play('read-start');
    }
  });

  // --- File save sound ---
  const fileSaveDisposable = vscode.workspace.onDidSaveTextDocument((doc) => {
    if (doc.uri.scheme === 'file' && getConfig().get('fileSounds', true)) {
      play('write-complete');
    }
  });

  // --- Terminal / task sounds ---
  const taskStartDisposable = vscode.tasks.onDidStartTask(() => {
    if (getConfig().get('terminalSounds', true)) {
      play('bash-start');
    }
  });

  const taskEndDisposable = vscode.tasks.onDidEndTask(() => {
    if (getConfig().get('terminalSounds', true)) {
      play('bash-complete');
    }
  });

  // --- Diagnostic change sound (errors appearing) ---
  const diagChangeSound = debounce(() => {
    const diags = vscode.languages.getDiagnostics();
    const hasErrors = diags.some(([, items]) =>
      items.some((d) => d.severity === vscode.DiagnosticSeverity.Error)
    );
    if (hasErrors) {
      play('error');
    }
  }, 2000); // Only check 2s after diagnostics settle

  const diagDisposable = vscode.languages.onDidChangeDiagnostics(() => {
    diagChangeSound();
  });

  // --- Commands ---
  const toggleCmd = vscode.commands.registerCommand('coding-asmr.toggle', () => {
    const config = getConfig();
    const current = config.get('enabled', true);
    config.update('enabled', !current, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(
      `Coding ASMR: ${!current ? 'Enabled' : 'Disabled'}`
    );
    if (!current) {
      play('session-start');
    }
  });

  const testAllCmd = vscode.commands.registerCommand('coding-asmr.testAll', async () => {
    const sounds = listSounds();
    for (const name of sounds) {
      const info = getSoundInfo(name);
      vscode.window.setStatusBarMessage(`Coding ASMR: ${info.name}`, 1400);
      play(name);
      await new Promise((r) => setTimeout(r, 1500));
    }
    vscode.window.setStatusBarMessage('Coding ASMR: All sounds played!', 3000);
  });

  // Play boot sound on activation
  play('session-start');

  context.subscriptions.push(
    textChangeDisposable,
    fileOpenDisposable,
    fileSaveDisposable,
    taskStartDisposable,
    taskEndDisposable,
    diagDisposable,
    toggleCmd,
    testAllCmd
  );
}

function deactivate() {
  // No cleanup needed - sounds are fire-and-forget
}

module.exports = { activate, deactivate };
