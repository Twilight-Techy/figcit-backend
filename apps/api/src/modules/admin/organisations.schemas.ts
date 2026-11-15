import { z } from 'zod';

/** Who pays for people's places (Developer Brief, Organisation seats). */
export const ORG_KINDS = [
  'university',
  'college',
  'school',
  'employer',
  'jobcentre',
  'programme',
  'other',
] as const;

/** An organisation code gives one of these: a Premium seat, or the six-week free pilot. */
export const ORG_PLANS = ['org_seat', 'pilot'] as const;

const codeSchema = z.object({
  code: z.string(),
  uses: z.number().int(),
  maxUses: z.number().int().nullable(),
  expiresAt: z.iso.datetime().nullable(),
});

export const organisationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: z.string(),
  plan: z.enum(ORG_PLANS),
  /** Members with an active place (support leads aside): what the organisation is invoiced for. */
  seatsUsed: z.number().int(),
  /** The seats the organisation agreed to pay for; null until staff set it. */
  seatsPurchased: z.number().int().nullable(),
  /** Trends are hidden for groups smaller than this. */
  anonymityFloor: z.number().int(),
  /** The people who see the organisation's dashboard (support leads). */
  leads: z.array(z.string()),
  codes: z.array(codeSchema),
  createdAt: z.iso.datetime(),
});
export type OrganisationDto = z.infer<typeof organisationSchema>;

export const organisationsSchema = z.object({ items: z.array(organisationSchema) });

export const newOrganisationSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    kind: z.enum(ORG_KINDS),
    plan: z.enum(ORG_PLANS).default('org_seat'),
    anonymityFloor: z.number().int().min(5).max(50).default(10),
  })
  .strict();

export const newCodeSchema = z
  .object({
    maxUses: z.number().int().min(1).max(100_000).optional(),
    days: z.number().int().min(1).max(730).default(365),
  })
  .strict();

export const issuedCodeSchema = codeSchema;

export const updateOrganisationSchema = z
  .object({
    seatsPurchased: z.number().int().min(0).max(100_000).nullable().optional(),
    anonymityFloor: z.number().int().min(5).max(50).optional(),
  })
  .strict();

export const newLeadSchema = z.object({ email: z.email().max(254) }).strict();

/** Invoices go draft, then sent, then paid; a draft or a sent one can be voided. */
export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'void'] as const;
export const INVOICE_INTERVALS = ['month', 'year'] as const;

export const invoiceSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  seats: z.number().int(),
  /** Pence per seat for the whole period, before VAT. */
  unitMinor: z.number().int(),
  amountMinor: z.number().int(),
  vatMinor: z.number().int(),
  totalMinor: z.number().int(),
  currency: z.string(),
  status: z.enum(INVOICE_STATUSES),
  note: z.string().nullable(),
  issuedAt: z.iso.datetime().nullable(),
  dueAt: z.iso.date().nullable(),
  paidAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type InvoiceDto = z.infer<typeof invoiceSchema>;
export const invoicesSchema = z.object({ items: z.array(invoiceSchema) });

export const newInvoiceSchema = z
  .object({
    periodStart: z.iso.date(),
    interval: z.enum(INVOICE_INTERVALS).default('month'),
    /** Defaults to the seats purchased, or else the seats in use. */
    seats: z.number().int().min(0).max(100_000).optional(),
    /** Defaults to the seat price: £10 a month or £100 a year, before VAT. */
    unitMinor: z.number().int().min(0).max(10_000_000).optional(),
    note: z.string().trim().max(300).optional(),
  })
  .strict();

export const invoiceStatusSchema = z.object({ status: z.enum(['sent', 'paid', 'void']) }).strict();
