export interface NormalizedEvent {
  provider: string;
  eventType: string;
  externalEventId?: string;
  actor?: string;
  repository?: string;
  summary: string;
  payload: Record<string, unknown>;
}

export interface ProviderAction {
  type: string;
  config: Record<string, unknown>;
  input: Record<string, unknown>;
}

export interface ActionResult {
  success: boolean;
  output?: Record<string, unknown>;
  errorMessage?: string;
}

export interface IntegrationProvider {
  name: string;
  validateConfig(config: unknown): Promise<void>;
  verifyWebhookSignature(
    payload: unknown,
    headers: Record<string, string>,
    secret?: string,
  ): Promise<boolean>;
  normalizeWebhookEvent(
    payload: unknown,
    headers: Record<string, string>,
  ): Promise<NormalizedEvent>;
  executeAction(action: ProviderAction): Promise<ActionResult>;
}
