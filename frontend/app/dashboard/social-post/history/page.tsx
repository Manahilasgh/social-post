"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import HistoryDetailPanel from "@/components/social-post/history-detail-panel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HistoryEntry {
  id: number;
  user_id: number;
  query: string;
  headline: string | null;
  description: string | null;
  story_description: string | null;
  hashtags: string[];
  news_results: { title: string; source: string; date: string; thumbnail: string }[];
  settings_snapshot: Record<string, unknown> | null;
  media_filename: string | null;
  publish_status: PublishStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PublishStatus =
  | "draft"
  | "media_ready"
  | "publishing"
  | "published"
  | "partial"
  | "failed";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = "http://localhost:8000";

const STATUS_STYLES: Record<PublishStatus, { label: string; classes: string }> = {
  draft:       { label: "Draft",       classes: "bg-slate-100 text-slate-600 ring-slate-200" },
  media_ready: { label: "Media ready", classes: "bg-blue-50 text-blue-700 ring-blue-200" },
  publishing:  { label: "Publishing",  classes: "bg-amber-50 text-amber-700 ring-amber-200" },
  published:   { label: "Published",   classes: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  partial:     { label: "Partial",     classes: "bg-orange-50 text-orange-700 ring-orange-200" },
  failed:      { label: "Failed",      classes: "bg-red-50 text-red-700 ring-red-200" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: PublishStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.classes}`}
    >
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/social-post/history?user_id=1`);
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      const data: HistoryEntry[] = await res.json();
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-5xl mx-auto px-6 py-10">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Past posts</h1>
              <p className="mt-1 text-sm text-slate-500">All generated social post drafts and publications.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
              >
                <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <Link
                href="/dashboard/social-post"
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
              >
                <PlusIcon className="h-4 w-4" />
                New post
              </Link>
            </div>
          </div>

          {/* States */}
          {loading && entries.length === 0 && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <div>
                <p className="font-semibold">Could not load history</p>
                <p className="mt-0.5">{error}</p>
                <button onClick={load} className="mt-2 underline underline-offset-2 font-medium">
                  Try again
                </button>
              </div>
            </div>
          )}

          {!loading && !error && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
              <InboxIcon className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">No posts yet</p>
              <p className="mt-1 text-xs text-slate-400">Generated posts will appear here once saved.</p>
              <Link
                href="/dashboard/social-post"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition"
              >
                <PlusIcon className="h-4 w-4" />
                Create your first post
              </Link>
            </div>
          )}

          {/* Entry list */}
          {entries.length > 0 && (
            <div className="space-y-3">
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedId(entry.id)}
                  className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 hover:border-indigo-300 hover:shadow-md transition group"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: headline + query */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-indigo-700 transition">
                        {entry.headline ?? "(no headline)"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 truncate">
                        Query: {entry.query}
                      </p>
                    </div>

                    {/* Right: badge + date */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge status={entry.publish_status} />
                      <span className="text-xs text-slate-400">{formatDate(entry.created_at)}</span>
                    </div>
                  </div>

                  {/* Hashtag pills — show up to 4 */}
                  {entry.hashtags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {entry.hashtags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600"
                        >
                          #{tag.replace(/\s+/g, "")}
                        </span>
                      ))}
                      {entry.hashtags.length > 4 && (
                        <span className="text-xs text-slate-400">+{entry.hashtags.length - 4} more</span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Detail slide-over */}
      <HistoryDetailPanel
        id={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
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

function PlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none"
      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
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

function InboxIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none"
      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.235 2.235 0 0 0-.1.661Z" />
    </svg>
  );
}
