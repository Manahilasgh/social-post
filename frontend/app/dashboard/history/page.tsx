"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import HistoryDetailPanel from "@/components/social-post/history-detail-panel";
import { useAuth } from "@/lib/auth-context";
import { apiGet, API_BASE } from "@/lib/api";

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

/** Construct a full URL for a stored card image. */
export function mediaUrl(filename: string): string {
  return `${API_BASE}/uploads/social/${filename}`;
}

export const STATUS_STYLES: Record<
  PublishStatus,
  { label: string; dot: string; badge: string }
> = {
  draft:       { label: "Draft",       dot: "bg-slate-400",   badge: "bg-slate-100  text-slate-600  ring-slate-200"  },
  media_ready: { label: "Media ready", dot: "bg-blue-500",    badge: "bg-blue-50    text-blue-700   ring-blue-200"   },
  publishing:  { label: "Publishing",  dot: "bg-amber-500",   badge: "bg-amber-50   text-amber-700  ring-amber-200"  },
  published:   { label: "Published",   dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  partial:     { label: "Partial",     dot: "bg-orange-400",  badge: "bg-orange-50  text-orange-700 ring-orange-200" },
  failed:      { label: "Failed",      dot: "bg-red-500",     badge: "bg-red-50     text-red-700    ring-red-200"    },
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

export function StatusBadge({ status }: { status: PublishStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// Skeleton card for loading state
function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white animate-pulse">
      <div className="aspect-[4/5] bg-slate-100" />
      <div className="p-3 space-y-2">
        <div className="h-3 w-3/4 rounded bg-slate-100" />
        <div className="h-3 w-1/2 rounded bg-slate-100" />
      </div>
    </div>
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
  const { token } = useAuth();
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<HistoryEntry[]>(
        `${API_BASE}/api/social-post/history`,
        token
      );
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-10">

          {/* Page heading */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">History</h1>
              <p className="mt-1 text-sm text-slate-500">
                {entries.length > 0
                  ? `${entries.length} post${entries.length === 1 ? "" : "s"}`
                  : "All generated social post drafts and publications."}
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
            >
              <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Loading grid */}
          {loading && entries.length === 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* Error */}
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

          {/* Empty state */}
          {!loading && !error && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-24 text-center">
              <InboxIcon className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">No posts yet</p>
              <p className="mt-1 text-xs text-slate-400">
                Generated posts will appear here once saved.
              </p>
            </div>
          )}

          {/* Gallery grid */}
          {entries.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {entries.map((entry) => {
                // Only use the confirmed-local uploaded card image.
                // Never use external news thumbnails here — they're third-party
                // URLs that may be blocked, expired, or CORS-restricted.
                const thumb = entry.media_filename
                  ? mediaUrl(entry.media_filename)
                  : null;

                return (
                  <button
                    key={entry.id}
                    onClick={() => {
                      // For drafts, navigate to create-post page for editing
                      if (entry.publish_status === "draft" || entry.publish_status === "media_ready") {
                        router.push(`/dashboard/create?draft=${entry.id}`);
                      } else {
                        // For published posts, show detail panel
                        setSelectedId(entry.id);
                      }
                    }}
                    className="group rounded-2xl overflow-hidden border-2 border-transparent bg-white shadow-sm hover:border-indigo-400 hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 text-left"
                  >
                    {/* Thumbnail — 4:5 aspect ratio matching the card */}
                    <div className="relative aspect-[4/5] bg-slate-100 overflow-hidden">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-300">
                          <ImageIcon className="h-8 w-8" />
                          <span className="text-[10px] font-medium text-slate-400">No image yet</span>
                        </div>
                      )}

                      {/* Status badge — overlaid on bottom of image */}
                      <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 pt-8 bg-gradient-to-t from-black/60 to-transparent">
                        <StatusBadge status={entry.publish_status} />
                      </div>
                    </div>

                    {/* Caption */}
                    <div className="px-3 py-2.5">
                      <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug group-hover:text-indigo-700 transition">
                        {entry.headline ?? "(no headline)"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatDate(entry.created_at)}
                      </p>
                    </div>
                  </button>
                );
              })}
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
