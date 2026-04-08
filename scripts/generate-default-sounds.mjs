import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const manifestPath = new URL("../config/default-sound-pack.json", import.meta.url);
const soundsDir = new URL("../raycast-extension/assets/sounds/", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

for (const sound of manifest.sounds) {
  const fileUrl = new URL(sound.filename, soundsDir);
  await mkdir(dirname(fileUrl.pathname), { recursive: true });
  await writeFile(
    fileUrl,
    createWavBuffer({
      frequencyHz: sound.frequencyHz,
      durationMs: sound.durationMs,
    }),
  );
}

function createWavBuffer({ frequencyHz, durationMs, sampleRate = 44100, gain = 0.28 }) {
  const totalSamples = Math.floor((durationMs / 1000) * sampleRate);
  const pcm = Buffer.alloc(totalSamples * 2);
  const attackSamples = Math.floor(sampleRate * 0.01);
  const releaseSamples = Math.floor(sampleRate * 0.03);

  for (let index = 0; index < totalSamples; index += 1) {
    const time = index / sampleRate;
    const attack = Math.min(1, index / Math.max(attackSamples, 1));
    const release = Math.min(1, (totalSamples - index) / Math.max(releaseSamples, 1));
    const envelope = Math.min(attack, release);
    const sample = Math.sin(2 * Math.PI * frequencyHz * time) * envelope * gain;
    pcm.writeInt16LE(Math.round(sample * 32767), index * 2);
  }

  return buildWav(pcm, sampleRate);
}

function buildWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
