"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth, db, googleProvider } from "@/app/lib/firebase";

type AdminUserRecord = {
  active?: boolean;
  role?: string;
};

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [adminReady, setAdminReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(auth, (nextUser) => {
        setUser(nextUser);
        setAuthReady(true);
      }),
    [],
  );

  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      setAllowed(false);
      setAdminReady(true);
      return;
    }

    setAdminReady(false);
    setMessage("");

    return onSnapshot(
      doc(db, "admin_users", user.uid),
      (snapshot) => {
        const record = snapshot.exists()
          ? (snapshot.data() as AdminUserRecord)
          : null;
        setAllowed(Boolean(record?.active && record?.role === "admin"));
        setAdminReady(true);
      },
      (error) => {
        console.error("Failed to verify admin access", error);
        setAllowed(false);
        setMessage("Admin access could not be verified.");
        setAdminReady(true);
      },
    );
  }, [authReady, user]);

  if (!authReady || !adminReady) {
    return <AdminGateMessage title="Loading admin…" />;
  }

  if (!user) {
    return (
      <AdminGateMessage title="Admin sign in required">
        <button
          type="button"
          disabled={signingIn}
          onClick={async () => {
            setSigningIn(true);
            setMessage("");
            try {
              await signInWithPopup(auth, googleProvider);
            } catch (error) {
              console.error("Admin sign in failed", error);
              setMessage("Sign in failed. Please try again.");
            } finally {
              setSigningIn(false);
            }
          }}
          className="mt-6 rounded-full bg-[#40342F] px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {signingIn ? "Signing in…" : "Sign in with Google"}
        </button>
        {message ? <p className="mt-4 text-sm text-[#9F3A2A]">{message}</p> : null}
      </AdminGateMessage>
    );
  }

  if (!allowed) {
    return (
      <AdminGateMessage title="Access denied">
        <p className="mt-4 text-sm text-black/60">
          This account does not have an active admin_users record.
        </p>
        {message ? <p className="mt-3 text-sm text-[#9F3A2A]">{message}</p> : null}
        <button
          type="button"
          onClick={() => signOut(auth)}
          className="mt-6 rounded-full border border-[#40342F] px-6 py-3 text-sm font-semibold text-[#40342F]"
        >
          Sign out
        </button>
      </AdminGateMessage>
    );
  }

  return children;
}

function AdminGateMessage({
  children,
  title,
}: {
  children?: React.ReactNode;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-[#F3EEE6] px-6 py-12 text-[#241E1A]">
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#D8C9B7] bg-white/80 p-10">
        <p className="text-[11px] uppercase tracking-[0.3em] text-black/45">
          Tufffinds admin
        </p>
        <h1 className="mt-4 font-serif text-4xl">{title}</h1>
        {children}
      </div>
    </main>
  );
}
