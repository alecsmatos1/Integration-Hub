import * as crypto from 'crypto';
import { GitHubProvider } from './github.provider.js';

describe('GitHubProvider', () => {
  let provider: GitHubProvider;

  beforeEach(() => {
    provider = new GitHubProvider();
  });

  // -- verifyWebhookSignature ------------------------------------------------

  describe('verifyWebhookSignature', () => {
    const body = Buffer.from(JSON.stringify({ action: 'pushed' }));
    const secret = 'test-secret';

    function sign(buf: Buffer, s: string): string {
      return 'sha256=' + crypto.createHmac('sha256', s).update(buf).digest('hex');
    }

    it('returns true when no secret is configured', async () => {
      expect(await provider.verifyWebhookSignature(body, {}, undefined)).toBe(true);
    });

    it('returns false when secret is set but header is missing', async () => {
      expect(await provider.verifyWebhookSignature(body, {}, secret)).toBe(false);
    });

    it('returns false for a wrong signature', async () => {
      const headers = { 'x-hub-signature-256': 'sha256=badhash' };
      expect(await provider.verifyWebhookSignature(body, headers, secret)).toBe(false);
    });

    it('returns true for a correct signature', async () => {
      const headers = { 'x-hub-signature-256': sign(body, secret) };
      expect(await provider.verifyWebhookSignature(body, headers, secret)).toBe(true);
    });

    it('returns false when signature length mismatches (prevents padding attack)', async () => {
      const headers = { 'x-hub-signature-256': 'sha256=' };
      expect(await provider.verifyWebhookSignature(body, headers, secret)).toBe(false);
    });
  });

  // -- normalizeWebhookEvent -------------------------------------------------

  describe('normalizeWebhookEvent', () => {
    it('extracts event type from x-github-event header', async () => {
      const result = await provider.normalizeWebhookEvent(
        {},
        { 'x-github-event': 'push', 'x-github-delivery': 'abc123' },
      );
      expect(result.eventType).toBe('push');
      expect(result.externalEventId).toBe('abc123');
      expect(result.provider).toBe('github');
    });

    it('defaults to "unknown" when x-github-event is missing', async () => {
      const result = await provider.normalizeWebhookEvent({}, {});
      expect(result.eventType).toBe('unknown');
    });

    it('extracts actor from sender.login', async () => {
      const payload = { sender: { login: 'octocat' }, repository: { full_name: 'org/repo' } };
      const result = await provider.normalizeWebhookEvent(payload, { 'x-github-event': 'push' });
      expect(result.actor).toBe('octocat');
      expect(result.repository).toBe('org/repo');
    });

    it('builds a descriptive summary', async () => {
      const payload = { sender: { login: 'alice' }, repository: { full_name: 'alice/project' } };
      const result = await provider.normalizeWebhookEvent(payload, { 'x-github-event': 'pull_request' });
      expect(result.summary).toContain('pull_request');
      expect(result.summary).toContain('alice');
      expect(result.summary).toContain('alice/project');
    });

    it('falls back to "unknown" placeholders when actor and repo are absent', async () => {
      const result = await provider.normalizeWebhookEvent({}, { 'x-github-event': 'ping' });
      expect(result.actor).toBeUndefined();
      expect(result.repository).toBeUndefined();
      expect(result.summary).toContain('unknown');
    });
  });
});
