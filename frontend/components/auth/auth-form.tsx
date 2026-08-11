"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Field {
  id: string;
  label: string;
  type: "email" | "password" | "text";
  placeholder: string;
  autoComplete: string;
}

interface AuthFormProps {
  mode: "login" | "signup";
}

// ---------------------------------------------------------------------------
// Config per mode
// ---------------------------------------------------------------------------

const API_BASE = "http://localhost:8000";

const CONFIG = {
  login: {
    title: "Welcome back",
    subtitle: "Sign in to your account",
    endpoint: `${API_BASE}/api/auth/login`,
    submitLabel: "Log in",
    fields: [
      { id: "email",    label: "Email",    type: "email"    as const, placeholder: "you@example.com", autoComplete: "email" },
      { id: "password", label: "Password", type: "password" as const, placeholder: "••••••••",         autoComplete: "current-password" },
    ] satisfies Field[],
    switchText: "Need an account?",
    switchLabel: "Sign up",
    switchHref: "/signup",
  },
  signup: {
    title: "Create an account",
    subtitle: "Start generating social posts",
    endpoint: `${API_BASE}/api/auth/register`,
    submitLabel: "Sign up",
    fields: [
      { id: "name",     label: "Name",     type: "text"     as const, placeholder: "Your name",        autoComplete: "name" },
      { id: "email",    label: "Email",    type: "email"    as const, placeholder: "you@example.com",  autoComplete: "email" },
      { id: "password", label: "Password", type: "password" as const, placeholder: "At least 8 chars", autoComplete: "new-password" },
    ] satisfies Field[],
    switchText: "Already have an account?",
    switchLabel: "Log in",
    switchHref: "/login",
  },
} as const;

// Map specific HTTP status codes to friendly messages
function errorMessage(status: number, detail: string): string {
  if (status === 401) return "Invalid email or password.";
  if (status === 409) return "An account with this email already exists.";
  if (status === 400) {
    if (detail?.toLowerCase().includes("password")) return "Password must be at least 8 characters.";
    return detail || "Invalid request.";
  }
  return detail || "Something went wrong. Please try again.";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AuthForm({ mode }: AuthFormProps) {
  const cfg = CONFIG[mode];
  const router = useRouter();
  const { login } = useAuth();

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(cfg.fields.map((f) => [f.id, ""]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
    if (error) setError(null); // clear error on any edit
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(cfg.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(errorMessage(res.status, data?.detail ?? ""));
        return;
      }

      // Both /login and /register return the same AuthResponse shape
      login(data.access_token, {
        user_id: data.user_id,
        email: data.email,
        name: data.name ?? null,
      });

      router.push("/dashboard/create");
    } catch {
      setError("Could not reach the server. Make sure the backend is running.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">

        {/* Logo / brand mark */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 mb-4">
            <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{cfg.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{cfg.subtitle}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {cfg.fields.map((field) => (
              <div key={field.id}>
                <label
                  htmlFor={field.id}
                  className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5"
                >
                  {field.label}
                </label>
                <input
                  id={field.id}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  placeholder={field.placeholder}
                  value={values[field.id]}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  required
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60 transition"
                />
              </div>
            ))}

            {/* Error message */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" xmlns="http://www.w3.org/2000/svg"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg"
                    fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {mode === "login" ? "Signing in…" : "Creating account…"}
                </>
              ) : cfg.submitLabel}
            </button>
          </form>
        </div>

        {/* Switch link */}
        <p className="mt-6 text-center text-sm text-slate-500">
          {cfg.switchText}{" "}
          <Link
            href={cfg.switchHref}
            className="font-semibold text-indigo-600 hover:text-indigo-700 transition"
          >
            {cfg.switchLabel}
          </Link>
        </p>

      </div>
    </div>
  );
}
