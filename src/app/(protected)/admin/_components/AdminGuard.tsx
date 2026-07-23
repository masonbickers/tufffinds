"use client";

import Image from "next/image";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth, db } from "@/app/lib/firebase";
import AdminSignInOptions from "./AdminSignInOptions";
import styles from "../admin.module.css";

type AdminUserRecord = {
  active?: boolean;
  role?: string;
};

type AdminSession = {
  signOut: () => Promise<void>;
  signOutError: string;
  user: User;
};

const AdminSessionContext = createContext<AdminSession | null>(null);

export function useAdminSession() {
  const session = useContext(AdminSessionContext);

  if (!session) {
    throw new Error("useAdminSession must be used inside AdminGuard");
  }

  return session;
}

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [adminReady, setAdminReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [signOutError, setSignOutError] = useState("");

  useEffect(
    () =>
      onAuthStateChanged(auth, (nextUser) => {
        setUser(nextUser);
        setAuthReady(true);
        setSignOutError("");
      }),
    [],
  );

  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      setAllowed(false);
      setAdminReady(true);
      setMessage("");
      return;
    }

    setAdminReady(false);
    setAllowed(false);
    setMessage("");

    return onSnapshot(
      doc(db, "admin_users", user.uid),
      (snapshot) => {
        const record = snapshot.exists()
          ? (snapshot.data() as AdminUserRecord)
          : null;
        setAllowed(Boolean(record?.active === true && record?.role === "admin"));
        setAdminReady(true);
      },
      (error) => {
        console.error("Failed to verify admin access", error);
        setAllowed(false);
        setMessage(
          "Admin access could not be verified. Please try again or contact support.",
        );
        setAdminReady(true);
      },
    );
  }, [authReady, user]);

  const handleSignOut = useCallback(async () => {
    setSignOutError("");

    try {
      await signOut(auth);
    } catch (error) {
      console.error("Admin sign out failed", error);
      setSignOutError("Sign out failed. Please try again.");
    }
  }, []);

  const adminSession = useMemo(
    () => (user ? { signOut: handleSignOut, signOutError, user } : null),
    [handleSignOut, signOutError, user],
  );

  if (!authReady || !adminReady) {
    return <AdminGateMessage title="Loading admin…" />;
  }

  if (!user) {
    return (
      <AdminGateMessage
        title="Admin sign in"
        eyebrow="Private workspace"
        description="Continue with an authorised Tufffinds work account."
      >
        <AdminSignInOptions />
      </AdminGateMessage>
    );
  }

  if (!allowed || !adminSession) {
    return (
      <AdminGateMessage
        title="Access denied"
        eyebrow="Private workspace"
        description="This account is not authorised to use the admin workspace."
      >
        <p className={styles.helperText}>
          This account does not have an active admin_users record.
        </p>
        {message ? (
          <p className={styles.errorText} role="alert">
            {message}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleSignOut}
          className={styles.secondaryButton}
        >
          Sign out
        </button>
        {signOutError ? (
          <p className={styles.errorText} role="alert">
            {signOutError}
          </p>
        ) : null}
      </AdminGateMessage>
    );
  }

  return (
    <AdminSessionContext.Provider value={adminSession}>
      {children}
    </AdminSessionContext.Provider>
  );
}

function AdminGateMessage({
  children,
  description,
  eyebrow = "Tufffinds admin",
  title,
}: {
  children?: React.ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <main className={styles.loginShell}>
      <div className={styles.loginWrap}>
        <div className={styles.logoWrap}>
          <Image
            src="/finallogobrown.png"
            alt="Tufffinds"
            fill
            sizes="(max-width: 640px) 78vw, 460px"
            priority
            unoptimized
            className={styles.logo}
          />
        </div>

        <section className={styles.loginPanel}>
          <div className={styles.loginCopy}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1 className={styles.title}>{title}</h1>
            {description ? (
              <p className={styles.description}>{description}</p>
            ) : null}
          </div>

          {children}
        </section>

        <p className={styles.loginFooter}>
          © {new Date().getFullYear()} Tufffinds · Authorised team access only
        </p>
      </div>
    </main>
  );
}
