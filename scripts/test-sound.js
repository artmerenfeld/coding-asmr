#!/usr/bin/env node
// test-sound.js - Play a specific sound by name
// Usage: node scripts/test-sound.js <sound-name>

const { playSound, listSounds, getSoundInfo } = require('../core');

const name = process.argv[2];

if (!name) {
  console.log('Usage: npm run test-sound -- <sound-name>\n');
  console.log('Available sounds:');
  for (const s of listSounds()) {
    const info = getSoundInfo(s);
    console.log(`  ${s.padEnd(20)} ${info.description}`);
  }
  process.exit(0);
}

const info = getSoundInfo(name);
if (!info) {
  console.error(`Unknown sound: "${name}"`);
  console.log('Run without arguments to see available sounds.');
  process.exit(1);
}

console.log(`Playing: ${info.name} - ${info.description}`);
playSound(name);
