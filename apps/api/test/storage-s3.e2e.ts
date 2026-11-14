// Files kept in an S3 bucket (STORAGE_DRIVER=s3): the app uploads and downloads straight to the
// bucket through presigned links. Signing needs no network, so this runs without a bucket.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApi, type Api } from './helpers.js';

const BUCKET = 'figcit-e2e-uploads';
let api: Api;

beforeAll(async () => {
  api = await bootApi({
    STORAGE_DRIVER: 's3',
    S3_ENDPOINT: 'https://s3.eu-west-2.amazonaws.com',
    S3_REGION: 'eu-west-2',
    S3_BUCKET: BUCKET,
    S3_ACCESS_KEY: 'AKIAE2EEXAMPLE',
    S3_SECRET_KEY: 'e2e-secret',
  });
});
afterAll(() => api.close());

describe('files in S3', () => {
  it("upload and download links point at the bucket's own host, for its owner only", async () => {
    const { token } = await api.signIn();
    const intent = await api.req<{
      fileId: string;
      upload: { url: string; method: string; headers: Record<string, string> };
    }>('POST', '/files/uploads', {
      token,
      body: { purpose: 'voice_note', contentType: 'audio/webm', sizeBytes: 5 },
    });
    expect(intent.status).toBe(201);
    const up = new URL(intent.body.upload.url);
    // The app's CSP allows just this host (NEXT_PUBLIC_STORAGE_URL), not every bucket in the region.
    expect(up.origin).toBe(`https://${BUCKET}.s3.eu-west-2.amazonaws.com`);
    expect(up.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(intent.body.upload.method).toBe('PUT');
    expect(intent.body.upload.headers['content-type']).toBe('audio/webm');

    // The app says the upload finished; then it can fetch a short-lived download link.
    const done = await api.req('POST', `/files/${intent.body.fileId}/complete`, { token });
    expect(done.status).toBe(204);
    const link = await api.req<{ url: string }>('GET', `/files/${intent.body.fileId}/url`, {
      token,
    });
    const down = new URL(link.body.url);
    expect(down.origin).toBe(`https://${BUCKET}.s3.eu-west-2.amazonaws.com`);
    expect(down.pathname).toBe(up.pathname);

    const other = await api.signIn();
    expect(
      (await api.req('GET', `/files/${intent.body.fileId}/url`, { token: other.token })).status,
    ).toBe(404);
  });
});
