"use client";

import { useEffect, useState } from "react";
import {
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithRedirect,
  type AuthProvider,
} from "firebase/auth";
import {
  auth,
  googleProvider,
  isFirebaseEmulatorEnabled,
  microsoftProvider,
} from "@/app/lib/firebase";
import styles from "../admin.module.css";

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
  "auth/unauthorized-domain":
    "Admin sign-in is not available on this domain yet. Ask an administrator to add it to Firebase authorized domains.",
  "auth/invalid-oauth-provider":
    "Microsoft sign-in is not configured correctly. Please contact the site administrator.",
  "auth/invalid-credential":
    "Microsoft sign-in could not be completed. Please try again.",
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

  useEffect(() => {
    void getRedirectResult(auth).catch((error: unknown) => {
      console.error("Admin sign in redirect failed", error);
      setMessage(getSafeSignInError(error));
      setSigningInWith(null);
    });
  }, []);

  const signIn = async (
    providerName: SignInProvider,
    provider: AuthProvider,
  ) => {
    if (signingInWith) return;

    setSigningInWith(providerName);
    setMessage("");

    try {
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error("Admin sign in failed", error);
      setMessage(getSafeSignInError(error));
      setSigningInWith(null);
    }
  };

  const signingIn = signingInWith !== null;

  return (
    <div className={styles.loginForm}>
      <div className={styles.providerGrid}>
        {isFirebaseEmulatorEnabled ? (
          <button
            type="button"
            disabled={signingIn}
            onClick={async () => {
              if (signingIn) return;
              setSigningInWith("google");
              setMessage("");
              try {
                await signInWithEmailAndPassword(
                  auth,
                  "admin@tufffinds.local",
                  "sample-admin-123",
                );
              } catch (error) {
                console.error("Sample admin sign in failed", error);
                setMessage(getSafeSignInError(error));
              } finally {
                setSigningInWith(null);
              }
            }}
            className={styles.primaryButton}
          >
            {signingIn ? "Signing in…" : "Use sample admin"}
          </button>
        ) : null}

        <button
          type="button"
          disabled={signingIn}
          onClick={() => signIn("microsoft", microsoftProvider)}
          className={styles.primaryButton}
        >
          {signingInWith === "microsoft"
            ? "Signing in with Microsoft…"
            : "Sign in with Microsoft"}
        </button>

        <button
          type="button"
          disabled={signingIn}
          onClick={() => signIn("google", googleProvider)}
          className={styles.secondaryButton}
        >
          {signingInWith === "google"
            ? "Signing in with Google…"
            : "Sign in with Google"}
        </button>
      </div>

      {message ? (
        <p className={styles.errorText} role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
