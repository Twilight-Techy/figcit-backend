import { Injectable } from '@nestjs/common';
import { CryptoService, type UserCipher } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';

type Section = Record<string, unknown>;

/** Everything we hold about one user, decrypted, as plain JSON (UK GDPR Art. 15 and 20). */
@Injectable()
export class ExportBuilder {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async build(userId: string): Promise<Section> {
    const c = await this.crypto.forUser(userId);
    const parts = await Promise.all([
      this.account(userId, c),
      this.checkIns(userId, c),
      this.work(userId, c),
      this.words(userId, c),
      this.support(userId, c),
    ]);
    return {
      about:
        'Your FigCit data export. Codes (like E2M1 or anxious) are explained at https://figcit.co.uk/data-codes.',
      exportedAt: new Date().toISOString(),
      ...(Object.assign({}, ...parts) as Section),
    };
  }

  private async account(userId: string, c: UserCipher): Promise<Section> {
    const where = { userId };
    const [user, consents, entitlements, shares, safetyEvents] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { preferences: true } }),
      this.prisma.consent.findMany({
        where,
        orderBy: { at: 'asc' },
        select: { purpose: true, granted: true, source: true, at: true },
      }),
      this.prisma.entitlement.findMany({
        where,
        select: { planCode: true, source: true, status: true, startsAt: true, endsAt: true },
      }),
      this.prisma.share.findMany({
        where,
        select: {
          sections: true,
          rangeDays: true,
          createdAt: true,
          expiresAt: true,
          revokedAt: true,
          viewCount: true,
        },
      }),
      this.prisma.safetyEvent.findMany({
        where,
        select: { sourceModule: true, trigger: true, routeChosen: true, at: true },
      }),
    ]);
    return {
      account: {
        email: user.email,
        nickname: user.nickname,
        region: user.region,
        timezone: user.timezone,
        createdAt: user.createdAt,
        preferences: user.preferences,
        ageBand: user.ageBand,
        productUpdates: user.productUpdates,
        // Me and Life right now (ME-2, ME-3), as the user wrote them.
        profile: user.profileEnc ? (JSON.parse(c.dec(user.profileEnc)) as unknown) : null,
      },
      consents,
      plans: entitlements,
      shares,
      safetyEvents,
    };
  }

  private async checkIns(userId: string, c: UserCipher): Promise<Section> {
    const where = { userId };
    const [checkIns, recommendations, decisions, sessions] = await Promise.all([
      this.prisma.checkIn.findMany({
        where,
        include: { emotions: true, sensations: true, context: true, need: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.recommendation.findMany({
        where,
        select: {
          id: true,
          checkInId: true,
          light: true,
          cellId: true,
          primary: true,
          alternatives: true,
          patterns: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      // Engine v2 and v5.0 decisions (E-52): the check-in's input facts and the card it made. Standard
      // values only, never free text (E-04), so nothing in them is encrypted.
      this.prisma.decisionRecord.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          mode: true,
          rulesetHash: true,
          engineVersion: true,
          version: { select: { label: true } },
          input: true,
          card: true,
          trace: true,
          band: true,
          light: true,
          supportScreen: true,
          recheckOfId: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.pathwaySession.findMany({
        where,
        include: { feedback: true },
        orderBy: { startedAt: 'asc' },
      }),
    ]);
    return {
      checkIns: checkIns.map(({ need, context, userId: _u, ...ci }) => ({
        ...ci,
        context: context
          ? (({ ownLifeEventEnc, ...rest }) => ({
              ...rest,
              ownLifeEvent: c.decOpt(ownLifeEventEnc),
            }))(context)
          : null,
        need: need
          ? {
              needCode: need.needCode,
              ownWords: c.decOpt(need.ownWordsEnc),
              justSupport: need.justSupport,
              demandType: need.demandType,
              taskId: need.taskId,
              timelineCode: need.timelineCode,
              drivers: need.drivers,
            }
          : null,
      })),
      recommendations,
      decisions: decisions.map(({ version, ...d }) => ({ ...d, ruleset: version.label })),
      sessions,
    };
  }

  private async work(userId: string, c: UserCipher): Promise<Section> {
    const where = { userId };
    const [tasks, dumps, reminders] = await Promise.all([
      this.prisma.task.findMany({ where, include: { steps: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.dump.findMany({ where, include: { items: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.reminder.findMany({ where }),
    ]);
    return {
      tasks: tasks.map(({ titleEnc, steps, userId: _u, ...t }) => ({
        ...t,
        title: c.dec(titleEnc),
        steps: steps.map(({ textEnc, ...s }) => ({ ...s, text: c.dec(textEnc) })),
      })),
      dumps: dumps.map(({ items, userId: _u, ...d }) => ({
        ...d,
        items: items.map(({ textEnc, userId: _v, ...i }) => ({ ...i, text: c.dec(textEnc) })),
      })),
      reminders: reminders.map(({ labelEnc, userId: _u, ...r }) => ({
        ...r,
        label: c.decOpt(labelEnc),
      })),
    };
  }

  private async words(userId: string, c: UserCipher): Promise<Section> {
    const where = { userId };
    const [drafts, reflections, practices, commCards] = await Promise.all([
      this.prisma.draft.findMany({
        where,
        include: { versions: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.reflection.findMany({ where, orderBy: { createdAt: 'asc' } }),
      this.prisma.practice.findMany({ where }),
      this.prisma.commCard.findMany({ where, orderBy: { createdAt: 'asc' } }),
    ]);
    return {
      drafts: drafts.map(({ titleEnc, purposeEnc, versions, userId: _u, ...d }) => ({
        ...d,
        title: c.decOpt(titleEnc),
        purpose: c.decOpt(purposeEnc),
        versions: versions.map(({ bodyEnc, ...v }) => ({ ...v, body: c.dec(bodyEnc) })),
      })),
      reflections: reflections.map(({ answersEnc, takeawayEnc, userId: _u, ...r }) => ({
        ...r,
        answers: JSON.parse(c.dec(answersEnc)) as unknown,
        takeaway: c.decOpt(takeawayEnc),
      })),
      practices: practices.map(({ nameEnc, contentEnc, linkEnc, userId: _u, ...p }) => ({
        ...p,
        name: c.dec(nameEnc),
        content: c.decOpt(contentEnc),
        link: c.decOpt(linkEnc),
      })),
      commCards: commCards.map(({ textEnc, userId: _u, ...k }) => ({ ...k, text: c.dec(textEnc) })),
    };
  }

  private async support(userId: string, c: UserCipher): Promise<Section> {
    const [contacts, plan, survey] = await Promise.all([
      this.prisma.trustedContact.findMany({ where: { userId } }),
      this.prisma.supportPlan.findUnique({ where: { userId } }),
      this.prisma.testerSurvey.findUnique({ where: { userId } }),
    ]);
    return {
      trustedContacts: contacts.map((t) => ({
        name: c.dec(t.nameEnc),
        phone: c.decOpt(t.phoneEnc),
        email: c.decOpt(t.emailEnc),
        relationship: t.relationship,
        contactWhen: t.contactWhen,
        deletedAt: t.deletedAt,
      })),
      supportPlan: plan
        ? {
            preferredRoutes: plan.preferredRoutes,
            signs: c.decOpt(plan.signsEnc),
            whatHelps: c.decOpt(plan.whatHelpsEnc),
            whatToAvoid: c.decOpt(plan.whatToAvoidEnc),
            messages: c.decOpt(plan.messagesEnc),
          }
        : null,
      testerSurvey: survey ? (({ id: _i, userId: _u, ...answers }) => answers)(survey) : null,
    };
  }
}
