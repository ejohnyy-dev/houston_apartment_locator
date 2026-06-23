// Redact PII before logging: keep first character and domain, mask the rest.
// Prevents accidental email leakage in server logs (HAL-SEC-01).
export const redactEmail = (email: string): string =>
  email.replace(/(?<=.{1}).*?(?=@)/, "***");
