import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError("Mail o contraseña incorrectos.");
  }

  return (
    <div className="timbo-app">
      <div className="t-login">
        <div className="t-login-card">
          <div className="t-login-brand">
            <div className="t-brand-name t-serif">Timbó</div>
            <div className="t-brand-sub">Gestión</div>
          </div>
          <form className="stack-md" onSubmit={handleSubmit}>
            <div className="t-field">
              <label className="t-label" htmlFor="email">Mail</label>
              <input
                id="email"
                type="email"
                className="t-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="t-field">
              <label className="t-label" htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                className="t-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <div className="t-error">{error}</div>}
            <button className="t-btn t-btn-primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
