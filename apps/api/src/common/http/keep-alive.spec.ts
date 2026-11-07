import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEEP_ALIVE_MS, startKeepAlive } from './keep-alive.js';

const URL = 'https://api.example.test/v1/health';

describe('startKeepAlive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pings every 14 minutes, not at once', async () => {
    const ping = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    const timer = startKeepAlive(URL, ping);
    expect(KEEP_ALIVE_MS).toBe(840_000);
    expect(ping).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(KEEP_ALIVE_MS * 2);
    expect(ping).toHaveBeenCalledTimes(2);
    expect(ping.mock.calls[0]?.[0]).toBe(URL);
    clearInterval(timer);
  });

  it('keeps pinging after a failed ping', async () => {
    const ping = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(new Response(null, { status: 503 }));
    const timer = startKeepAlive(URL, ping);
    await vi.advanceTimersByTimeAsync(KEEP_ALIVE_MS * 2);
    expect(ping).toHaveBeenCalledTimes(2);
    clearInterval(timer);
  });
});
