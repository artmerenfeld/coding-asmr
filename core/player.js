// player.js - Cross-platform fire-and-forget WAV playback
// Spawns a detached system audio process that plays independently

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

function play(wavPath, volume) {
  const platform = os.platform();
  wavPath = path.resolve(wavPath);
  const vol = volume != null ? volume : 100;

  let child;

  if (platform === 'win32') {
    // ffplay (FFmpeg) is the most reliable Windows audio player -
    // PowerShell's SoundPlayer/MediaPlayer often route to wrong audio device
    child = spawn('ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', '-volume', String(vol), wavPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
  } else if (platform === 'darwin') {
    child = spawn('afplay', ['-v', String(vol / 100), wavPath], {
      detached: true,
      stdio: 'ignore',
    });
  } else {
    // Linux: try paplay (PulseAudio) first, fall back to aplay (ALSA)
    const paVol = Math.round(vol * 655.35); // paplay uses 0-65535
    child = spawn('sh', ['-c', `paplay --volume=${paVol} "${wavPath}" 2>/dev/null || aplay -q "${wavPath}" 2>/dev/null`], {
      detached: true,
      stdio: 'ignore',
    });
  }

  child.unref();
  return child;
}

module.exports = { play };
