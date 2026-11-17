import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service.js';
import { noEmDashes } from '../../common/text/no-em-dash.js';
import { DEFAULT_CONTENT, type ContentBody, type ContentKey } from './catalogue/index.js';

const TTL_MS = 60_000;

export interface ContentEntry {
  readonly key: string;
  readonly kind: string;
  readonly version: number;
  readonly body: unknown;
}

/** Published content with built-in defaults underneath (SYSTEM_DESIGN §4.1 ContentModule). */
@Injectable()
export class ContentService {
  private cache: { at: number; release: number; items: Map<string, ContentEntry> } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async load(
    locale = 'en-GB',
  ): Promise<{ release: number; items: Map<string, ContentEntry> }> {
    if (this.cache && Date.now() - this.cache.at < TTL_MS) return this.cache;
    const rows = await this.prisma.contentItem.findMany({
      where: { status: 'published', locale },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
      select: { key: true, kind: true, version: true, body: true, releaseId: true },
    });
    const items = new Map<string, ContentEntry>();
    for (const [key, d] of Object.entries(DEFAULT_CONTENT))
      items.set(key, { key, kind: d.kind, version: 0, body: noEmDashes(d.body) });
    let release = 0;
    for (const r of rows) {
      release = Math.max(release, r.releaseId ?? 0);
      const current = items.get(r.key);
      if (!current || current.version < r.version)
        // FigCit's own words, as published or edited by staff: no em dashes (owner, 17 Nov 2026).
        items.set(r.key, {
          key: r.key,
          kind: r.kind,
          version: r.version,
          body: noEmDashes(r.body),
        });
    }
    this.cache = { at: Date.now(), release, items };
    return this.cache;
  }

  invalidate(): void {
    this.cache = null;
  }

  async get<K extends ContentKey>(key: K): Promise<ContentBody<K>> {
    return (await this.load()).items.get(key)?.body as ContentBody<K>;
  }

  async all(): Promise<{ release: number; items: ContentEntry[] }> {
    const { release, items } = await this.load();
    return { release, items: [...items.values()] };
  }
}
