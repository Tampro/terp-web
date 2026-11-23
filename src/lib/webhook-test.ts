/** TestResult of a webhook test delivery (WebhookService.test / PlatformWebhookService.test). */
export interface WebhookTestResult {
  delivered?: boolean
  statusCode?: number | null
  failure?: string | null
}

/**
 * A test delivery answers 200 even when the target refused it (delivered=false): turn that into an error so the
 * caller shows it instead of a success toast. `describe` builds the message (status code / failure reason).
 */
export function ensureDelivered(r: WebhookTestResult | undefined, describe: (r: WebhookTestResult) => string) {
  if (r && r.delivered === false) throw new Error(describe(r))
  return r
}
