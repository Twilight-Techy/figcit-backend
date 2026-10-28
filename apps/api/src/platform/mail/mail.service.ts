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

/**
 * Email over SMTP through nodemailer (SYSTEM_DESIGN §10). Without SMTP_URL, mail goes to a dev
 * mailbox (bounded, in memory) that local tools and e2e tests read through `GET /v1/dev/mailbox`.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private readonly transport: Transporter | undefined;
  private readonly mailbox: DevMail[] = [];

  constructor(@Inject(ENV) private readonly env: Env) {
    this.transport = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : undefined;
  }

  async send(mail: Mail): Promise<void> {
    if (this.env.DEV_MAILBOX || !this.transport) {
      this.mailbox.unshift({ ...mail, at: new Date().toISOString() });
      if (this.mailbox.length > DEV_LIMIT) this.mailbox.pop();
      if (!this.transport) {
        this.logger.log(`dev mail to ${mail.to.replace(/(.).+@/, '$1***@')}: ${mail.subject}`);
        return;
      }
    }
    await this.transport.sendMail({ from: this.env.MAIL_FROM, ...mail });
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
    '— NUCCESS by Figcit',
  ].join('\n');
  const esc = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const button = action
    ? `<p><a href="${esc(action.url)}" style="display:inline-block;padding:12px 20px;background:#2f5d50;color:#fff;border-radius:999px;text-decoration:none">${esc(action.label)}</a></p>`
    : '';
  const html = `<!doctype html><html lang="en-GB"><body style="font-family:system-ui,sans-serif;font-size:18px;line-height:1.5;color:#1f2328;max-width:560px;margin:0 auto;padding:24px"><h1 style="font-size:24px">${esc(heading)}</h1>${paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}${button}<p style="color:#555">NUCCESS by Figcit</p></body></html>`;
  return { text, html };
}
