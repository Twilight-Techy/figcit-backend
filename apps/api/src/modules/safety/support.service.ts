import { Injectable } from '@nestjs/common';
import { CryptoService, type UserCipher } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { BadInput, NotFound } from '../../common/errors/errors.js';
import type {
  ContactDto,
  ContactInput,
  ContactUpdate,
  SupportPlanDto,
  SupportPlanInput,
} from './safety.schemas.js';

const MAX_CONTACTS = 5;

interface ContactRow {
  id: string;
  nameEnc: Uint8Array;
  phoneEnc: Uint8Array | null;
  emailEnc: Uint8Array | null;
  relationship: string | null;
  contactWhen: string[];
  consentConfirmedAt: Date | null;
  position: number;
}

function contactDto(c: ContactRow, cipher: UserCipher): ContactDto {
  return {
    id: c.id,
    name: cipher.dec(c.nameEnc),
    phone: cipher.decOpt(c.phoneEnc),
    email: cipher.decOpt(c.emailEnc),
    relationship: c.relationship,
    contactWhen: c.contactWhen,
    consentConfirmed: c.consentConfirmedAt !== null,
    position: c.position,
  };
}

/** The user's support plan and trusted contacts (S140–S146). All personal text is encrypted. */
@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async plan(userId: string): Promise<SupportPlanDto> {
    const row = await this.prisma.supportPlan.findUnique({ where: { userId } });
    if (!row)
      return {
        preferredRoutes: [],
        signs: null,
        whatHelps: null,
        whatToAvoid: null,
        messages: [],
        updatedAt: null,
      };
    const c = await this.crypto.forUser(userId);
    const messages = c.decOpt(row.messagesEnc);
    return {
      preferredRoutes: row.preferredRoutes,
      signs: c.decOpt(row.signsEnc),
      whatHelps: c.decOpt(row.whatHelpsEnc),
      whatToAvoid: c.decOpt(row.whatToAvoidEnc),
      messages: messages ? (JSON.parse(messages) as string[]) : [],
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async savePlan(userId: string, input: SupportPlanInput): Promise<SupportPlanDto> {
    const c = await this.crypto.forUser(userId);
    const existing = await this.prisma.supportPlan.findUnique({
      where: { userId },
      select: { clientUpdatedAt: true },
    });
    const clientAt = input.clientUpdatedAt ? new Date(input.clientUpdatedAt) : new Date();
    // Last write wins by the client's clock (offline edits, SYSTEM_DESIGN §8).
    if (existing && existing.clientUpdatedAt > clientAt) return this.plan(userId);
    const data = {
      ...(input.preferredRoutes !== undefined ? { preferredRoutes: input.preferredRoutes } : {}),
      ...(input.signs !== undefined ? { signsEnc: c.encOpt(input.signs) } : {}),
      ...(input.whatHelps !== undefined ? { whatHelpsEnc: c.encOpt(input.whatHelps) } : {}),
      ...(input.whatToAvoid !== undefined ? { whatToAvoidEnc: c.encOpt(input.whatToAvoid) } : {}),
      ...(input.messages !== undefined
        ? { messagesEnc: c.enc(JSON.stringify(input.messages)) }
        : {}),
      clientUpdatedAt: clientAt,
    };
    await this.prisma.supportPlan.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.plan(userId);
  }

  async contacts(userId: string): Promise<ContactDto[]> {
    const rows = await this.prisma.trustedContact.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    if (rows.length === 0) return [];
    const c = await this.crypto.forUser(userId);
    return rows.map((r) => contactDto(r, c));
  }

  async addContact(userId: string, input: ContactInput): Promise<ContactDto> {
    const c = await this.crypto.forUser(userId);
    if (input.id) {
      const existing = await this.prisma.trustedContact.findFirst({
        where: { id: input.id, userId },
      });
      if (existing) return contactDto(existing, c);
    }
    const count = await this.prisma.trustedContact.count({ where: { userId, deletedAt: null } });
    if (count >= MAX_CONTACTS)
      throw new BadInput(`You can keep up to ${String(MAX_CONTACTS)} trusted people.`);
    const row = await this.prisma.trustedContact.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        userId,
        nameEnc: c.enc(input.name),
        phoneEnc: c.encOpt(input.phone),
        emailEnc: c.encOpt(input.email),
        relationship: input.relationship ?? null,
        contactWhen: input.contactWhen,
        consentConfirmedAt: input.consentConfirmed ? new Date() : null,
        position: input.position ?? count,
      },
    });
    return contactDto(row, c);
  }

  async updateContact(userId: string, id: string, input: ContactUpdate): Promise<ContactDto> {
    const existing = await this.prisma.trustedContact.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new NotFound('trusted contact');
    const c = await this.crypto.forUser(userId);
    const phone = input.phone !== undefined ? input.phone : c.decOpt(existing.phoneEnc);
    const email = input.email !== undefined ? input.email : c.decOpt(existing.emailEnc);
    if (!phone && !email) throw new BadInput('Add a phone number or an email.');
    const row = await this.prisma.trustedContact.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { nameEnc: c.enc(input.name) } : {}),
        ...(input.phone !== undefined ? { phoneEnc: c.encOpt(input.phone) } : {}),
        ...(input.email !== undefined ? { emailEnc: c.encOpt(input.email) } : {}),
        ...(input.relationship !== undefined ? { relationship: input.relationship } : {}),
        ...(input.contactWhen !== undefined ? { contactWhen: input.contactWhen } : {}),
        ...(input.consentConfirmed !== undefined
          ? {
              consentConfirmedAt: input.consentConfirmed
                ? (existing.consentConfirmedAt ?? new Date())
                : null,
            }
          : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
      },
    });
    return contactDto(row, c);
  }

  async removeContact(userId: string, id: string): Promise<void> {
    const res = await this.prisma.trustedContact.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (res.count === 0) throw new NotFound('trusted contact');
  }
}
