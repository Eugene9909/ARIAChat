import { useCallback, useEffect, useState } from "react";
import ChatAssistant from "./chat-assistant.jsx";
import Login from "./Login.jsx";

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const refreshAuth = useCallback(() => {
    return fetch("https://ariachat.onrender.com/api/auth", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setLoggedIn(!!d.logged_in);
        setAuthChecked(true);
      })
      .catch(() => {
        setLoggedIn(false);
        setAuthChecked(true);
      });
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  if (!authChecked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          margin: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif',
          background: "#0f172a",
          color: "#94a3b8",
        }}
      >
        Loading…
      </div>
    );
  }

  if (!loggedIn) {
    return <Login onSuccess={() => setLoggedIn(true)} />;
  }

  return (
    <ChatAssistant
      onLogout={() => {
        fetch("https://ariachat.onrender.com/api/logout", { method: "POST", credentials: "include" }).finally(
          () => setLoggedIn(false)
        );
      }}
    />
  );
}
