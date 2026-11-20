import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service.js';
import { AppError, BadInput, NotFound } from '../../common/errors/errors.js';
import { StorageService, type PresignedUpload } from '../../platform/storage/storage.service.js';

export const UPLOAD_RULES = {
  practice_audio: { maxBytes: 25 * 1024 * 1024, types: /^audio\// },
  voice_note: { maxBytes: 10 * 1024 * 1024, types: /^audio\// },
  transcription_input: {
    maxBytes: 20 * 1024 * 1024,
    types: /^audio\/(webm|ogg|mp4|mpeg|wav|x-m4a|aac)/,
  },
  // A screenshot sent with tester feedback; kept while the report is.
  feedback_screenshot: { maxBytes: 5 * 1024 * 1024, types: /^image\/(png|jpeg|webp)$/ },
} as const;
export type UploadPurpose = keyof typeof UPLOAD_RULES;
/** Kept once uploaded, not removed after a day. */
const KEPT = new Set<string>(['practice_audio', 'feedback_screenshot']);

/** Upload intents and signed links over StorageService. Bytes go straight to storage. */
@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async createUpload(
    userId: string,
    purpose: UploadPurpose,
    contentType: string,
    sizeBytes: number,
  ): Promise<{ fileId: string; upload: PresignedUpload }> {
    const rule = UPLOAD_RULES[purpose];
    if (!rule.types.test(contentType))
      throw new BadInput(`That file type can't be used here (${contentType}).`);
    if (sizeBytes > rule.maxBytes)
      throw new AppError(
        413,
        'too_large',
        'That file is too big',
        `Up to ${String(Math.round(rule.maxBytes / 1_048_576))} MB.`,
      );
    const id = randomUUID();
    const key = `${purpose}/${userId}/${id}`;
    await this.prisma.storedFile.create({
      data: {
        id,
        userId,
        purpose,
        storageKey: key,
        contentType,
        maxBytes: rule.maxBytes,
        expiresAt: new Date(Date.now() + 24 * 3_600_000),
      },
    });
    return { fileId: id, upload: await this.storage.presignUpload(key, contentType) };
  }

  /** Local driver only: receives the bytes a presigned PUT carries. */
  async receiveLocal(key: string, body: Buffer, contentType: string): Promise<void> {
    const file = await this.prisma.storedFile.findUnique({ where: { storageKey: key } });
    if (!file || file.status === 'deleted') throw new NotFound('upload');
    if (body.length > file.maxBytes)
      throw new AppError(413, 'too_large', 'That file is too big', 'Try a shorter recording.');
    await this.storage.put(key, body, contentType || file.contentType);
    await this.prisma.storedFile.update({
      where: { id: file.id },
      data: {
        status: 'uploaded',
        sizeBytes: body.length,
        uploadedAt: new Date(),
        expiresAt: KEPT.has(file.purpose) ? null : file.expiresAt,
      },
    });
  }

  async markUploaded(userId: string, fileId: string): Promise<void> {
    const res = await this.prisma.storedFile.updateMany({
      where: { id: fileId, userId },
      data: { status: 'uploaded', uploadedAt: new Date() },
    });
    if (res.count === 0) throw new NotFound('file');
  }

  async downloadUrl(userId: string, fileId: string): Promise<string> {
    const file = await this.prisma.storedFile.findFirst({
      where: { id: fileId, userId, status: 'uploaded' },
    });
    if (!file) throw new NotFound('file');
    return this.storage.presignDownload(file.storageKey);
  }

  async contentTypeOf(key: string): Promise<string> {
    return (
      (
        await this.prisma.storedFile.findUnique({
          where: { storageKey: key },
          select: { contentType: true },
        })
      )?.contentType ?? 'application/octet-stream'
    );
  }
}
