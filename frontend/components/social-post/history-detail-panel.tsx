"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { HistoryEntry, PublishStatus } from "@/app/dashboard/history/page";
import { STATUS_STYLES, mediaUrl } from "@/app/dashboard/history/page";
import { useAuth } from "@/lib/auth-context";
import { apiGet, API_BASE } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  id: number | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: PublishStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5">{label}</p>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}

function Divider() {
  return <hr className="border-slate-100" />;
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export default function HistoryDetailPanel({ id, onClose }: Props) {
  const router = useRouter();
  const { token } = useAuth();
  
  const [entry, setEntry] = useState<HistoryEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    if (id === null) {
      setEntry(null);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchEntry() {
      setLoading(true);
      setError(null);
      try {
<<<<<<< HEAD
        const headers: HeadersInit = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        
        const res = await fetch(`/api/social-post/history/${id}`, { headers });
        
        if (res.status === 401) {
          localStorage.removeItem("auth_token");
          router.push("/login");
          return;
        }
        
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail ?? `${res.status}: ${res.statusText}`);
        }
        const data: HistoryEntry = await res.json();
=======
        const data = await apiGet<HistoryEntry>(
          `${API_BASE}/api/social-post/history/${id}`,
          token
        );
>>>>>>> main
        if (!cancelled) setEntry(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchEntry();
    return () => { cancelled = true; };
<<<<<<< HEAD
  }, [id, token, router]);
=======
  }, [id, token]);
>>>>>>> main

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const isOpen = id !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Post detail"
        className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
          <h2 className="text-sm font-semibold text-slate-900">Post detail</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Close panel"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Loading skeleton */}
          {loading && (
            <div className="p-5 space-y-4 animate-pulse">
              <div className="aspect-[4/5] w-full rounded-xl bg-slate-100" />
              <div className="h-4 w-2/3 rounded bg-slate-100" />
              <div className="h-3 w-1/3 rounded bg-slate-100" />
              <div className="space-y-2 pt-2">
                <div className="h-3 w-full rounded bg-slate-100" />
                <div className="h-3 w-5/6 rounded bg-slate-100" />
                <div className="h-3 w-4/6 rounded bg-slate-100" />
              </div>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="m-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Content */}
          {!loading && !error && entry && (
            <>
              {/* Card image — full-width at the top, 4:5 */}
              <div className="relative w-full aspect-[4/5] bg-slate-100 overflow-hidden">
                {entry.media_filename ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(entry.media_filename)}
                    alt="Post card"
                    className="w-full h-full object-cover"
                  />
                ) : entry.news_results?.[0]?.thumbnail ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.news_results[0].thumbnail}
                      alt=""
                      className="w-full h-full object-cover opacity-40"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                      <ImageIcon className="h-8 w-8 text-slate-400" />
                      <p className="text-xs font-medium">No card image yet</p>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                    <ImageIcon className="h-8 w-8" />
                    <p className="text-xs font-medium">No image</p>
                  </div>
                )}

                {/* Status badge overlay */}
                <div className="absolute top-3 left-3">
                  <StatusBadge status={entry.publish_status} />
                </div>
              </div>

              {/* Details */}
              <div className="px-5 py-5 space-y-5">

                {/* Headline + meta */}
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {entry.headline ?? "(no headline)"}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-400">
                    #{entry.id} · {formatDateTime(entry.created_at)}
                    {entry.published_at && (
                      <> · Published {formatDateTime(entry.published_at)}</>
                    )}
                  </p>
                </div>

                <Divider />

                {/* Query */}
                <Field label="Query">
                  <p className="leading-relaxed">{entry.query}</p>
                </Field>

                {/* Description */}
                {entry.description && (
                  <Field label="Description">
                    <p className="leading-relaxed text-slate-600">{entry.description}</p>
                  </Field>
                )}

                {/* Story */}
                {entry.story_description && (
                  <Field label="Story">
                    <p className="leading-relaxed text-slate-600">{entry.story_description}</p>
                  </Field>
                )}

                {/* Hashtags */}
                {entry.hashtags.length > 0 && (
                  <Field label="Hashtags">
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {entry.hashtags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200"
                        >
                          #{tag.replace(/\s+/g, "")}
                        </span>
                      ))}
                    </div>
                  </Field>
                )}

                {/* News sources */}
                {entry.news_results.length > 0 && (
                  <>
                    <Divider />
                    <Field label={`Sources (${entry.news_results.length})`}>
                      <ul className="mt-1.5 space-y-2.5">
                        {entry.news_results.map((item, i) => (
                          <li key={i} className="flex items-start gap-3">
                            {item.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.thumbnail}
                                alt=""
                                className="h-10 w-10 rounded-lg object-cover shrink-0 bg-slate-100"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-slate-100 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-800 line-clamp-2">
                                {item.title}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-400">
                                {item.source} · {item.date}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Field>
                  </>
                )}

              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none"
      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
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

function ImageIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none"
      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
