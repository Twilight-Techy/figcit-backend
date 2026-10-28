import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { BadInput, NotFound } from '../../common/errors/errors.js';
import { sendLinks } from '../content/catalogue/connect.js';
import { ContentService } from '../content/content.service.js';
import { SafetyService } from '../safety/safety.service.js';
import { SupportService } from '../safety/support.service.js';
import type {
  composedSchema,
  composeSchema,
  connectHomeSchema,
  groupInputSchema,
  groupSchema,
  starterSchema,
} from './connect.schemas.js';

type StarterDto = z.infer<typeof starterSchema>;

/** Connect: low-demand ways to reach someone. NUCCESS never sends; the phone's own apps do (D-20). */
@Injectable()
export class ConnectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly content: ContentService,
    private readonly support: SupportService,
    private readonly safety: SafetyService,
  ) {}

  async starters(userId: string): Promise<StarterDto[]> {
    const builtIn = await this.content.get('connect.starters');
    const own = await this.prisma.savedStarter.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const c = own.length ? await this.crypto.forUser(userId) : null;
    return [
      ...own.flatMap((s) =>
        c
          ? [{ id: s.id, text: c.dec(s.textEnc), kind: 'own', own: true, contactId: s.contactId }]
          : [],
      ),
      ...builtIn.map((s) => ({
        id: s.code,
        text: s.text,
        kind: s.kind,
        own: false,
        contactId: null,
      })),
    ];
  }

  async groups(userId: string): Promise<z.infer<typeof groupSchema>[]> {
    const rows = await this.prisma.connectGroup.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!rows.length) return [];
    const c = await this.crypto.forUser(userId);
    return rows.map((g) => ({
      id: g.id,
      kind: g.kind,
      name: c.dec(g.nameEnc),
      link: c.decOpt(g.linkEnc),
    }));
  }

  async home(userId: string): Promise<z.infer<typeof connectHomeSchema>> {
    const [contacts, starters, groups] = await Promise.all([
      this.support.contacts(userId),
      this.starters(userId),
      this.groups(userId),
    ]);
    return {
      contacts,
      starters,
      groups,
      rooms: { available: false, note: 'Body-doubling rooms and peer spaces are coming soon.' },
    };
  }

  async compose(
    userId: string,
    input: z.infer<typeof composeSchema>,
  ): Promise<z.infer<typeof composedSchema>> {
    const text = input.text ?? (await this.starterText(userId, input.starterCode));
    const match = await this.safety.check([input.text]);
    if (match)
      return { safety: true, crisisRoutes: await this.safety.flag(userId, 'connect', match) };
    const contact = await this.contactFor(userId, input.contactId);
    const savedStarterId =
      input.save && input.text
        ? await this.saveStarter(userId, input.text, contact?.id ?? null)
        : null;
    return {
      safety: false,
      text,
      contactName: contact?.name ?? null,
      links: sendLinks(text, contact?.phone ?? null, contact?.email ?? null),
      savedStarterId,
    };
  }

  private async starterText(userId: string, code: string | undefined): Promise<string> {
    const text = (await this.starters(userId)).find((s) => s.id === code)?.text;
    if (!text) throw new BadInput('That starter is not available.');
    return text;
  }

  private async contactFor(
    userId: string,
    id: string | undefined,
  ): Promise<Awaited<ReturnType<SupportService['contacts']>>[number] | null> {
    if (!id) return null;
    const contact = (await this.support.contacts(userId)).find((x) => x.id === id);
    if (!contact) throw new NotFound('trusted contact');
    return contact;
  }

  private async saveStarter(
    userId: string,
    text: string,
    contactId: string | null,
  ): Promise<string> {
    const c = await this.crypto.forUser(userId);
    return (
      await this.prisma.savedStarter.create({
        data: { userId, contactId, textEnc: c.enc(text) },
        select: { id: true },
      })
    ).id;
  }

  async removeStarter(userId: string, id: string): Promise<void> {
    const res = await this.prisma.savedStarter.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (res.count === 0) throw new NotFound('starter');
  }

  async addGroup(
    userId: string,
    input: z.infer<typeof groupInputSchema>,
  ): Promise<z.infer<typeof groupSchema>> {
    const c = await this.crypto.forUser(userId);
    const g = await this.prisma.connectGroup.create({
      data: { userId, kind: input.kind, nameEnc: c.enc(input.name), linkEnc: c.encOpt(input.link) },
    });
    return { id: g.id, kind: g.kind, name: input.name, link: input.link ?? null };
  }

  async removeGroup(userId: string, id: string): Promise<void> {
    const res = await this.prisma.connectGroup.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (res.count === 0) throw new NotFound('group');
  }
}
