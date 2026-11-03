// A tiny OpenAI-compatible model server for e2e tests: replies with whatever the test queues.
// `decide` queues a decision-scoring answer (ADR 0005): one token and its top_logprobs.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FakeModel {
  readonly url: string;
  readonly requests: {
    body: { messages: { role: string; content: string }[]; stream?: boolean; logprobs?: boolean };
  }[];
  reply(content: string | ((body: unknown) => string)): void;
  /** Label probabilities for the next decision call, e.g. { A: 0.9, B: 0.1 }. */
  decide(probabilities: Record<string, number>): void;
  fail(status: number): void;
  close(): Promise<void>;
}

export async function startFakeModel(): Promise<FakeModel> {
  const queue: (string | ((body: unknown) => string) | number | Record<string, number>)[] = [];
  const requests: FakeModel['requests'] = [];
  const server: Server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c: Buffer) => (raw += c.toString()));
    req.on('end', () => {
      const body = JSON.parse(raw) as FakeModel['requests'][number]['body'];
      requests.push({ body });
      const next = queue.shift() ?? '{}';
      if (typeof next === 'number') {
        res.writeHead(next).end();
        return;
      }
      if (typeof next === 'object') {
        const top = Object.entries(next)
          .sort((a, b) => b[1] - a[1])
          .map(([token, p]) => ({ token, logprob: Math.log(p) }));
        res.writeHead(200, { 'content-type': 'application/json' }).end(
          JSON.stringify({
            choices: [
              {
                message: { content: top[0]?.token ?? '' },
                logprobs: { content: [{ top_logprobs: top }] },
              },
            ],
          }),
        );
        return;
      }
      const content = typeof next === 'function' ? next(body) : next;
      if (body.stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        for (const word of content.split(/(?<= )/))
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: word } }] })}\n\n`);
        res.end('data: [DONE]\n\n');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({
          choices: [{ message: { content } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}`,
    requests,
    reply: (c) => queue.push(c),
    decide: (p) => queue.push(p),
    fail: (s) => queue.push(s),
    close: () =>
      new Promise((r) =>
        server.close(() => {
          r();
        }),
      ),
  };
}
