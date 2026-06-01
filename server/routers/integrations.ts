import { publicProcedure, router } from "../_core/trpc";
import { integrations } from "../_core/integrations";

/**
 * Integration Status Router
 * 
 * Exposes integration health checks via tRPC
 * Used for:
 * - Admin dashboard status display
 * - Health check endpoints
 * - Debugging integration issues
 */
export const integrationsRouter = router({
  /**
   * Get current status of all integrations
   * Public endpoint - safe to expose
   */
  status: publicProcedure.query(() => {
    const status = integrations.getStatus();
    return {
      timestamp: status.timestamp.toISOString(),
      allHealthy: status.allHealthy,
      integrations: Object.entries(status.integrations).map(([key, integration]) => ({
        id: key,
        name: integration.name,
        status: integration.status,
        configured: integration.configured,
        required: integration.required,
        error: integration.error,
      })),
    };
  }),

  /**
   * Get detailed status of a specific integration
   */
  detail: publicProcedure
    .input((input: unknown) => {
      if (typeof input === "string") return input;
      throw new Error("Integration ID must be a string");
    })
    .query(({ input: integrationId }) => {
      const status = integrations.getStatus();
      const integration = status.integrations[integrationId];

      if (!integration) {
        throw new Error(`Unknown integration: ${integrationId}`);
      }

      return {
        id: integrationId,
        name: integration.name,
        status: integration.status,
        configured: integration.configured,
        required: integration.required,
        error: integration.error,
        lastChecked: integration.lastChecked?.toISOString(),
      };
    }),

  /**
   * Health check endpoint for monitoring
   * Returns 200 if all required integrations are healthy
   */
  healthCheck: publicProcedure.query(() => {
    const status = integrations.getStatus();
    const healthy = Object.values(status.integrations).every(
      (i) => i.status === "enabled" || !i.required
    );

    return {
      healthy,
      timestamp: status.timestamp.toISOString(),
      summary: {
        total: Object.keys(status.integrations).length,
        enabled: Object.values(status.integrations).filter(
          (i) => i.status === "enabled"
        ).length,
        disabled: Object.values(status.integrations).filter(
          (i) => i.status === "disabled"
        ).length,
        errors: Object.values(status.integrations).filter(
          (i) => i.status === "error"
        ).length,
      },
    };
  }),
});
