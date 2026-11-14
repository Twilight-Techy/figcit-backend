// Speech on a hosted OpenAI-style API (SPEECH_PROVIDER=openai), e.g. Groq: the recording goes to
// /v1/audio/transcriptions with the model and the token, and the text comes back screened.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SpeechService } from '../src/modules/speech/speech.service.js';
import { bootApi, type Api } from './helpers.js';

let api: Api;
beforeAll(async () => {
  api = await bootApi({
    SPEECH_PROVIDER: 'openai',
    WHISPER_URL: 'https://speech.test/openai',
    SPEECH_MODEL: 'whisper-test',
    SPEECH_TOKEN: 'speech-token',
  });
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await api.close();
});

describe('speech on a hosted API', () => {
  it('sends the recording with the model and token, and keeps the text', async () => {
    const { token } = await api.signIn();
    const up = await api.req<{ fileId: string; upload: { url: string }; serverAvailable: boolean }>(
      'POST',
      '/speech/uploads',
      { token, body: { contentType: 'audio/webm', sizeBytes: 4 } },
    );
    expect(up.body.serverAvailable).toBe(true);
    await api.app.inject({
      method: 'PUT',
      url: up.body.upload.url.replace(/^https?:\/\/[^/]+/, ''),
      headers: { 'content-type': 'audio/webm' },
      payload: Buffer.from('abcd'),
    });
    const t = await api.req<{ id: string }>('POST', '/speech/transcriptions', {
      token,
      body: { fileId: up.body.fileId, purpose: 'dump' },
    });
    const calls: { url: string; auth: string | null; model: unknown; name: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        const form = init.body as FormData;
        const file = form.get('file') as File;
        calls.push({
          url,
          auth: new Headers(init.headers).get('authorization'),
          model: form.get('model'),
          name: file.name,
        });
        return Promise.resolve(Response.json({ text: ' I need to email my tutor. ' }));
      }),
    );
    await api.app.get(SpeechService).transcribe(t.body.id);
    vi.unstubAllGlobals();
    expect(calls).toEqual([
      {
        url: 'https://speech.test/openai/v1/audio/transcriptions',
        auth: 'Bearer speech-token',
        model: 'whisper-test',
        name: 'audio.webm',
      },
    ]);
    const done = await api.req<{ status: string; text: string }>(
      'GET',
      `/speech/transcriptions/${t.body.id}`,
      { token },
    );
    expect(done.body).toMatchObject({ status: 'done', text: 'I need to email my tutor.' });
  });
});
