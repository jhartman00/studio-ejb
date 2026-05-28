"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";

const initialState: LoginState = {};

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction}>
      {state.error ? (
        <div className="form-error" role="alert">
          {state.error}
        </div>
      ) : null}
      <input type="hidden" name="next" value={next} />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
      />
      <button
        type="submit"
        className="btn btn-block"
        disabled={isPending}
        aria-disabled={isPending}
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
