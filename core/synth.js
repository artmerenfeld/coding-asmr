// synth.js - Zero-dependency WAV synthesis engine
// Generates retro sound effects using only Node.js Buffer

const SAMPLE_RATE = 22050; // Low rate for retro aesthetic
const BIT_DEPTH = 16;
const NUM_CHANNELS = 1; // Mono

// --- WAV File Creation ---

function createWavBuffer(samples) {
  const dataLength = samples.length * (BIT_DEPTH / 8);
  const headerLength = 44;
  const buffer = Buffer.alloc(headerLength + dataLength);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(NUM_CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * (BIT_DEPTH / 8), 28);
  buffer.writeUInt16LE(NUM_CHANNELS * (BIT_DEPTH / 8), 32);
  buffer.writeUInt16LE(BIT_DEPTH, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);

  // Write PCM samples (clamp to [-1, 1] then scale to Int16)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s * 32767), headerLength + i * 2);
  }

  return buffer;
}

// --- Oscillators ---

function sine(freq, duration) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = Math.sin(2 * Math.PI * freq * i / SAMPLE_RATE);
  }
  return out;
}

function square(freq, duration) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = Math.sin(2 * Math.PI * freq * i / SAMPLE_RATE) >= 0 ? 1 : -1;
  }
  return out;
}

function sawtooth(freq, duration) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const phase = (freq * i / SAMPLE_RATE) % 1;
    out[i] = 2 * phase - 1;
  }
  return out;
}

function triangle(freq, duration) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const phase = (freq * i / SAMPLE_RATE) % 1;
    out[i] = 4 * Math.abs(phase - 0.5) - 1;
  }
  return out;
}

function noise(duration) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = Math.random() * 2 - 1;
  }
  return out;
}

// --- Frequency Sweep ---

function sweep(startFreq, endFreq, duration) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(len);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / len;
    const freq = startFreq + (endFreq - startFreq) * t;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    out[i] = Math.sin(phase);
  }
  return out;
}

// --- Envelope ---

function applyEnvelope(samples, env) {
  const { attack = 0.01, decay = 0.05, sustain = 0.5, release = 0.05 } = env;
  const len = samples.length;
  const out = new Float32Array(len);

  const attackSamples = Math.floor(attack * SAMPLE_RATE);
  const decaySamples = Math.floor(decay * SAMPLE_RATE);
  const releaseSamples = Math.floor(release * SAMPLE_RATE);
  const sustainSamples = Math.max(0, len - attackSamples - decaySamples - releaseSamples);

  for (let i = 0; i < len; i++) {
    let gain;
    if (i < attackSamples) {
      // Attack: 0 → 1
      gain = i / attackSamples;
    } else if (i < attackSamples + decaySamples) {
      // Decay: 1 → sustain
      const t = (i - attackSamples) / decaySamples;
      gain = 1 - (1 - sustain) * t;
    } else if (i < attackSamples + decaySamples + sustainSamples) {
      // Sustain
      gain = sustain;
    } else {
      // Release: sustain → 0
      const t = (i - attackSamples - decaySamples - sustainSamples) / releaseSamples;
      gain = sustain * (1 - t);
    }
    out[i] = samples[i] * Math.max(0, gain);
  }

  return out;
}

// --- Utilities ---

function mix(layerArrays, volumes) {
  const maxLen = Math.max(...layerArrays.map(a => a.length));
  const out = new Float32Array(maxLen);
  for (let l = 0; l < layerArrays.length; l++) {
    const arr = layerArrays[l];
    const vol = volumes[l] ?? 1;
    for (let i = 0; i < arr.length; i++) {
      out[i] += arr[i] * vol;
    }
  }
  return out;
}

function concat(segmentArrays) {
  const totalLen = segmentArrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Float32Array(totalLen);
  let offset = 0;
  for (const seg of segmentArrays) {
    out.set(seg, offset);
    offset += seg.length;
  }
  return out;
}

function amplify(samples, gain) {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = samples[i] * gain;
  }
  return out;
}

function silence(duration) {
  return new Float32Array(Math.floor(SAMPLE_RATE * duration));
}

// Bitcrusher effect for extra retro crunch
function bitcrush(samples, bits) {
  const out = new Float32Array(samples.length);
  const levels = Math.pow(2, bits);
  for (let i = 0; i < samples.length; i++) {
    out[i] = Math.round(samples[i] * levels) / levels;
  }
  return out;
}

// Simple low-pass filter (one-pole)
function lowpass(samples, cutoff) {
  const out = new Float32Array(samples.length);
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / SAMPLE_RATE;
  const alpha = dt / (rc + dt);
  out[0] = samples[0];
  for (let i = 1; i < samples.length; i++) {
    out[i] = out[i - 1] + alpha * (samples[i] - out[i - 1]);
  }
  return out;
}

module.exports = {
  SAMPLE_RATE,
  createWavBuffer,
  sine,
  square,
  sawtooth,
  triangle,
  noise,
  sweep,
  applyEnvelope,
  mix,
  concat,
  amplify,
  silence,
  bitcrush,
  lowpass,
};
