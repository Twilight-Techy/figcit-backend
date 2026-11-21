import { Injectable } from '@nestjs/common';
import type { TesterSurvey } from '@prisma/client';
import { PrismaService } from '../../common/db/prisma.service.js';
import { NotFound } from '../../common/errors/errors.js';
import type { RequestUser } from '../../common/guards/request-user.js';
import { AuditService } from '../audit/audit.service.js';
import {
  FEATURES,
  QUESTIONS,
  type SurveyAnswers,
  type SurveyResponse,
  type SurveyState,
  type SurveySummary,
  type TESTIMONIAL_STATUSES,
} from './survey.schemas.js';

/** The prompt shows after this many check-ins, at a calm moment the app picks. */
export const AFTER_CHECK_INS = 3;
/** "Not now" asks again after this long, and at most this many times. */
export const LATER_MS = 3 * 24 * 3_600_000;
export const MAX_LATER = 2;
const LIST_LIMIT = 200;
const PUBLIC_LIMIT = 50;

const response = (r: TesterSurvey): SurveyResponse => ({
  id: r.id,
  navigation: r.navigation,
  checkIn: r.checkIn,
  fit: r.fit,
  accuracy: r.accuracy,
  overall: r.overall,
  comment: r.comment,
  favourites: known(r.favourites),
  askedAt: r.askedAt,
  appVersion: r.appVersion,
  testimonial: r.testimonial,
  testimonialPublic: r.testimonialPublic,
  testimonialName: r.testimonialName,
  testimonialStatus: r.testimonialStatus,
  updatedAt: r.updatedAt.toISOString(),
});

type Feature = (typeof FEATURES)[number];
/** Only parts the app still has: a removed one drops out of answers and counts. */
const known = (f: readonly string[]): Feature[] =>
  f.filter((x): x is Feature => (FEATURES as readonly string[]).includes(x));

/** How many picked each part, most picked first; parts nobody picked are left out. */
export function tally(
  answers: readonly (readonly string[])[],
): { feature: Feature; count: number }[] {
  return FEATURES.map((feature) => ({
    feature,
    count: answers.filter((a) => a.includes(feature)).length,
  }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** Average to one decimal and the count of each answer, 1 to 5. */
export function summarise(scores: readonly number[]): { average: number | null; counts: number[] } {
  const counts = [1, 2, 3, 4, 5].map((n) => scores.filter((s) => s === n).length);
  const average = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null;
  return { average, counts };
}

/** The tester survey (owner, 21 Nov 2026): answers, when to ask, and testimonials for staff. */
@Injectable()
export class SurveyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async state(userId: string, now = new Date()): Promise<SurveyState> {
    const [row, prompt, checkIns] = await Promise.all([
      this.prisma.testerSurvey.findUnique({ where: { userId } }),
      this.prisma.testerSurveyPrompt.findUnique({ where: { userId } }),
      // Counting stops at the number needed.
      this.prisma.checkIn.count({ where: { userId }, take: AFTER_CHECK_INS }),
    ]);
    const putOff = prompt !== null && (prompt.skips >= MAX_LATER || prompt.askAfter > now);
    return {
      answered: row !== null,
      dueAfterUse: row === null && !putOff && checkIns >= AFTER_CHECK_INS,
      answers: row
        ? {
            navigation: row.navigation,
            checkIn: row.checkIn,
            fit: row.fit,
            accuracy: row.accuracy,
            overall: row.overall,
            comment: row.comment,
            favourites: known(row.favourites),
            testimonial: row.testimonial,
            testimonialPublic: row.testimonialPublic,
            testimonialName: row.testimonialName,
          }
        : null,
    };
  }

  /** Saves the answers (replacing earlier ones). New or changed testimonial words wait for staff. */
  async answer(userId: string, a: SurveyAnswers): Promise<SurveyState> {
    const before = await this.prisma.testerSurvey.findUnique({ where: { userId } });
    const words = a.testimonial ?? null;
    const status = !words
      ? null
      : before?.testimonial === words && before.testimonialStatus
        ? before.testimonialStatus
        : 'pending';
    const data = {
      navigation: a.navigation,
      checkIn: a.checkIn,
      fit: a.fit,
      accuracy: a.accuracy,
      overall: a.overall,
      comment: a.comment ?? null,
      favourites: a.favourites,
      askedAt: a.askedAt,
      appVersion: a.appVersion ?? null,
      testimonial: words,
      testimonialPublic: words ? a.testimonialPublic : false,
      testimonialName: words ? (a.testimonialName ?? null) : null,
      testimonialStatus: status,
    };
    await this.prisma.testerSurvey.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.state(userId);
  }

  /** "Not now": asked again after a few days, and not after the second time. */
  async later(userId: string, now = new Date()): Promise<SurveyState> {
    const askAfter = new Date(now.getTime() + LATER_MS);
    await this.prisma.testerSurveyPrompt.upsert({
      where: { userId },
      create: { userId, skips: 1, askAfter },
      update: { skips: { increment: 1 }, askAfter },
    });
    return this.state(userId, now);
  }

  async summary(): Promise<SurveySummary> {
    const [all, items] = await Promise.all([
      this.prisma.testerSurvey.findMany({
        select: {
          navigation: true,
          checkIn: true,
          fit: true,
          accuracy: true,
          overall: true,
          favourites: true,
        },
      }),
      this.prisma.testerSurvey.findMany({ orderBy: { updatedAt: 'desc' }, take: LIST_LIMIT }),
    ]);
    const questions = Object.fromEntries(
      QUESTIONS.map((q) => [q, summarise(all.map((r) => r[q]))]),
    ) as SurveySummary['questions'];
    return {
      responses: all.length,
      questions,
      favourites: tally(all.map((r) => r.favourites)),
      items: items.map(response),
    };
  }

  async setTestimonial(
    actor: RequestUser,
    id: string,
    status: (typeof TESTIMONIAL_STATUSES)[number],
  ): Promise<SurveyResponse> {
    const found = await this.prisma.testerSurvey.findUnique({ where: { id } });
    if (!found?.testimonial) throw new NotFound('testimonial');
    const row = await this.prisma.testerSurvey.update({
      where: { id },
      data: { testimonialStatus: status },
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: 'staff',
      action: 'testimonial.status',
      targetType: 'tester_survey',
      targetId: id,
      meta: { status },
    });
    return response(row);
  }

  /** Approved words the person agreed to show, newest first: for the website. */
  async published(): Promise<{ items: { text: string; name: string | null; at: string }[] }> {
    const rows = await this.prisma.testerSurvey.findMany({
      where: { testimonialStatus: 'approved', testimonialPublic: true, testimonial: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: PUBLIC_LIMIT,
    });
    return {
      items: rows.map((r) => ({
        text: r.testimonial ?? '',
        name: r.testimonialName,
        at: r.updatedAt.toISOString(),
      })),
    };
  }
}
