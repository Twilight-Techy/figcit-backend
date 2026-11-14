import { Inject, Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { ENV, type Env } from '../../common/config/env.js';

export interface Mail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export interface DevMail extends Mail {
  readonly at: string;
}

const DEV_LIMIT = 50;

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
/** A sign-in email can't wait long: the request that sends it is waiting too. */
const SEND_TIMEOUT_MS = 15_000;

/** "FigCit <hello@figcit.co.uk>" or a bare address, as Brevo's sender object. */
export function sender(from: string): { name?: string; email: string } {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (!m) return { email: from.trim() };
  const name = (m[1] ?? '').replace(/^"|"$/g, '');
  return name ? { name, email: m[2] ?? '' } : { email: m[2] ?? '' };
}

/**
 * Email (SYSTEM_DESIGN §10): through Brevo's HTTPS API when BREVO_API_KEY is set, else over SMTP
 * through nodemailer. With neither, mail goes to a dev mailbox (bounded, in memory) that local
 * tools and e2e tests read through `GET /v1/dev/mailbox`.
 */
/** Nodemailer reads options from the URL's query: a blocked port fails in seconds, not minutes. */
export function withTimeouts(url: string): string {
  const u = new URL(url);
  for (const k of ['connectionTimeout', 'greetingTimeout', 'socketTimeout'])
    if (!u.searchParams.has(k)) u.searchParams.set(k, String(SEND_TIMEOUT_MS));
  return u.toString();
}

@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private readonly transport: Transporter | undefined;
  private readonly mailbox: DevMail[] = [];

  constructor(@Inject(ENV) private readonly env: Env) {
    this.transport =
      env.SMTP_URL && !env.BREVO_API_KEY
        ? nodemailer.createTransport(withTimeouts(env.SMTP_URL))
        : undefined;
  }

  /** Whether mail actually leaves: the app hides email sign-in methods when it doesn't (SU-2). */
  get delivers(): boolean {
    return this.sends && !this.env.DEV_MAILBOX;
  }

  private get sends(): boolean {
    return Boolean(this.env.BREVO_API_KEY) || this.transport !== undefined;
  }

  private async viaBrevo(key: string, mail: Mail): Promise<void> {
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: sender(this.env.MAIL_FROM),
        to: [{ email: mail.to }],
        subject: mail.subject,
        htmlContent: mail.html,
        textContent: mail.text,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    // The body may name the cause (an unverified sender, a bad key); never the address.
    if (!res.ok)
      throw new Error(`brevo ${String(res.status)}: ${(await res.text()).slice(0, 200)}`);
  }

  async send(mail: Mail): Promise<void> {
    if (this.env.DEV_MAILBOX || !this.sends) {
      this.mailbox.unshift({ ...mail, at: new Date().toISOString() });
      if (this.mailbox.length > DEV_LIMIT) this.mailbox.pop();
      if (!this.sends) {
        this.logger.log(`dev mail to ${mail.to.replace(/(.).+@/, '$1***@')}: ${mail.subject}`);
        return;
      }
    }
    if (this.env.BREVO_API_KEY) await this.viaBrevo(this.env.BREVO_API_KEY, mail);
    else await this.transport?.sendMail({ from: this.env.MAIL_FROM, ...mail });
  }

  devMailbox(to?: string): readonly DevMail[] {
    return to ? this.mailbox.filter((m) => m.to === to) : this.mailbox;
  }
}

/** Calm, plain emails. Each template returns text and a minimal accessible HTML version. */
export function layout(
  heading: string,
  paragraphs: readonly string[],
  action?: { label: string; url: string },
): { text: string; html: string } {
  const text = [
    heading,
    '',
    ...paragraphs,
    ...(action ? ['', `${action.label}: ${action.url}`] : []),
    '',
    '— FigCit',
  ].join('\n');
  const esc = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const button = action
    ? `<p><a href="${esc(action.url)}" style="display:inline-block;padding:12px 20px;background:#2f5d50;color:#fff;border-radius:999px;text-decoration:none">${esc(action.label)}</a></p>`
    : '';
  const html = `<!doctype html><html lang="en-GB"><body style="font-family:system-ui,sans-serif;font-size:18px;line-height:1.5;color:#1f2328;max-width:560px;margin:0 auto;padding:24px"><h1 style="font-size:24px">${esc(heading)}</h1>${paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}${button}<p style="color:#555">FigCit</p></body></html>`;
  return { text, html };
}
