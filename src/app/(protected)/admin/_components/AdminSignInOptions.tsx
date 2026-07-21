"use client";

import { useState } from "react";
import { signInWithPopup, type AuthProvider } from "firebase/auth";
import {
  auth,
  googleProvider,
  microsoftProvider,
} from "@/app/lib/firebase";

type SignInProvider = "microsoft" | "google";

const SIGN_IN_ERRORS: Record<string, string> = {
  "auth/account-exists-with-different-credential":
    "This email is already linked to another sign-in method. Use the option originally linked to the account.",
  "auth/cancelled-popup-request":
    "Another sign-in attempt is already in progress.",
  "auth/network-request-failed":
    "The sign-in service could not be reached. Check your connection and try again.",
  "auth/operation-not-allowed":
    "This sign-in option is not available yet. Please contact the site administrator.",
  "auth/popup-blocked":
    "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/unauthorized-domain":
    "Admin sign-in is not available on this domain yet.",
  "auth/user-disabled": "This account cannot sign in. Please contact the site administrator.",
};

function getSafeSignInError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return SIGN_IN_ERRORS[error.code] ?? "Sign in failed. Please try again.";
  }

  return "Sign in failed. Please try again.";
}

export default function AdminSignInOptions() {
  const [signingInWith, setSigningInWith] = useState<SignInProvider | null>(
    null,
  );
  const [message, setMessage] = useState("");

  const signIn = async (
    providerName: SignInProvider,
    provider: AuthProvider,
  ) => {
    if (signingInWith) return;

    setSigningInWith(providerName);
    setMessage("");

    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Admin sign in failed", error);
      setMessage(getSafeSignInError(error));
    } finally {
      setSigningInWith(null);
    }
  };

  const signingIn = signingInWith !== null;

  return (
    <div className="mt-8 max-w-sm">
      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={signingIn}
          onClick={() => signIn("microsoft", microsoftProvider)}
          className="w-full rounded-full bg-[#40342F] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#40342F]/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {signingInWith === "microsoft"
            ? "Signing in with Microsoft…"
            : "Sign in with Microsoft"}
        </button>

        <button
          type="button"
          disabled={signingIn}
          onClick={() => signIn("google", googleProvider)}
          className="w-full rounded-full border border-[#40342F] bg-transparent px-6 py-3 text-sm font-semibold text-[#40342F] transition hover:bg-[#40342F]/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {signingInWith === "google"
            ? "Signing in with Google…"
            : "Sign in with Google"}
        </button>
      </div>

      {message ? (
        <p className="mt-4 text-sm text-[#9F3A2A]" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
