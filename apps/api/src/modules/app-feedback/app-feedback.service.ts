import { timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type Env } from '../../common/config/env.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { BadInput, Forbidden, NotFound } from '../../common/errors/errors.js';
import { MailService } from '../../platform/mail/mail.service.js';
import { emailLayout } from '../../platform/mail/template.js';
import { StorageService } from '../../platform/storage/storage.service.js';
import type {
  AppFeedbackInput,
  FeedbackItem,
  STATUSES,
  WebsiteFeedbackInput,
} from './app-feedback.schemas.js';

const LIST_LIMIT = 200;
const KIND_WORDS = {
  broken: "Something's broken",
  confusing: 'Something was confusing',
  idea: 'An idea',
} as const;

type Row = Awaited<ReturnType<PrismaService['appFeedback']['create']>>;

/** Tester feedback: kept for staff to read, and each report emailed to FEEDBACK_TO. */
@Injectable()
export class AppFeedbackService {
  private readonly logger = new Logger('AppFeedback');

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly storage: StorageService,
  ) {}

  async fromApp(userId: string | null, input: AppFeedbackInput): Promise<{ id: string }> {
    if (input.screenshotId) await this.keepScreenshot(userId, input.screenshotId);
    const row = await this.prisma.appFeedback.create({
      data: {
        userId,
        source: 'app',
        kind: input.kind,
        text: input.text,
        screen: input.screen ?? null,
        appVersion: input.appVersion ?? null,
        device: input.device ?? null,
        screenshotId: input.screenshotId ?? null,
      },
    });
    await this.notify(row);
    return { id: row.id };
  }

  async fromWebsite(key: string | undefined, input: WebsiteFeedbackInput): Promise<{ id: string }> {
    const want = this.env.WEBSITE_FEEDBACK_KEY;
    if (!want || !key || !same(key, want)) throw new Forbidden();
    const row = await this.prisma.appFeedback.create({
      data: {
        source: 'website',
        kind: input.kind,
        text: input.text,
        screen: input.page ?? null,
        name: input.name ?? null,
        email: input.email ?? null,
      },
    });
    await this.notify(row);
    return { id: row.id };
  }

  async list(status?: (typeof STATUSES)[number]): Promise<FeedbackItem[]> {
    const rows = await this.prisma.appFeedback.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
    });
    return Promise.all(rows.map((r) => this.item(r)));
  }

  async setStatus(id: string, status: (typeof STATUSES)[number]): Promise<FeedbackItem> {
    const found = await this.prisma.appFeedback.findUnique({ where: { id } });
    if (!found) throw new NotFound('feedback');
    return this.item(await this.prisma.appFeedback.update({ where: { id }, data: { status } }));
  }

  /** Only the sender's own uploaded screenshot; kept from now on, not removed after a day. */
  private async keepScreenshot(userId: string | null, fileId: string): Promise<void> {
    const res = userId
      ? await this.prisma.storedFile.updateMany({
          where: { id: fileId, userId, purpose: 'feedback_screenshot', status: 'uploaded' },
          data: { expiresAt: null },
        })
      : { count: 0 };
    if (res.count === 0) throw new BadInput('That screenshot is not one of your uploads.');
  }

  private async item(r: Row): Promise<FeedbackItem> {
    return {
      id: r.id,
      source: r.source === 'website' ? 'website' : 'app',
      kind: r.kind,
      text: r.text,
      screen: r.screen,
      appVersion: r.appVersion,
      device: r.device,
      name: r.name,
      email: r.email,
      screenshotUrl: await this.screenshotUrl(r.screenshotId),
      signedIn: r.userId !== null,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private async screenshotUrl(fileId: string | null): Promise<string | null> {
    if (!fileId) return null;
    const file = await this.prisma.storedFile.findUnique({
      where: { id: fileId },
      select: { storageKey: true, status: true },
    });
    return file?.status === 'uploaded' ? this.storage.presignDownload(file.storageKey) : null;
  }

  /** The email never holds back a report: if it can't go, the report is still kept. */
  private async notify(r: Row): Promise<void> {
    const where = r.source === 'website' ? 'the website' : 'the app';
    const staff = this.env.STAFF_APP_URL;
    const details = [
      r.screen ? `Where: ${r.screen}` : null,
      r.appVersion ? `App version: ${r.appVersion}` : null,
      r.device ? `Device: ${r.device}` : null,
      r.name ? `Name: ${r.name}` : null,
      r.email ? `Email: ${r.email}` : null,
      r.screenshotId ? 'A screenshot is attached in the staff app.' : null,
    ].filter((x): x is string => x !== null);
    const body = emailLayout({
      appUrl: this.env.APP_URL,
      heading: `${KIND_WORDS[r.kind]}, from ${where}`,
      paragraphs: [r.text, ...details],
      action: staff
        ? { label: 'See all feedback', url: `${staff.replace(/\/$/, '')}/feedback/` }
        : undefined,
      preheader: r.text.slice(0, 90),
    });
    try {
      await this.mail.send({
        to: this.env.FEEDBACK_TO,
        subject: `Feedback: ${KIND_WORDS[r.kind]} (${where})`,
        ...body,
      });
    } catch (e) {
      this.logger.warn(`feedback ${r.id} kept, email failed: ${(e as Error).message}`);
    }
  }
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
