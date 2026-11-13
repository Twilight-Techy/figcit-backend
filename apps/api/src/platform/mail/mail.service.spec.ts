import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../common/config/env.js';
import { MailService, sender } from './mail.service.js';

const mail = {
  to: 'ada@example.test',
  subject: 'Your sign-in link',
  text: 'Hi',
  html: '<p>Hi</p>',
};

describe('the sender', () => {
  it('reads a name and an address, or a bare address', () => {
    expect(sender('FigCit Admin <admin@figcit.co.uk>')).toEqual({
      name: 'FigCit Admin',
      email: 'admin@figcit.co.uk',
    });
    expect(sender('admin@figcit.co.uk')).toEqual({ email: 'admin@figcit.co.uk' });
  });
});

describe('mail through Brevo (owner, 12 Nov 2026)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts to the HTTPS API with the key, the sender and both bodies', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"messageId":"m1"}', { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    const svc = new MailService({
      BREVO_API_KEY: 'k',
      MAIL_FROM: 'FigCit Admin <admin@figcit.co.uk>',
      SMTP_URL: 'smtp://ignored',
    } as Env);
    await svc.send(mail);
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init.headers as Record<string, string>)['api-key']).toBe('k');
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { name: 'FigCit Admin', email: 'admin@figcit.co.uk' },
      to: [{ email: 'ada@example.test' }],
      subject: 'Your sign-in link',
      htmlContent: '<p>Hi</p>',
      textContent: 'Hi',
    });
    expect(svc.devMailbox()).toEqual([]);
  });

  it('fails loudly when Brevo refuses, so the caller can say it did not send', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('sender not valid', { status: 400 })),
    );
    const svc = new MailService({ BREVO_API_KEY: 'k', MAIL_FROM: 'admin@figcit.co.uk' } as Env);
    await expect(svc.send(mail)).rejects.toThrow('brevo 400: sender not valid');
  });

  it('keeps mail in the dev mailbox when nothing can send', async () => {
    const svc = new MailService({ MAIL_FROM: 'admin@figcit.co.uk' } as Env);
    await svc.send(mail);
    expect(svc.devMailbox()).toHaveLength(1);
  });
});
