"use client";
import { useEffect, useState } from "react";
import { auth, db, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, onSnapshot } from "firebase/firestore";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [text, setText] = useState("");
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);

  useEffect(() => {
    const u1 = onAuthStateChanged(auth, setUser);
    const u2 = onSnapshot(collection(db, "items"), (snap) =>
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })))
    );
    return () => { u1(); u2(); };
  }, []);

  return (
    <main style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Next.js + Firebase (simple demo)</h1>

      {!user ? (
        <button onClick={() => signInWithPopup(auth, googleProvider)}>Sign in with Google</button>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "1rem 0" }}>
          <img src={user.photoURL ?? ""} width={28} height={28} style={{ borderRadius: 999 }} />
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
          onClick={() => text && addDoc(collection(db, "items"), { text }).then(() => setText(""))}
        >
          Add
        </button>
      </div>

      <ul style={{ marginTop: 16 }}>
        {items.map((i) => (<li key={i.id}>{i.text}</li>))}
      </ul>
    </main>
  );
}
