"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_MAX_AGE,
  CURRENT_KID,
  comparePasswords,
  signSession,
} from "@/lib/auth";
import {
  clearLoginFailures,
  ipFromHeaders,
  isLoginLocked,
  rateLimit,
  recordLoginFailure,
} from "@/lib/ratelimit";

const GENERIC_ERROR = "We could not sign you in. Try again.";
const UNIFORM_DELAY_MS = 1000;

async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function originMatches(h: Headers): boolean {
  const host = h.get("host");
  if (!host) return false;
  const origin = h.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const ref = h.get("referer");
  if (!ref) return true; // Server Actions sometimes omit both; cookie SameSite=Strict still gates
  try {
    return new URL(ref).host === host;
  } catch {
    return false;
  }
}

export type LoginState = { error?: string; ok?: boolean };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const started = Date.now();
  const h = await headers();
  const ip = ipFromHeaders(h);

  // Wrap everything so every path — success, rate-limit, lockout, bad password,
  // system error — falls through to the uniform delay below. No early returns.
  let outcome: "success" | "failed" = "failed";
  let nextUrl = "/admin";
  try {
    if (originMatches(h)) {
      const ratelim = await rateLimit({
        bucket: "login",
        identifier: ip,
        windowSec: 60,
        max: 5,
      });

      const locked = await isLoginLocked(ip);

      const passwordRaw = formData.get("password");
      const password = typeof passwordRaw === "string" ? passwordRaw : "";
      const next = formData.get("next");
      if (typeof next === "string" && next.startsWith("/admin") && !next.startsWith("//")) {
        nextUrl = next;
      }

      const expected = process.env.ADMIN_PASSWORD ?? "";
      const passwordOk =
        password.length > 0 &&
        expected.length > 0 &&
        comparePasswords(password, expected);

      if (ratelim.ok && !locked && passwordOk) {
        await clearLoginFailures(ip);

        const token = signSession({
          kid: CURRENT_KID,
          iat: Math.floor(Date.now() / 1000),
        });

        const cookieStore = await cookies();
        cookieStore.set({
          name: ADMIN_COOKIE_NAME,
          value: token,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
          maxAge: ADMIN_MAX_AGE,
        });
        outcome = "success";
      } else if (ratelim.ok && !locked) {
        await recordLoginFailure(ip);
      }
    }
  } catch {
    outcome = "failed";
  }

  // Uniform 1s pad for every path: success, wrong password, system error.
  const elapsed = Date.now() - started;
  if (elapsed < UNIFORM_DELAY_MS) await sleep(UNIFORM_DELAY_MS - elapsed);

  if (outcome === "success") {
    redirect(nextUrl);
  }
  return { error: GENERIC_ERROR };
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  redirect("/admin/login");
}
