// `pnpm eval:speech:generate [--out DIR]`: synthetic audio for every clip in set.json, made with
// Piper (open TTS voices) and ffmpeg. A stand-in until the team records the set (issue #65): the
// recordings then go in a folder with the same `<id>.wav` names, and `pnpm eval:speech --audio`
// reads them instead. Needs PIPER (the piper folder) and PIPER_VOICES (the .onnx voices).
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadSpeechSet, type Clip } from './set.js';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'var/speech-evals' } } });
const piper = process.env['PIPER'] ?? '';
const voices = process.env['PIPER_VOICES'] ?? '';
if (!piper || !voices) {
  console.error('Set PIPER to the piper folder and PIPER_VOICES to the folder of .onnx voices.');
  process.exit(2);
}
const out = resolve(values.out);
const work = mkdtempSync(join(tmpdir(), 'speech-'));
mkdirSync(out, { recursive: true });

/** Room tone: barely there in a quiet room, a steady hiss about 18 dB under the speech in a noisy one. */
const NOISE = { quiet: 0.002, noisy: 0.06 } as const;

function speak(text: string, voice: string, file: string): void {
  execFileSync(
    join(piper, 'piper'),
    ['--model', join(voices, `${voice}.onnx`), '--output_file', file],
    {
      input: text,
      cwd: piper,
      stdio: ['pipe', 'ignore', 'ignore'],
    },
  );
}

const ffmpeg = (args: string[]): void => {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
};

/** 16 kHz mono speech with half a second either side and a pause in the middle when asked. */
function speechClip(clip: Clip, file: string): void {
  const voice = clip.voice ?? '';
  const parts = clip.silenceSeconds ? halves(clip.text) : [clip.text];
  const inputs: string[] = [];
  const labels: string[] = [];
  parts.forEach((text, i) => {
    const wav = join(work, `${clip.id}-${String(i)}.wav`);
    speak(text, voice, wav);
    inputs.push('-i', wav);
    labels.push(`[${String(i)}:a]aresample=16000,aformat=channel_layouts=mono[s${String(i)}]`);
  });
  const gap = clip.silenceSeconds ?? 0;
  const chain =
    parts.length === 2
      ? `[s0]apad=pad_dur=${String(gap)}[g];[g][s1]concat=n=2:v=0:a=1[v]`
      : '[s0]anull[v]';
  ffmpeg([
    ...inputs,
    '-f',
    'lavfi',
    '-i',
    `anoisesrc=color=pink:amplitude=${String(NOISE[clip.room])}:sample_rate=16000:seed=${clip.id.slice(3)}`,
    '-filter_complex',
    `${labels.join(';')};${chain};[v]volume=0.7,adelay=500,apad=pad_dur=0.5[sp];[sp][${String(parts.length)}:a]amix=inputs=2:duration=first:normalize=0[out]`,
    '-map',
    '[out]',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-c:a',
    'pcm_s16le',
    file,
  ]);
}

function silenceClip(clip: Clip, file: string): void {
  ffmpeg([
    '-f',
    'lavfi',
    '-i',
    `anoisesrc=color=pink:amplitude=${String(NOISE[clip.room])}:sample_rate=16000:duration=${String(clip.seconds ?? 10)}:seed=${clip.id.slice(3)}`,
    '-ac',
    '1',
    '-c:a',
    'pcm_s16le',
    file,
  ]);
}

/** Splits the sentence at its middle word. */
function halves(text: string): [string, string] {
  const w = text.split(' ');
  const mid = Math.ceil(w.length / 2);
  return [w.slice(0, mid).join(' '), w.slice(mid).join(' ')];
}

const set = loadSpeechSet();
for (const clip of set.clips) {
  const file = join(out, `${clip.id}.wav`);
  if (clip.kind === 'speech') speechClip(clip, file);
  else silenceClip(clip, file);
  process.stderr.write(`${clip.id} ${clip.kind} ${clip.room}\n`);
}
rmSync(work, { recursive: true, force: true });
console.log(`${String(set.clips.length)} clips in ${out}`);
