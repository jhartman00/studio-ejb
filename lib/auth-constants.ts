// Edge-safe constants. No node: imports, so middleware can import freely.
export const ADMIN_COOKIE_PROD = "__Host-sejb_admin";
export const ADMIN_COOKIE_DEV = "sejb_admin_dev";
export const ADMIN_MAX_AGE = 60 * 60 * 24 * 30;
export const CURRENT_KID = 1;

export function adminCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? ADMIN_COOKIE_PROD
    : ADMIN_COOKIE_DEV;
}
