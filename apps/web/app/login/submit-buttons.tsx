"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

import { signInWithPassword, signUpWithPassword } from "../auth/actions";

function LoadingSpinner() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        d="M4 12a8 8 0 0 1 8-8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="4"
      />
    </svg>
  );
}

export function LoginSubmitButtons() {
  const { pending } = useFormStatus();
  const [intent, setIntent] = useState<"login" | "signup" | null>(null);

  const isLoggingIn = pending && intent === "login";
  const isSigningUp = pending && intent === "signup";

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Button
        formAction={signInWithPassword}
        disabled={pending}
        aria-busy={isLoggingIn}
        onClick={() => setIntent("login")}
      >
        {isLoggingIn ? (
          <>
            <LoadingSpinner />
            登录中
          </>
        ) : (
          "登录"
        )}
      </Button>
      <Button
        formAction={signUpWithPassword}
        variant="outline"
        disabled={pending}
        aria-busy={isSigningUp}
        onClick={() => setIntent("signup")}
      >
        {isSigningUp ? (
          <>
            <LoadingSpinner />
            注册中
          </>
        ) : (
          "注册"
        )}
      </Button>
    </div>
  );
}
