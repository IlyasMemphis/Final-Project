// Front-end/src/pages/ResetPassword.jsx
import React, { useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";

const API = "http://localhost:3333";

export default function ResetPassword() {
  const { token: tokenFromParam } = useParams();
  const location = useLocation();
  // на всякий случай поддержим и ?token=..., если вдруг придёшь по dev-ссылке
  const tokenFromQuery = new URLSearchParams(location.search).get("token");
  const token = tokenFromParam || tokenFromQuery || "";

  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (!token) {
      setErr("Invalid reset link.");
      return;
    }
    if (!password || password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword: confirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to reset password");

      setMsg("Password has been reset. You can now log in.");
      setTimeout(() => navigate("/login"), 1500);
    } catch (e) {
      setErr(e.message || "Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ width: 360, padding: 24, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Set a new password</h2>

        <form onSubmit={submit}>
          <div style={{ display: "grid", gap: 10 }}>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ height: 40, padding: "0 10px", borderRadius: 8, border: "1px solid #ddd" }}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{ height: 40, padding: "0 10px", borderRadius: 8, border: "1px solid #ddd" }}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                height: 40,
                borderRadius: 8,
                border: "none",
                background: "#0a84ff",
                color: "#fff",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Saving…" : "Save new password"}
            </button>
          </div>
        </form>

        {msg && <div style={{ color: "green", marginTop: 10 }}>{msg}</div>}
        {err && <div style={{ color: "crimson", marginTop: 10 }}>{err}</div>}

        <div style={{ marginTop: 14 }}>
          <Link to="/login">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
