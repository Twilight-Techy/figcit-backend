// Shared e2e helpers: one app per test file, booted in-process and driven with fastify.inject.
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { randomUUID } from 'node:crypto';
import { loadDotEnv } from '../src/common/config/dotenv.js';
import { loadEnv } from '../src/common/config/env.js';

export interface Api {
  readonly app: NestFastifyApplication;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- callers name the body type they expect
  req<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    opts?: { token?: string; body?: unknown; headers?: Record<string, string> },
  ): Promise<{ status: number; body: T; headers: Record<string, unknown> }>;
  signIn(email?: string): Promise<{ token: string; email: string; userId: string }>;
  grantPlus(userId: string): Promise<void>;
  close(): Promise<void>;
}

export async function bootApi(overrides: Record<string, string> = {}): Promise<Api> {
  process.env['NODE_ENV'] = 'test';
  process.env['DEV_MAILBOX'] = 'true';
  process.env['RATE_LIMIT_ENABLED'] = 'false';
  process.env['LOG_LEVEL'] = 'error';
  loadDotEnv();
  Object.assign(process.env, overrides);
  const { createApp } = await import('../src/app.factory.js');
  const app = await createApp(loadEnv(), { logger: false });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const req: Api['req'] = async (method, url, opts = {}) => {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.token) headers['authorization'] = `Bearer ${opts.token}`;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    const res = await app.inject({
      method,
      url: `/v1${url}`,
      headers,
      ...(opts.body !== undefined ? { payload: JSON.stringify(opts.body) } : {}),
    });
    const text = res.body;
    return {
      status: res.statusCode,
      body: (text ? JSON.parse(text) : null) as never,
      headers: res.headers,
    };
  };

  const signIn: Api['signIn'] = async (email = `e2e-${randomUUID()}@example.test`) => {
    await req('POST', '/auth/magic-link', { body: { email } });
    const mail = await req<{ mail: { to: string; text: string }[] }>(
      'GET',
      `/dev/mailbox?to=${encodeURIComponent(email)}`,
    );
    const code = /\b(\d{6})\b/.exec(mail.body.mail.find((m) => m.to === email)?.text ?? '')?.[1];
    const res = await req<{ accessToken: string; user: { id: string } }>(
      'POST',
      '/auth/magic-link/verify',
      { body: { email, code }, headers: { 'x-client': 'native' } },
    );
    if (res.status !== 200 && res.status !== 201)
      throw new Error(`sign-in failed: ${JSON.stringify(res.body)}`);
    return { token: res.body.accessToken, email, userId: res.body.user.id };
  };

  const { PrismaService } = await import('../src/common/db/prisma.service.js');
  const prisma = app.get(PrismaService);
  const grantPlus: Api['grantPlus'] = async (userId) => {
    await prisma.entitlement.create({
      data: { userId, planCode: 'plus_monthly', source: 'web', status: 'active' },
    });
  };

  return { app, req, signIn, grantPlus, close: () => app.close() };
}
