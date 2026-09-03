"use client";

import { useEffect, useState } from "react";
import { getUsername, setUsername, USERNAME_CHANGED_EVENT } from "@/lib/client/localCollection";

export default function UsernameBar() {
  const [username, setUsernameState] = useState<string | null | undefined>(undefined); // undefined = not yet loaded (avoids SSR/CSR mismatch)
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const load = () => setUsernameState(getUsername());
    load();
    window.addEventListener(USERNAME_CHANGED_EVENT, load);
    return () => window.removeEventListener(USERNAME_CHANGED_EVENT, load);
  }, []);

  function startEditing() {
    setDraft(username ?? "");
    setEditing(true);
  }

  function save() {
    if (!draft.trim()) return;
    setUsername(draft);
    setEditing(false);
  }

  if (username === undefined) return null; // avoid a flash before localStorage is read

  return (
    <div className="username-bar">
      {editing || !username ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input
            className="text-input"
            style={{ display: "inline-block", width: "auto" }}
            type="text"
            placeholder="Choose a username"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus={editing}
          />
          <button className="button" type="submit" style={{ marginLeft: "0.5rem" }}>
            Save
          </button>
        </form>
      ) : (
        <span className="muted">
          Signed in as <strong>{username}</strong>{" "}
          <button className="link-button" onClick={startEditing}>
            change
          </button>
        </span>
      )}
    </div>
  );
}
