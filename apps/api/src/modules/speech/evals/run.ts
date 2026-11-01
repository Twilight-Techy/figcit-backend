// `pnpm eval:speech <whisper|gemma> [--audio DIR] [--out DIR] [--limit N]` (SYSTEM_DESIGN §4.3.8).
// Transcribes every clip in set.json and reports word error rate, invented text and latency.
// whisper: the whisper.cpp server in WHISPER_URL, called as SpeechService calls it.
// gemma: a llama.cpp server in AI_BASE_URL running a model with audio input (Gemma 4 E4B and its
// mmproj), sent the clip through the OpenAI-compatible chat API.
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { scoreClip, summarise, type ClipResult, type SpeechSummary } from './score.js';
import { loadSpeechSet, type Clip } from './set.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    audio: { type: 'string', default: 'var/speech-evals' },
    out: { type: 'string', default: 'var/speech-evals/results' },
    limit: { type: 'string' },
    model: { type: 'string' },
  },
});
const engine = positionals[0];
const TIMEOUT_MS = Number(process.env['EVAL_TIMEOUT_MS'] ?? 300_000);
// Google's recommended speech-to-text prompt for Gemma's audio input, plus the no-speech case.
const PROMPT =
  'Transcribe the following speech segment in English into English text. Only output the transcription. If there is no speech, the transcript is empty.';
// Without a schema Gemma 4 wraps the words in commentary ("The user wants me to transcribe…"), so
// the transcript is asked for as JSON, like every other AI task.
const TRANSCRIPT = {
  type: 'object',
  properties: { transcript: { type: 'string' } },
  required: ['transcript'],
  additionalProperties: false,
};

async function whisper(wav: Buffer): Promise<string> {
  const base = (process.env['WHISPER_URL'] ?? '').replace(/\/$/, '');
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'audio');
  form.append('response_format', 'json');
  const res = await fetch(`${base}/inference`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`whisper ${String(res.status)}`);
  return ((await res.json()) as { text?: string }).text ?? '';
}

async function gemma(wav: Buffer): Promise<string> {
  const base = (process.env['AI_BASE_URL'] ?? '').replace(/\/$/, '');
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(process.env['AI_TOKEN'] ? { authorization: `Bearer ${process.env['AI_TOKEN']}` } : {}),
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'input_audio', input_audio: { data: wav.toString('base64'), format: 'wav' } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 200,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'transcript', schema: TRANSCRIPT },
      },
      chat_template_kwargs: { enable_thinking: false },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok)
    throw new Error(`model server ${String(res.status)}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? '';
  try {
    return (JSON.parse(content) as { transcript?: string }).transcript ?? '';
  } catch {
    return content;
  }
}

async function transcribe(clip: Clip): Promise<ClipResult> {
  const wav = readFileSync(join(resolve(values.audio), `${clip.id}.wav`));
  const started = performance.now();
  let text = '';
  let failed = false;
  try {
    text = engine === 'gemma' ? await gemma(wav) : await whisper(wav);
  } catch (error) {
    failed = true;
    process.stderr.write(`${clip.id} failed: ${String(error)}\n`);
  }
  return scoreClip(clip, text, Math.round(performance.now() - started), failed);
}

interface Report {
  readonly engine: string;
  readonly model: string;
  readonly set: { version: number; status: string };
  readonly startedAt: string;
  readonly summary: SpeechSummary;
  readonly results: ClipResult[];
}

const pct = (n: number | null): string => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);
const ms = (n: number | null): string => (n === null ? '—' : `${String(n)} ms`);

function markdown(r: Report, before: Report | null): string {
  const s = r.summary;
  const b = before?.summary;
  const was = (n: number | null | undefined): string =>
    b && n !== null && n !== undefined ? ` (was ${pct(n)})` : '';
  const lines = [
    `### Speech · ${r.engine} · ${r.model}`,
    '',
    `Set v${String(r.set.version)} (${r.set.status}), ${String(s.clips)} clips, ${r.startedAt}.`,
    '',
    '| Measure | Result |',
    '| --- | --- |',
    `| Word error rate | ${pct(s.wer)}${was(b?.wer)} |`,
    `| WER, quiet / noisy room | ${pct(s.werQuiet)} / ${pct(s.werNoisy)} |`,
    `| WER, long pause mid-sentence | ${pct(s.werLongSilence)} |`,
    `| WER by accent | ${Object.entries(s.werByAccent)
      .map(([a, w]) => `${a} ${pct(w)}`)
      .join(', ')} |`,
    `| Clips with invented text | ${String(s.inventedClips)} (${String(s.inventedOnSilence)} of them with no speech at all) |`,
    `| Failed calls | ${String(s.failed)} |`,
    `| Latency p50 / p95 | ${ms(s.latencyP50)} / ${ms(s.latencyP95)} |`,
  ];
  const invented = r.results.filter((x) => x.invented).slice(0, 10);
  if (invented.length) {
    lines.push('', '<details><summary>Invented text</summary>', '');
    for (const x of invented) lines.push(`- \`${x.id}\` (${x.kind}): "${x.transcript.trim()}"`);
    lines.push('', '</details>');
  }
  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  if (engine !== 'whisper' && engine !== 'gemma') {
    console.error('Usage: pnpm eval:speech <whisper|gemma> [--audio DIR] [--out DIR] [--limit N]');
    process.exit(2);
  }
  const url = engine === 'whisper' ? process.env['WHISPER_URL'] : process.env['AI_BASE_URL'];
  if (!url) {
    console.error(engine === 'whisper' ? 'Set WHISPER_URL.' : 'Set AI_BASE_URL.');
    process.exit(2);
  }
  const set = loadSpeechSet();
  const clips = set.clips.slice(0, values.limit ? Number(values.limit) : undefined);
  const results: ClipResult[] = [];
  for (const clip of clips) {
    const r = await transcribe(clip);
    results.push(r);
    process.stderr.write(`${clip.id} ${String(r.errors)} errors${r.invented ? ' invented' : ''}\n`);
  }
  const model =
    values.model ??
    (engine === 'whisper' ? 'whisper-small.en' : (process.env['AI_MODEL'] ?? 'gemma'));
  const startedAt = new Date().toISOString();
  const report: Report = {
    engine,
    model,
    set: { version: set.version, status: set.status },
    startedAt,
    summary: summarise(results),
    results,
  };
  const dir = resolve(values.out);
  mkdirSync(dir, { recursive: true });
  const prefix = `speech--${model.replace(/[^a-zA-Z0-9.-]+/g, '_')}--`;
  const file = `${prefix}${startedAt.replace(/[:.]/g, '-')}.json`;
  const last = readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .at(-1);
  const before = last ? (JSON.parse(readFileSync(join(dir, last), 'utf8')) as Report) : null;
  writeFileSync(join(dir, file), `${JSON.stringify(report, null, 2)}\n`);
  const md = markdown(report, before);
  writeFileSync(join(dir, file.replace(/\.json$/, '.md')), md);
  process.stdout.write(`${md}\n`);
  if (process.env['GITHUB_STEP_SUMMARY'])
    appendFileSync(process.env['GITHUB_STEP_SUMMARY'], `${md}\n`);
}

await main();
