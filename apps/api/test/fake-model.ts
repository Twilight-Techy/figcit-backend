// A tiny OpenAI-compatible model server for e2e tests: replies with whatever the test queues.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FakeModel {
  readonly url: string;
  readonly requests: {
    body: { messages: { role: string; content: string }[]; stream?: boolean };
  }[];
  reply(content: string | ((body: unknown) => string)): void;
  fail(status: number): void;
  close(): Promise<void>;
}

export async function startFakeModel(): Promise<FakeModel> {
  const queue: (string | ((body: unknown) => string) | number)[] = [];
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
    fail: (s) => queue.push(s),
    close: () =>
      new Promise((r) =>
        server.close(() => {
          r();
        }),
      ),
  };
}
