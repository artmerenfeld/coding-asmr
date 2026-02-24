#!/usr/bin/env node
// setup.js - Generate all WAV sound files

const { generateAll } = require('./core');

console.log('Coding ASMR: Generating retro sound effects...\n');

const results = generateAll();

for (const r of results) {
  const kb = (r.bytes / 1024).toFixed(1);
  console.log(`  ${r.name.padEnd(20)} ${kb.padStart(6)} KB`);
}

console.log(`\nDone! ${results.length} sounds generated in sounds/`);
