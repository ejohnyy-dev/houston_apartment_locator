// Primary sink: Google Sheets → GAS v5 → poller → CRM (pull-mode).
// Direct CRM push via CRM_WEBHOOK_URL was removed per PULL_MODE_CUTOVER.md;
// the Mac mini poller handles the Sheets → CRM handoff without a tunnel.
export const SINK_ENV = {
  sheets: "GOOGLE_SHEETS_ENDPOINT",
} as const;

export type SinkName = keyof typeof SINK_ENV;
export type LeadSinkName = "sheets";
export type SinkPresence = Record<SinkName, boolean>;
export type LeadSinkResults = Record<LeadSinkName, boolean | null>;

export function getSinkPresence(env: NodeJS.ProcessEnv = process.env): SinkPresence {
  return Object.fromEntries(
    Object.entries(SINK_ENV).map(([name, envVar]) => [name, Boolean(env[envVar]?.trim())])
  ) as SinkPresence;
}

export function getConfigHealth(env: NodeJS.ProcessEnv = process.env): {
  status: "ok" | "degraded" | "no-sinks";
  sinks: SinkPresence;
  leadCaptureReady: boolean;
} {
  const sinks = getSinkPresence(env);
  const sheetsReady = sinks.sheets;

  return {
    status: sheetsReady ? "ok" : "no-sinks",
    sinks,
    leadCaptureReady: sheetsReady,
  };
}

export function logSinkHealth(): void {
  const { sinks } = getConfigHealth();
  if (sinks.sheets) {
    console.log("[config] Lead sink configured: sheets → GAS v5 → poller → CRM");
  } else {
    console.warn("[config] DEGRADED: GOOGLE_SHEETS_ENDPOINT not set. Leads cannot be persisted.");
  }
}

export function hasSuccessfulLeadSink(results: LeadSinkResults): boolean {
  return Object.values(results).some(result => result === true);
}

export function failedLeadSinks(results: LeadSinkResults): LeadSinkName[] {
  return (Object.entries(results) as [LeadSinkName, boolean | null][])
    .filter(([, result]) => result === false)
    .map(([sink]) => sink);
}
