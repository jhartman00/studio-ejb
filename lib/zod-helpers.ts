import { z } from "zod";

// @vercel/postgres returns BIGSERIAL columns as JavaScript strings to stay
// BigInt-safe. Server Actions receive the value back from client state and
// must accept either shape. Use these helpers in upsert/identifier schemas
// instead of `z.number().int()` directly.

// Optional, nullable id. Empty string and undefined become null. Anything
// else is coerced to Number; non-finite results become null.
export const optionalId = z
  .union([z.number(), z.string()])
  .nullable()
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  });

// Required id. Throws via zod if missing or unparseable.
export const requiredId = z
  .union([z.number(), z.string()])
  .transform((v, ctx) => {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "id must be a finite number" });
      return z.NEVER;
    }
    return n;
  });
