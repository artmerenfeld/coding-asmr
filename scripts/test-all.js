#!/usr/bin/env node
// test-all.js - Play all sounds in sequence with labels

const { playSound, listSounds, getSoundInfo } = require('../core');

const sounds = listSounds();
let index = 0;

function playNext() {
  if (index >= sounds.length) {
    console.log('\nAll sounds played!');
    return;
  }

  const name = sounds[index];
  const info = getSoundInfo(name);
  console.log(`[${index + 1}/${sounds.length}] ${name.padEnd(20)} ${info.description}`);
  playSound(name);
  index++;

  // Wait 1.5 seconds between sounds so they don't overlap
  setTimeout(playNext, 1500);
}

console.log('Coding ASMR - Playing all sounds:\n');
playNext();
