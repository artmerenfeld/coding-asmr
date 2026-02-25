# Coding ASMR

<p align="center">
  <img src="asmrlogo.png" alt="Coding ASMR" width="200">
</p>

Handmade sound effects for Claude Code. Every tool call gets a pleasant, calming oldschool clicking and typing sound — as if Claude is sitting next to you, typing away.

Paste this into your AI coding assistant to install:

```bash
git clone https://github.com/artmerenfeld/coding-asmr.git && cd coding-asmr && npm run install-hooks
```

Requires [FFmpeg](https://ffmpeg.org/) (`winget install FFmpeg` / `brew install ffmpeg` / `apt install ffmpeg`). Restart your Claude Code session after.

---

## What It Sounds Like

```
You submit a prompt
  → thinking murmur

Claude reads a file
  → click → scanner loop fades in

Claude edits code
  → click → typing clicks loop

Claude asks you a question
  → question chime

Claude marks a task done
  → check jingle

Claude finishes responding
  → typing stops → completion chime
```

## Presets

Two sound modes are included:

### Default ASMR
Gentle typing, clicks, and thinking murmurs. Calm and ambient.

### Senior Developer
Frustrated senior dev energy. Thinking murmurs are replaced with swearing and muttering voicelines. Random ambient sounds like coffee slurps, crisp crunching, and cigarette drags. Angry reactions on errors. Higher volume.

### Switching presets

```bash
npm run preset                   # List available presets
npm run preset -- senior-dev     # Switch to Senior Developer
npm run preset -- default        # Switch back to Default ASMR
npm run preset -- off            # Clear preset (use defaults)
```

Switching presets applies the preset's volume and enables/disables error sounds automatically.

## Install

### 1. Install FFmpeg

- Windows: `winget install FFmpeg`
- macOS: `brew install ffmpeg`
- Linux: `apt install ffmpeg`

### 2. Clone and install

```bash
git clone https://github.com/artmerenfeld/coding-asmr.git
cd coding-asmr
npm run install-hooks
```

### 3. Restart Claude Code

Hooks load at session start, so **start a new session** to hear sounds.

## Controls

```bash
npm run off                # Mute everything + stop loops
npm run on                 # Re-enable sounds
npm run volume -- 30       # Set volume (0-100)
npm run preset             # List / switch presets
npm run status             # Show what's enabled
npm run stop               # Emergency: kill stuck loops
npm run uninstall          # Remove hooks + clean up
npm run install-hooks      # Reinstall hooks
```

Or use the CLI directly: `node cli.js off`, `node cli.js volume 30`, etc.

## Uninstall

```bash
npm run uninstall
```

Removes only Coding ASMR hooks (other plugins are preserved), stops all loops, and cleans up temp files. Restart your Claude Code session after.

## Configuration

Edit `config.json` to toggle individual sounds or adjust volume:

```json
{
  "enabled": true,
  "volume": 35,
  "preset": "default",
  "sounds": {
    "session-start": { "enabled": true },
    "click":         { "enabled": true },
    "check":         { "enabled": true },
    "error":         { "enabled": false },
    "notification":  { "enabled": true },
    "typing-loop":   { "enabled": true },
    "readloop":      { "enabled": true },
    "compact":       { "enabled": true },
    "thinking":      { "enabled": true },
    "question":      { "enabled": true }
  }
}
```

## Requirements

- **Node.js** >= 18
- **ffplay** (from FFmpeg) — the installer checks for this

## License

MIT
