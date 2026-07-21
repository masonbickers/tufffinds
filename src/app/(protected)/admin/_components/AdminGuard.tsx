"use client";

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

type AdminUserRecord = {
  active?: boolean;
  role?: string;
};

type AccessState = {
  message: string;
  status: "checking" | "allowed" | "denied" | "error";
  uid: string | null;
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
  const [authError, setAuthError] = useState("");
  const [access, setAccess] = useState<AccessState>({
    message: "",
    status: "checking",
    uid: null,
  });
  const [signOutError, setSignOutError] = useState("");

  useEffect(
    () =>
      onAuthStateChanged(
        auth,
        (nextUser) => {
          setUser(nextUser);
          setAuthReady(true);
          setAuthError("");
          setSignOutError("");
        },
        (error) => {
          console.error("Failed to determine admin sign-in status", error);
          setUser(null);
          setAuthReady(true);
          setAuthError(
            "Sign-in status could not be loaded. Please refresh and try again.",
          );
        },
      ),
    [],
  );

  useEffect(() => {
    if (!authReady || !user) {
      setAccess({ message: "", status: "checking", uid: null });
      return;
    }

    const uid = user.uid;
    setAccess({ message: "", status: "checking", uid });

    return onSnapshot(
      doc(db, "admin_users", uid),
      (snapshot) => {
        const record = snapshot.exists()
          ? (snapshot.data() as AdminUserRecord)
          : null;
        const allowed =
          record?.active === true && record?.role === "admin";

        setAccess({
          message: "",
          status: allowed ? "allowed" : "denied",
          uid,
        });
      },
      (error) => {
        console.error("Failed to verify admin access", error);
        setAccess({
          message:
            "Admin access could not be verified. Please try again or contact support.",
          status: "error",
          uid,
        });
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

  const checkingAccess =
    user && (access.uid !== user.uid || access.status === "checking");

  if (!authReady || checkingAccess) {
    return <AdminGateMessage title="Loading admin…" />;
  }

  if (!user) {
    return (
      <AdminGateMessage title="Admin sign in required">
        <p className="mt-4 text-sm leading-6 text-black/60">
          Sign in with an approved Tufffinds admin account to continue.
        </p>
        {authError ? (
          <p className="mt-3 text-sm text-[#9F3A2A]" role="alert">
            {authError}
          </p>
        ) : null}
        <AdminSignInOptions />
      </AdminGateMessage>
    );
  }

  if (access.status !== "allowed" || !adminSession) {
    return (
      <AdminGateMessage title="Access denied">
        <p className="mt-4 text-sm leading-6 text-black/60">
          This account is not authorised for the Tufffinds admin area.
        </p>
        {access.message ? (
          <p className="mt-3 text-sm text-[#9F3A2A]" role="alert">
            {access.message}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-6 rounded-full border border-[#40342F] px-6 py-3 text-sm font-semibold text-[#40342F]"
        >
          Sign out
        </button>
        {signOutError ? (
          <p className="mt-3 text-sm text-[#9F3A2A]" role="alert">
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
