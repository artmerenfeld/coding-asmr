// sounds.js - Synth-generated sound effect recipes
// Only sounds that don't have handmade replacements. Handmade sounds live in sounds/handmade/

const SOUNDS = {
  'error': {
    name: 'Error Buzz',
    description: 'Low harsh buzz - something went wrong',
    recipe: (s) => {
      const buzz = s.applyEnvelope(
        s.square(150, 0.3),
        { attack: 0.005, decay: 0.1, sustain: 0.5, release: 0.15 }
      );
      const crackle = s.applyEnvelope(
        s.bitcrush(s.noise(0.3), 4),
        { attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.1 }
      );
      return s.amplify(s.mix([buzz, crackle], [0.65, 0.35]), 0.9);
    },
  },

  'notification': {
    name: 'Attention Bell',
    description: 'Bright ping - needs attention',
    recipe: (s) => {
      const bell = s.applyEnvelope(
        s.sine(1500, 0.25),
        { attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.09 }
      );
      const harmonic = s.applyEnvelope(
        s.sine(3000, 0.2),
        { attack: 0.005, decay: 0.12, sustain: 0.05, release: 0.05 }
      );
      return s.amplify(s.mix([bell, harmonic], [0.7, 0.2]), 0.9);
    },
  },

  'compact': {
    name: 'Compression Whoosh',
    description: 'Noise burst + downward sweep - compacting context',
    recipe: (s) => {
      const whoosh = s.applyEnvelope(
        s.lowpass(s.noise(0.4), 3000),
        { attack: 0.02, decay: 0.2, sustain: 0.1, release: 0.18 }
      );
      const sw = s.applyEnvelope(
        s.sweep(3000, 100, 0.4),
        { attack: 0.02, decay: 0.18, sustain: 0.1, release: 0.12 }
      );
      return s.amplify(s.mix([whoosh, sw], [0.5, 0.45]), 0.9);
    },
  },

};

module.exports = { SOUNDS };
