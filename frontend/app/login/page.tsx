"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LoginPage() {
  const { login, register, isLoading, user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already logged in → go to chat
  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/chat/new");
    }
  }, [isLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (tab === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const fillTestCredentials = () => {
    setTab("login");
    setEmail("admin");
    setPassword("password");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center">
        <svg className="animate-spin text-accent" width="28" height="28" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-accent">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-primary-dark">Knowledge Base</h1>
          <p className="text-sm text-secondary mt-1">Chat with your notes</p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg bg-surface-dark border border-border-dark p-1 mb-6">
          <button
            onClick={() => { setTab("login"); setError(""); }}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === "login"
                ? "bg-accent/15 text-accent"
                : "text-secondary hover:text-primary-dark"
            }`}
          >
            Sign in
          </button>
          <button
            onClick={() => { setTab("register"); setError(""); }}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === "register"
                ? "bg-accent/15 text-accent"
                : "text-secondary hover:text-primary-dark"
            }`}
          >
            Create account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-secondary mb-1.5 block">Email</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              autoComplete="username"
              className="w-full bg-surface-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-primary-dark placeholder-secondary outline-none focus:border-accent/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-secondary mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === "register" ? "At least 8 characters" : "Your password"}
                required
                minLength={tab === "register" ? 8 : 1}
                autoComplete={tab === "register" ? "new-password" : "current-password"}
                className="w-full bg-surface-dark border border-border-dark rounded-lg px-3 py-2 pr-10 text-sm text-primary-dark placeholder-secondary outline-none focus:border-accent/60 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-primary-dark transition-colors p-0.5"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-accent/20 hover:bg-accent/30 text-accent font-medium text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting && (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {tab === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        {/* Test credentials hint — only shown when NEXT_PUBLIC_ENABLE_TEST_LOGIN=true */}
        {process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN === "true" && (
          <div className="mt-6 p-3 rounded-lg bg-surface-dark border border-border-dark/60">
            <p className="text-[11px] text-secondary text-center mb-2">
              Quick test access
            </p>
            <button
              onClick={fillTestCredentials}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-md hover:bg-bg-dark transition-colors group"
            >
              <span className="text-xs text-secondary font-mono">
                admin <span className="text-secondary/40">/</span> password
              </span>
              <span className="text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                Fill →
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
