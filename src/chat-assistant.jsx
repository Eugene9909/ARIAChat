import { useCallback, useEffect, useRef, useState } from "react";

const ASSISTANTS = [
  { id: "friendly", label: "Friendly" },
  { id: "technical", label: "Technical" },
  { id: "creative", label: "Creative" },
];

async function apiJson(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || res.statusText || "Request failed");
  }
  return data;
}

export default function ChatAssistant({ onLogout }) {
  const [sessionId, setSessionId] = useState(null);
  const [assistant, setAssistant] = useState("friendly");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, busy]);

  const startSession = useCallback(async (kind) => {
    setError(null);
    const data = await apiJson("/api/session", { assistant: kind });
    setSessionId(data.session_id);
    setAssistant(kind);
    setMessages([]);
  }, []);

  useEffect(() => {
    startSession("friendly").catch((e) => setError(e.message));
  }, [startSession]);

  const onAssistantChange = async (kind) => {
    if (!sessionId || kind === assistant) return;
    setError(null);
    setBusy(true);
    try {
      await apiJson("/api/assistant", { session_id: sessionId, assistant: kind });
      setAssistant(kind);
      setMessages([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || !sessionId || busy) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const data = await apiJson("/api/chat", {
        session_id: sessionId,
        message: text,
      });
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e.message);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Error: ${e.message}` },
      ]);
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
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "24px 16px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minHeight: "100vh",
          boxSizing: "border-box",
        }}
      >
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ margin: "0 0 4px", fontSize: "1.5rem", fontWeight: 700 }}>
              ARIA Chat
            </h1>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.95rem" }}>
              OOP-backed assistants — Friendly, Technical, Creative
            </p>
          </div>
          {typeof onLogout === "function" && (
            <button
              type="button"
              onClick={onLogout}
              disabled={busy}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #475569",
                background: "#1e293b",
                color: "#e2e8f0",
                fontSize: "0.85rem",
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              Log out
            </button>
          )}
        </header>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Assistant</span>
          {ASSISTANTS.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={busy || !sessionId}
              onClick={() => onAssistantChange(a.id)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border:
                  assistant === a.id
                    ? "1px solid #38bdf8"
                    : "1px solid #334155",
                background: assistant === a.id ? "#0c4a6e" : "#1e293b",
                color: "#e2e8f0",
                cursor: busy || !sessionId ? "not-allowed" : "pointer",
                opacity: busy || !sessionId ? 0.6 : 1,
              }}
            >
              {a.label}
            </button>
          ))}
        </div>

        {error && (
          <div
            style={{
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

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            border: "1px solid #334155",
            borderRadius: 12,
            padding: 12,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {messages.length === 0 && !busy && (
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.95rem" }}>
              Say hello — your session uses server-side memory via{" "}
              <code style={{ color: "#94a3b8" }}>BaseAssistant</code>.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                padding: "10px 12px",
                borderRadius: 12,
                background:
                  m.role === "user"
                    ? "linear-gradient(135deg, #0369a1, #0284c7)"
                    : "#1e293b",
                border:
                  m.role === "user" ? "none" : "1px solid #334155",
                whiteSpace: "pre-wrap",
                lineHeight: 1.45,
                fontSize: "0.95rem",
              }}
            >
              {m.content}
            </div>
          ))}
          {busy && (
            <div style={{ color: "#94a3b8", fontSize: "0.9rem" }}>Thinking…</div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Message ARIA…"
            rows={2}
            disabled={busy || !sessionId}
            style={{
              flex: 1,
              resize: "vertical",
              minHeight: 48,
              maxHeight: 160,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #334155",
              background: "#0f172a",
              color: "#e2e8f0",
              fontSize: "1rem",
            }}
          />
          <button
            type="button"
            onClick={send}
            disabled={busy || !sessionId || !input.trim()}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: "none",
              background: "#0ea5e9",
              color: "#0f172a",
              fontWeight: 700,
              cursor:
                busy || !sessionId || !input.trim()
                  ? "not-allowed"
                  : "pointer",
              opacity: busy || !sessionId || !input.trim() ? 0.5 : 1,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
