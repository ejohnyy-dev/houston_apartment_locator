/**
 * Centralized Integration Manager
 * 
 * Manages all external service integrations:
 * - RentCast API (apartment data)
 * - HubSpot (lead capture)
 * - Google Sheets (lead sync)
 * 
 * Benefits:
 * - Single source of truth for integration status
 * - Graceful fallbacks when services are unavailable
 * - Environment validation on startup
 * - Detailed health checks
 */

import { ENV } from "./env";

export type IntegrationStatus = "enabled" | "disabled" | "error";

export interface IntegrationHealth {
  name: string;
  status: IntegrationStatus;
  configured: boolean;
  required: boolean;
  error?: string;
  lastChecked?: Date;
}

export interface IntegrationsStatus {
  timestamp: Date;
  allHealthy: boolean;
  integrations: Record<string, IntegrationHealth>;
}

class IntegrationManager {
  private lastHealthCheck: Date | null = null;
  private healthCache: IntegrationsStatus | null = null;
  private healthCacheTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get current status of all integrations
   */
  getStatus(): IntegrationsStatus {
    // Return cached status if fresh
    if (
      this.healthCache &&
      this.lastHealthCheck &&
      Date.now() - this.lastHealthCheck.getTime() < this.healthCacheTTL
    ) {
      return this.healthCache;
    }

    const integrations: Record<string, IntegrationHealth> = {
      rentcast: this.checkRentCast(),
      hubspot: this.checkHubSpot(),
      googleSheets: this.checkGoogleSheets(),
    };

    const allHealthy = Object.values(integrations).every(
      (i) => i.status === "enabled" || !i.required
    );

    this.healthCache = {
      timestamp: new Date(),
      allHealthy,
      integrations,
    };
    this.lastHealthCheck = new Date();

    return this.healthCache;
  }

  /**
   * Check RentCast API configuration
   */
  private checkRentCast(): IntegrationHealth {
    const apiKey = process.env.RENTCAST_API_KEY?.trim();
    const configured = !!apiKey && apiKey.length > 0;

    if (!configured) {
      return {
        name: "RentCast API",
        status: "disabled",
        configured: false,
        required: false,
        error: "RENTCAST_API_KEY not configured",
      };
    }

    // Validate API key format (typically 32-char hex)
    if (!/^[a-f0-9]{32}$/i.test(apiKey)) {
      return {
        name: "RentCast API",
        status: "error",
        configured: true,
        required: false,
        error: "RENTCAST_API_KEY format invalid (expected 32-char hex)",
      };
    }

    return {
      name: "RentCast API",
      status: "enabled",
      configured: true,
      required: false,
    };
  }

  /**
   * Check HubSpot configuration
   */
  private checkHubSpot(): IntegrationHealth {
    const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim();
    const configured = !!token && token.length > 0;

    if (!configured) {
      return {
        name: "HubSpot",
        status: "disabled",
        configured: false,
        required: true,
        error: "HUBSPOT_PRIVATE_APP_TOKEN not configured",
      };
    }

    // HubSpot tokens are typically long strings starting with "pat-"
    if (!token.startsWith("pat-") && token.length < 20) {
      return {
        name: "HubSpot",
        status: "error",
        configured: true,
        required: true,
        error: "HUBSPOT_PRIVATE_APP_TOKEN format invalid",
      };
    }

    return {
      name: "HubSpot",
      status: "enabled",
      configured: true,
      required: true,
    };
  }

  /**
   * Check Google Sheets configuration
   */
  private checkGoogleSheets(): IntegrationHealth {
    const endpoint = process.env.GOOGLE_SHEETS_ENDPOINT?.trim();
    const configured = !!endpoint && endpoint.length > 0;

    if (!configured) {
      return {
        name: "Google Sheets",
        status: "disabled",
        configured: false,
        required: false,
        error: "GOOGLE_SHEETS_ENDPOINT not configured",
      };
    }

    // Validate URL format
    try {
      new URL(endpoint);
      return {
        name: "Google Sheets",
        status: "enabled",
        configured: true,
        required: false,
      };
    } catch {
      return {
        name: "Google Sheets",
        status: "error",
        configured: true,
        required: false,
        error: "GOOGLE_SHEETS_ENDPOINT is not a valid URL",
      };
    }
  }

  /**
   * Check if RentCast is available
   */
  isRentCastEnabled(): boolean {
    return this.checkRentCast().status === "enabled";
  }

  /**
   * Check if HubSpot is available
   */
  isHubSpotEnabled(): boolean {
    return this.checkHubSpot().status === "enabled";
  }

  /**
   * Check if Google Sheets is available
   */
  isGoogleSheetsEnabled(): boolean {
    return this.checkGoogleSheets().status === "enabled";
  }

  /**
   * Validate all required integrations on startup
   * Throws error if any required integration is misconfigured
   */
  validateRequired(): void {
    const status = this.getStatus();
    const errors: string[] = [];

    for (const [key, integration] of Object.entries(status.integrations)) {
      if (integration.required && integration.status !== "enabled") {
        errors.push(`${integration.name}: ${integration.error || "not configured"}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Required integrations are not configured:\n${errors.join("\n")}`
      );
    }
  }

  /**
   * Log integration status on startup
   */
  logStatus(): void {
    const status = this.getStatus();
    console.log("\n=== Integration Status ===");
    for (const integration of Object.values(status.integrations)) {
      const icon = integration.status === "enabled" ? "✓" : "✗";
      const required = integration.required ? "[REQUIRED]" : "[OPTIONAL]";
      console.log(
        `${icon} ${integration.name} ${required}: ${integration.status}`
      );
      if (integration.error) {
        console.log(`  └─ ${integration.error}`);
      }
    }
    console.log(`\nAll systems healthy: ${status.allHealthy ? "YES" : "NO"}\n`);
  }
}

// Singleton instance
export const integrations = new IntegrationManager();

/**
 * Initialize integrations on server startup
 */
export function initializeIntegrations(): void {
  try {
    integrations.validateRequired();
    integrations.logStatus();
  } catch (error) {
    console.error("Integration validation failed:", error);
    process.exit(1);
  }
}
