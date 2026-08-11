"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { PLATFORMS } from "@/lib/platforms";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConnectedAccount {
  id: number;
  platform: string;
  platform_account_id: string;
  display_name: string | null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AccountsPage() {
  const router = useRouter();
  const { token } = useAuth();
  
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null); // Clear any existing success messages
    try {
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const res = await fetch(`/api/social-accounts`, { headers });
      
      if (res.status === 401) {
        localStorage.removeItem("auth_token");
        router.push("/login");
        return;
      }
      
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      const data: ConnectedAccount[] = await res.json();
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  // Handle Facebook OAuth callback parameters on mount
  const searchParams = new URLSearchParams(window.location.search);
  useEffect(() => {
    
    const searchParams = new URLSearchParams(window.location.search);
    const fbConnected = searchParams.get("fb_connected");
    const fbError = searchParams.get("fb_error");
    const pages = searchParams.get("pages");

    if (fbConnected === "true") {
      // Show success message
      const pageNames = pages ? pages.split(",").join(", ") : "your page";
      setSuccessMessage(`Facebook connected: ${pageNames}`);
      
      // Refetch accounts to update the UI
      fetchAccounts();
      
      // Clean the URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("fb_connected");
      newUrl.searchParams.delete("pages");
      router.replace(newUrl.pathname + newUrl.search);
    } else if (fbError) {
      // Show error message based on the error type
      let errorMsg = "Something went wrong connecting Facebook, please try again";
      if (fbError === "no_pages") {
        errorMsg = "No Facebook Pages found — you need to be an admin of at least one Page";
      } else if (["token_exchange", "token_upgrade", "pages_fetch"].includes(fbError)) {
        errorMsg = "Something went wrong connecting Facebook, please try again";
      }
      setError(errorMsg);
      
      // Clean the URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("fb_error");
      router.replace(newUrl.pathname + newUrl.search);
    }
  }, [searchParams, fetchAccounts, router]);

  // Refetch when the tab regains focus — catches the return from Facebook OAuth
  useEffect(() => {
    function handleFocus() {
      fetchAccounts();
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchAccounts]);

  // Build a fast lookup: platform id → connected accounts for that platform
  const accountsByPlatform = accounts.reduce<Record<string, ConnectedAccount[]>>(
    (acc, a) => {
      if (!acc[a.platform]) acc[a.platform] = [];
      acc[a.platform].push(a);
      return acc;
    },
    {}
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* Heading */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Connected Accounts
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage the social accounts used for publishing.
            </p>
          </div>
          <button
            onClick={fetchAccounts}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Success banner */}
        {successMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
            <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <div className="flex-1">
              <p className="font-semibold">Connection successful!</p>
              <p className="mt-0.5">{successMessage}</p>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-400 hover:text-emerald-600 transition"
            >
              ✕
            </button>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div>
              <p className="font-semibold">Could not load accounts</p>
              <p className="mt-0.5">{error}</p>
              <button
                onClick={fetchAccounts}
                className="mt-2 underline underline-offset-2 font-medium"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Success banner */}
        {successMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
            <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <div>
              <p className="font-semibold">Success!</p>
              <p className="mt-0.5">{successMessage}</p>
              <button
                onClick={() => setSuccessMessage(null)}
                className="mt-2 underline underline-offset-2 font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Platform grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLATFORMS.map((platform) => {
            const connected = accountsByPlatform[platform.id] ?? [];
            const isConnected = connected.length > 0;

            return (
              <div
                key={platform.id}
                className={`relative rounded-2xl border bg-white p-5 shadow-sm flex flex-col gap-4 transition ${
                  isConnected ? "border-emerald-200" : "border-slate-200"
                }`}
              >
                {/* Platform header */}
                <div className="flex items-center gap-3">
                  {/* Icon circle */}
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: isConnected
                        ? `${platform.color}18`   // 10% opacity tint
                        : "#f1f5f9",
                      color: isConnected ? platform.color : "#94a3b8",
                    }}
                  >
                    {platform.icon}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{platform.label}</p>
                    {!platform.connectEnabled && !isConnected && (
                      <p className="text-xs text-slate-400">Coming soon</p>
                    )}
                  </div>

                  {/* Connected badge — top-right */}
                  {isConnected && (
                    <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Connected
                    </span>
                  )}
                </div>

                {/* Connected account details */}
                {isConnected && (
                  <div className="space-y-1.5">
                    {connected.map((acct) => (
                      <div
                        key={acct.id}
                        className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"
                      >
                        <PageIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <p className="text-xs font-medium text-slate-700 truncate">
                          {acct.display_name ?? acct.platform_account_id}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action row */}
                <div className="mt-auto">
                  {isConnected ? (
                    <button
                      onClick={() => {
                        window.location.href = `/api/social-accounts/${platform.id}/connect?token=${encodeURIComponent(token || "")}`;
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition"
                    >
                      Reconnect
                    </button>
                  ) : platform.connectEnabled ? (
                    <button
                      onClick={() => {
                        window.location.href = `/api/social-accounts/${platform.id}/connect?token=${encodeURIComponent(token || "")}`;
                      }}
                      className="w-full rounded-xl py-2 text-xs font-semibold text-white transition"
                      style={{ backgroundColor: platform.color }}
                    >
                      Connect {platform.label}
                    </button>
                  ) : (
                    /* Coming soon — disabled */
                    <button
                      disabled
                      className="w-full rounded-xl border border-slate-100 bg-slate-50 py-2 text-xs font-medium text-slate-300 cursor-not-allowed"
                    >
                      Coming soon
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Loading overlay — only on initial load with no data yet */}
        {loading && accounts.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Skeleton grid replaces the above silently via opacity; spinner is a fallback */}
          </div>
        )}

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function RefreshIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none"
      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function AlertIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none"
      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  );
}

function PageIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none"
      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
    </svg>
  );
}

function CheckCircleIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none"
      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
