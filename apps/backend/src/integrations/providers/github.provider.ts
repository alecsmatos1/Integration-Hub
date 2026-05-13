import * as crypto from 'crypto';

export interface NormalizedEvent {
  provider: string;
  eventType: string;
  externalEventId?: string;
  actor?: string;
  repository?: string;
  summary: string;
  payload: Record<string, unknown>;
}

export class GitHubProvider {
  readonly name = 'github';

  async verifyWebhookSignature(
    rawBody: Buffer,
    headers: Record<string, string>,
    secret?: string,
  ): Promise<boolean> {
    if (!secret) return true;

    const signature = headers['x-hub-signature-256'];
    if (!signature) return false;

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const expected = `sha256=${hmac.digest('hex')}`;

    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  async normalizeWebhookEvent(
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<NormalizedEvent> {
    const eventType = headers['x-github-event'] ?? 'unknown';
    const externalEventId = headers['x-github-delivery'];
    const actor = (payload.sender as Record<string, unknown>)?.login as string | undefined;
    const repository = (payload.repository as Record<string, unknown>)?.full_name as string | undefined;

    return {
      provider: 'github',
      eventType,
      externalEventId,
      actor,
      repository,
      summary: `GitHub ${eventType} from ${actor ?? 'unknown'} on ${repository ?? 'unknown'}`,
      payload,
    };
  }
}
