// Shared e2e helpers: one app per test file, booted in-process and driven with fastify.inject.
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  /** A staff member with these roles and a verified two-step sign-in. */
  staff(roles: readonly string[]): Promise<{ token: string; userId: string; email: string }>;
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

  const { codeAt, stepAt } = await import('../src/modules/auth/totp.js');
  const staff: Api['staff'] = async (roles) => {
    const first = await signIn();
    await prisma.user.update({
      where: { id: first.userId },
      data: { roles: ['customer', ...roles] as never },
    });
    const again = await signIn(first.email);
    const enrol = await req<{ secret: string }>('POST', '/auth/mfa/enrol', { token: again.token });
    const verified = await req<{ accessToken: string }>('POST', '/auth/mfa/verify', {
      token: again.token,
      body: { code: codeAt(enrol.body.secret, stepAt(Date.now())) },
      headers: { 'x-client': 'native' },
    });
    if (!verified.body.accessToken) throw new Error(`mfa failed: ${JSON.stringify(verified.body)}`);
    return { token: verified.body.accessToken, userId: first.userId, email: first.email };
  };

  return { app, req, signIn, grantPlus, staff, close: () => app.close() };
}

/** The workbook's CSV tabs, as an upload sends them. */
export function workbookFiles(): Record<string, string> {
  const dir = resolve(import.meta.dirname, '../../../docs/specs/rules-engine-v3.3');
  const files: Record<string, string> = {};
  for (const name of readdirSync(dir))
    if (name.endsWith('.csv')) files[name] = readFileSync(resolve(dir, name), 'utf8');
  return files;
}

/**
 * Publishes a fresh engine v2 rule set from the workbook, as an admin would, discarding any open
 * draft first. Later file runs see this version (fileParallelism is off). Returns its label.
 */
export async function publishV2(api: Api, admin: string): Promise<string> {
  const list = await api.req<{ items: { label: string; status: string }[] }>('GET', '/rulesets', {
    token: admin,
  });
  for (const v of list.body.items.filter((x) => x.status === 'draft' || x.status === 'in_review'))
    await api.req('POST', `/rulesets/${v.label}/discard`, {
      token: admin,
      body: { reason: 'e2e' },
    });
  const wb = `c${String(Date.now()).slice(-9)}`;
  const imp = await api.req<{ version: { label: string } }>('POST', '/rulesets/import', {
    token: admin,
    body: { files: workbookFiles(), workbookVersion: wb },
  });
  const label = imp.body.version.label;
  await api.req('POST', `/rulesets/${label}/submit`, { token: admin });
  const pub = await api.req<{ status: string }>('POST', `/rulesets/${label}/publish`, {
    token: admin,
  });
  if (pub.body.status !== 'published')
    throw new Error(`publish failed: ${JSON.stringify(pub.body)}`);
  return label;
}
