import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type Env } from '../../common/config/env.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { BadInput, NotFound } from '../../common/errors/errors.js';
import { JobsService } from '../../platform/jobs/jobs.service.js';
import { StorageService } from '../../platform/storage/storage.service.js';
import { SafetyService } from '../safety/safety.service.js';

const TIMEOUT_MS = 120_000;

export interface TranscriptionDto {
  readonly id: string;
  readonly status: 'pending' | 'processing' | 'done' | 'failed';
  readonly text: string | null;
  readonly errorCode: string | null;
  readonly safety: boolean;
}

/**
 * Voice to text on our own whisper.cpp server (SYSTEM_DESIGN §4.3.5). The audio is deleted once
 * transcribed, and the text is screened like anything typed. Without a server the app types instead.
 */
@Injectable()
export class SpeechService {
  private readonly logger = new Logger('Speech');

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly storage: StorageService,
    private readonly jobs: JobsService,
    private readonly safety: SafetyService,
  ) {}

  get available(): boolean {
    return this.env.WHISPER_URL !== undefined;
  }

  async request(userId: string, fileId: string, purpose: string): Promise<TranscriptionDto> {
    const file = await this.prisma.storedFile.findFirst({
      where: { id: fileId, userId, purpose: 'transcription_input' },
    });
    if (!file) throw new NotFound('recording');
    if (file.status !== 'uploaded') throw new BadInput('The recording has not finished uploading.');
    const existing = await this.prisma.transcription.findUnique({ where: { fileId } });
    if (existing) return this.get(userId, existing.id);
    const t = await this.prisma.transcription.create({
      data: {
        userId,
        fileId,
        purpose,
        status: this.available ? 'pending' : 'failed',
        errorCode: this.available ? null : 'not_configured',
      },
    });
    if (this.available)
      await this.jobs
        .send('speech.transcribe', { id: t.id }, { singletonKey: t.id })
        .catch(() => undefined);
    return this.get(userId, t.id);
  }

  async get(userId: string, id: string): Promise<TranscriptionDto> {
    const t = await this.prisma.transcription.findFirst({ where: { id, userId } });
    if (!t) throw new NotFound('transcription');
    const c = await this.crypto.forUser(userId);
    return {
      id: t.id,
      status: t.status,
      text: c.decOpt(t.textEnc),
      errorCode: t.errorCode,
      safety: t.safetyFlag,
    };
  }

  /** Worker handler (`speech.transcribe`). */
  async transcribe(id: string): Promise<void> {
    const t = await this.prisma.transcription.findUnique({
      where: { id },
      include: { file: true },
    });
    if (!t?.file || t.status === 'done' || !this.env.WHISPER_URL) return;
    await this.prisma.transcription.update({ where: { id }, data: { status: 'processing' } });
    try {
      const audio = await this.storage.get(t.file.storageKey);
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(audio)], { type: t.file.contentType }), 'audio');
      form.append('response_format', 'json');
      const res = await fetch(`${this.env.WHISPER_URL.replace(/\/$/, '')}/inference`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`whisper ${String(res.status)}`);
      const text = ((await res.json()) as { text?: string }).text?.trim() ?? '';
      const c = await this.crypto.forUser(t.userId);
      const match = await this.safety.check([text]);
      if (match)
        await this.safety.record({
          userId: t.userId,
          sourceModule: `speech_${t.purpose}`,
          trigger: 'phrase',
          ruleId: match.ruleId,
          category: match.category,
        });
      await this.prisma.transcription.update({
        where: { id },
        data: {
          status: 'done',
          textEnc: c.enc(text),
          safetyFlag: match !== null,
          completedAt: new Date(),
        },
      });
      if (!t.keepAudio) {
        await this.storage.remove(t.file.storageKey);
        await this.prisma.storedFile.update({
          where: { id: t.file.id },
          data: { status: 'deleted', deletedAt: new Date() },
        });
      }
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error.message : String(error) },
        'transcription failed',
      );
      await this.prisma.transcription.update({
        where: { id },
        data: { status: 'failed', errorCode: 'transcribe_failed' },
      });
    }
  }
}
