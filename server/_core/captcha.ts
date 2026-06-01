/**
 * CAPTCHA verification using Cloudflare Turnstile
 * Protects /api/leads endpoint from bot abuse
 */

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface CaptchaVerifyResult {
  success: boolean;
  score?: number;
  errorCodes?: string[];
  message?: string;
}

/**
 * Verify a Turnstile CAPTCHA token
 * @param token - The token from the client-side Turnstile widget
 * @returns Verification result
 */
export async function verifyCaptchaToken(token: string): Promise<CaptchaVerifyResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // If no secret key, skip verification (development mode)
  if (!secretKey) {
    console.warn("TURNSTILE_SECRET_KEY not configured, skipping CAPTCHA verification");
    return {
      success: true,
      message: "CAPTCHA verification skipped (development mode)",
    };
  }

  // If no token provided, fail
  if (!token || typeof token !== "string") {
    return {
      success: false,
      errorCodes: ["missing-token"],
      message: "CAPTCHA token is required",
    };
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        errorCodes: ["verification-failed"],
        message: `Turnstile API error: ${response.status}`,
      };
    }

    const data = await response.json() as {
      success: boolean;
      score?: number;
      error_codes?: string[];
    };

    return {
      success: data.success,
      score: data.score,
      errorCodes: data.error_codes,
      message: data.success ? "CAPTCHA verified successfully" : "CAPTCHA verification failed",
    };
  } catch (error) {
    console.error("CAPTCHA verification error:", error);
    return {
      success: false,
      errorCodes: ["verification-error"],
      message: "Failed to verify CAPTCHA",
    };
  }
}

/**
 * Get the Turnstile site key for the client
 * @returns Site key for embedding in the form
 */
export function getTurnstileSiteKey(): string {
  const siteKey = process.env.VITE_TURNSTILE_SITE_KEY;
  if (!siteKey) {
    console.warn("VITE_TURNSTILE_SITE_KEY not configured");
    return "";
  }
  return siteKey;
}
