"use client";

import { useState } from "react";
import { login, type User } from "@/lib/auth";

type LoginFormProps = {
  onSuccess: (user: User) => void;
};

export const LoginForm = ({ onSuccess }: LoginFormProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(username, password);
      onSuccess(user);
    } catch {
      setError("Invalid username or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-5 rounded-[28px] border border-[var(--stroke)] bg-white/90 p-8 shadow-[var(--shadow)] backdrop-blur"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
            Kanban Studio
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-[var(--navy-dark)]">
            Sign in
          </h1>
        </div>

        <label className="flex flex-col gap-1 text-sm text-[var(--navy-dark)]">
          Username
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 outline-none focus:border-[var(--primary-blue)]"
            autoComplete="username"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-[var(--navy-dark)]">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 outline-none focus:border-[var(--primary-blue)]"
            autoComplete="current-password"
          />
        </label>

        {error ? (
          <p role="alert" className="text-sm text-[var(--secondary-purple)]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-[var(--secondary-purple)] px-4 py-2 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
};
