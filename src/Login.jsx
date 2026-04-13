import { useState } from "react";

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("https://ariachat.onrender.com/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
      onSuccess();
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        margin: 0,
        fontFamily:
          'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        background: "linear-gradient(160deg, #0f172a 0%, #1e293b 45%, #0f172a 100%)",
        color: "#e2e8f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: 400,
          padding: 28,
          borderRadius: 16,
          border: "1px solid #334155",
          background: "rgba(15, 23, 42, 0.85)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
        }}
      >
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "1.5rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          ARIA Chat
        </h1>
        <p style={{ margin: "0 0 24px", color: "#94a3b8", fontSize: "0.95rem" }}>
          Sign in to continue
        </p>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 12px",
              borderRadius: 8,
              background: "#450a0a",
              border: "1px solid #7f1d1d",
              color: "#fecaca",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        <label
          style={{
            display: "block",
            marginBottom: 6,
            fontSize: "0.8rem",
            color: "#94a3b8",
            fontWeight: 600,
          }}
        >
          Username
        </label>
        <input
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={busy}
          style={{
            width: "100%",
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #334155",
            background: "#0f172a",
            color: "#e2e8f0",
            fontSize: "1rem",
          }}
        />

        <label
          style={{
            display: "block",
            marginBottom: 6,
            fontSize: "0.8rem",
            color: "#94a3b8",
            fontWeight: 600,
          }}
        >
          Password
        </label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          style={{
            width: "100%",
            marginBottom: 20,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #334155",
            background: "#0f172a",
            color: "#e2e8f0",
            fontSize: "1rem",
          }}
        />

        <button
          type="submit"
          disabled={busy || !username.trim() || !password.trim()}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            background: "#0ea5e9",
            color: "#0f172a",
            fontWeight: 700,
            fontSize: "1rem",
            cursor:
              busy || !username.trim() || !password.trim()
                ? "not-allowed"
                : "pointer",
            opacity: busy || !username.trim() || !password.trim() ? 0.5 : 1,
          }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
