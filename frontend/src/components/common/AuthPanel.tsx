import { FormEvent, useState } from "react";

import { useAuthStore } from "../../store/authStore";

type Mode = "login" | "register";

export function AuthPanel() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      if (mode === "login") await login({ email, password });
      else await register({ name: name.trim() || "Notes User", email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div>
          <h1>Notes</h1>
          <p>Block-first workspace</p>
        </div>
        <div className="segmented">
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>
            Sign in
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            type="button"
            onClick={() => setMode("register")}
          >
            Create
          </button>
        </div>
        <form onSubmit={onSubmit}>
          {mode === "register" ? (
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
            </label>
          ) : null}
          <label>
            Email
            <input
              value={email}
              placeholder="you@example.com"
              required
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              value={password}
              placeholder="Password"
              required
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          <button className="primary-button" type="submit">
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}
