// src/app/home.js
"use client";

import { useEffect, useState } from "react";
import { auth, db, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, onSnapshot } from "firebase/firestore";

export default function Home() {
  const [user, setUser] = useState(null);
  const [text, setText] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    const u1 = onAuthStateChanged(auth, setUser);
    const u2 = onSnapshot(collection(db, "items"), (snap) =>
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      u1();
      u2();
    };
  }, []);

  return (
    <main style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Next.js + Firebase (simple demo)</h1>

      {!user ? (
        <button onClick={() => signInWithPopup(auth, googleProvider)}>
          Sign in with Google
        </button>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "1rem 0" }}>
          {/* Using <img> here avoids next/image remote domain config for Google photos */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={user.photoURL || ""}
            alt={user.displayName || "User avatar"}
            width={28}
            height={28}
            style={{ borderRadius: 999 }}
          />
          <span>{user.displayName}</span>
          <button onClick={() => signOut(auth)}>Sign out</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add item"
          style={{ flex: 1, padding: 8 }}
        />
        <button
          onClick={() =>
            text &&
            addDoc(collection(db, "items"), { text })
              .then(() => setText(""))
              .catch(console.error)
          }
        >
          Add
        </button>
      </div>

      <ul style={{ marginTop: 16 }}>
        {items.map((i) => (
          <li key={i.id}>{i.text}</li>
        ))}
      </ul>
    </main>
  );
}
