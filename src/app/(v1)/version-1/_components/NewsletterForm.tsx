"use client";

import { FormEvent, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";

type NewsletterFormProps = {
  compact?: boolean;
  page: string;
};

export default function NewsletterForm({
  compact = false,
  page,
}: NewsletterFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      await addDoc(collection(db, "newsletter_signups"), {
        email: normalizedEmail,
        createdAt: serverTimestamp(),
        source: "web:newsletter",
        page,
      });
      setEmail("");
      setStatus("success");
      setMessage("Thank you — you’re on the list.");
    } catch (error) {
      console.error("Newsletter signup failed", error);
      setStatus("error");
      setMessage("We couldn’t add you right now. Please try again.");
    }
  };

  return (
    <>
      <form
        className={
          compact
            ? "mt-5 flex max-w-md items-center gap-3"
            : "mt-5 flex max-w-md flex-col gap-3 sm:flex-row sm:items-center"
        }
        onSubmit={handleSubmit}
      >
        <input
          type="email"
          aria-label="Newsletter email"
          autoComplete="email"
          placeholder="Your email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status !== "idle") {
              setStatus("idle");
              setMessage("");
            }
          }}
          required
          className={
            compact
              ? "h-10 w-full rounded-full border border-white/20 bg-transparent px-5 text-sm text-white placeholder:text-white/45 outline-none transition focus:border-white/40"
              : "h-11 w-full rounded-full border border-white/20 bg-transparent px-5 text-[16px] text-white outline-none transition placeholder:text-white/45 focus:border-white/40 sm:h-10 sm:text-sm"
          }
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className={
            compact
              ? "h-10 rounded-full bg-white px-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#40342F] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              : "h-11 rounded-full bg-white px-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#40342F] transition hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:h-10"
          }
        >
          {status === "loading" ? "Joining…" : "Join"}
        </button>
      </form>
      {message ? (
        <p
          className={`mt-3 max-w-md text-sm ${
            status === "success" ? "text-white/80" : "text-red-200"
          }`}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}
    </>
  );
}
