export const PHONE_VERIFICATION_COOLDOWN_SECONDS: number;

export function normalizePhoneForVerification(input: {
  country?: unknown;
  phone?: unknown;
}):
  | {
      ok: true;
      e164: string;
      countryIso: string;
      countryCallingCode: string;
    }
  | {
      ok: false;
      error: string;
    };

export function getPhoneVerificationCooldown(
  sentAt?: string | null,
  now?: Date
): number;

export function redactPhoneNumber(phone?: unknown): string;

export function isTwilioVerifyAccepted(payload: unknown): boolean;

export function isTwilioVerifyApproved(payload: unknown): boolean;

export function safeTwilioSendError(input: {
  code?: number | string;
  status?: number;
  message?: string;
}): string;

export function safeTwilioCheckError(input: {
  code?: number | string;
  status?: number;
  message?: string;
}): string;
