"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import NewsPostCard from "@/components/social-post/news-post-template";
import { exportCardAsPng, uploadCardMedia } from "@/lib/export-post-screenshot";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NewsResult {
  title: string;
  source: string;
  date: string;
  thumbnail: string;
}

interface GeneratedData {
  headline: string;
  description: string;
  story_description: string;
  hashtags: string[];
  news_results: NewsResult[];
}

interface PlatformResult {
  platform: string;
  status: string;          // e.g. "published" | "failed"
  external_id?: string | null;
  external_url?: string | null;
  error?: string | null;
}

interface PublishResponse {
  history_id: number;
  publish_status: string;  // e.g. "published" | "partial" | "failed"
  results: PlatformResult[];
}

type AsyncState = "idle" | "loading" | "success" | "error";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = "http://localhost:8000";

async function apiFetch<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const err = await res.json();
      message = err.detail ?? err.message ?? message;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(`${res.status}: ${message}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
      {children}
    </p>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-slate-100 animate-pulse ${className}`} />;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      <span>{message}</span>
    </div>
  );
}

function SuccessBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
      <CheckIcon className="h-3 w-3" />
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SocialPostPage() {
  // Ref on the full-size off-screen card — what domToPng actually captures
  const captureRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");

  // generate
  const [generateState, setGenerateState] = useState<AsyncState>("idle");
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [data, setData] = useState<GeneratedData | null>(null);

  // save draft
  const [saveState, setSaveState] = useState<AsyncState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);

  // export + upload
  const [exportState, setExportState] = useState<AsyncState>("idle");
  const [exportError, setExportError] = useState<string | null>(null);
  // data-URL of the exported PNG, shown as confirmation after upload
  const [exportedDataUrl, setExportedDataUrl] = useState<string | null>(null);

  // publish
  const [publishState, setPublishState] = useState<AsyncState>("idle");
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null);

  // ---------------------------------------------------------------------------
  // Step 1 — Generate
  // ---------------------------------------------------------------------------
  async function handleGenerate() {
    if (!query.trim()) return;

    setGenerateState("loading");
    setGenerateError(null);
    setData(null);
    setSaveState("idle");
    setSaveError(null);
    setHistoryId(null);
    setExportState("idle");
    setExportedDataUrl(null);
    setPublishState("idle");

    try {
      const json = await apiFetch<GeneratedData>(
        `${API_BASE}/api/social-post/generate`,
        { query }
      );
      setData(json);
      setGenerateState("success");
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Unknown error");
      setGenerateState("error");
    }
  }

  // ---------------------------------------------------------------------------
  // Step 2a — Save draft
  // ---------------------------------------------------------------------------
  async function handleSaveDraft() {
    if (!data) return;

    setSaveState("loading");
    setSaveError(null);

    try {
      const saved = await apiFetch<{ id: number }>(
        `${API_BASE}/api/social-post/history`,
        {
          user_id: 1,
          query,
          headline: data.headline,
          description: data.description,
          story_description: data.story_description,
          hashtags: data.hashtags,
          news_results: data.news_results,
        }
      );
      setHistoryId(saved.id);
      setSaveState("success");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unknown error");
      setSaveState("error");
    }
  }

  // ---------------------------------------------------------------------------
  // Step 2b — Export card image and upload
  // ---------------------------------------------------------------------------
  async function handleExportAndUpload() {
    if (!data || !historyId || !captureRef.current) return;

    setExportState("loading");
    setExportError(null);
    setExportedDataUrl(null);

    try {
      // Capture the full-resolution off-screen node
      const file = await exportCardAsPng(captureRef.current, `post-${historyId}.png`);

      // Keep a data-URL for local preview (re-read from the blob we just created)
      const localUrl = URL.createObjectURL(file);
      setExportedDataUrl(localUrl);

      await uploadCardMedia(historyId, file);
      setExportState("success");
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Unknown error");
      setExportState("error");
    }
  }

  // ---------------------------------------------------------------------------
  // Step 3 — Publish
  // ---------------------------------------------------------------------------
  async function handlePublish() {
    if (!historyId) return;

    setPublishState("loading");
    setPublishError(null);
    setPublishResult(null);

    try {
      const result = await apiFetch<PublishResponse>(
        `${API_BASE}/api/social-post/history/${historyId}/publish`,
        { user_id: 1, platforms: ["facebook"] }
      );
      setPublishResult(result);
      // Consider it a UI-level success as long as we got a response back.
      // Per-platform failures are shown individually in the result card.
      setPublishState("success");
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Unknown error");
      setPublishState("error");
    }
  }

  // ---------------------------------------------------------------------------
  // Derived flags
  // ---------------------------------------------------------------------------
  const isGenerating = generateState === "loading";
  const hasResults = !!data;
  const isSaving = saveState === "loading";
  const isSaved = saveState === "success";
  const isExporting = exportState === "loading";
  const isExported = exportState === "success";
  const isPublishing = publishState === "loading";
  const anyBusy = isGenerating || isSaving || isExporting || isPublishing;

  const firstNewsItem = data?.news_results?.[0];
  // Show the card panel (preview + actions) only after the draft is saved
  const showCardPanel = hasResults && isSaved && firstNewsItem;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-10">

          {/* Heading */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Create a social post
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Enter a topic and let AI generate a ready-to-publish post card.
              </p>
            </div>
            <Link
              href="/dashboard/social-post/history"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition"
            >
              <ClockIcon className="h-4 w-4" />
              Past posts
            </Link>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Query input                                                       */}
          {/* ---------------------------------------------------------------- */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
            <SectionLabel>Topic / Query</SectionLabel>
            <div className="flex gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !anyBusy && handleGenerate()}
                placeholder="e.g. AI breakthroughs in healthcare this week"
                disabled={isGenerating}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60 transition"
              />
              <button
                onClick={handleGenerate}
                disabled={anyBusy || !query.trim()}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isGenerating ? <><Spinner />Generating…</> : "Generate"}
              </button>
            </div>
            {generateState === "error" && generateError && (
              <div className="mt-3">
                <ErrorBanner message={`Generation failed — ${generateError}`} />
              </div>
            )}
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Two-column area                                                   */}
          {/* ---------------------------------------------------------------- */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

            {/* ---- Left column: generated content + actions ---- */}
            <div className="space-y-4">

              {/* Headline */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <SectionLabel>Headline</SectionLabel>
                {hasResults ? (
                  <p className="text-lg font-bold text-slate-900 leading-snug">
                    {data.headline}
                  </p>
                ) : (
                  <SkeletonBlock className={`h-7 w-3/4 ${isGenerating ? "" : "opacity-30"}`} />
                )}
              </div>

              {/* Description */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <SectionLabel>Description</SectionLabel>
                {hasResults ? (
                  <p className="text-sm text-slate-600 leading-relaxed">{data.description}</p>
                ) : (
                  <div className="space-y-2">
                    <SkeletonBlock className={`h-4 w-full   ${isGenerating ? "" : "opacity-30"}`} />
                    <SkeletonBlock className={`h-4 w-5/6 ${isGenerating ? "" : "opacity-30"}`} />
                    <SkeletonBlock className={`h-4 w-4/6 ${isGenerating ? "" : "opacity-30"}`} />
                  </div>
                )}
              </div>

              {/* Hashtags */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <SectionLabel>Hashtags</SectionLabel>
                {hasResults ? (
                  <div className="flex flex-wrap gap-2">
                    {data.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200"
                      >
                        #{tag.replace(/\s+/g, "")}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {["w-20", "w-16", "w-24", "w-20"].map((w, i) => (
                      <SkeletonBlock key={i} className={`h-6 rounded-full ${w} ${isGenerating ? "" : "opacity-30"}`} />
                    ))}
                  </div>
                )}
              </div>

              {/* Action strip */}
              {hasResults && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">

                  {/* Save draft */}
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleSaveDraft}
                        disabled={anyBusy || isSaved}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {isSaving ? <><Spinner className="text-slate-500" />Saving…</> : "Save draft"}
                      </button>
                      {isSaved && historyId && (
                        <SuccessBadge>Draft saved — id {historyId}</SuccessBadge>
                      )}
                    </div>
                    {saveState === "error" && saveError && (
                      <div className="mt-3">
                        <ErrorBanner message={`Could not save draft — ${saveError}`} />
                      </div>
                    )}
                  </div>

                  {/* Export + Publish — unlocked after save */}
                  {isSaved && (
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Create image */}
                        <button
                          onClick={handleExportAndUpload}
                          disabled={anyBusy || isExported}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {isExporting
                            ? <><Spinner className="text-slate-500" />Creating image…</>
                            : "Create image"}
                        </button>

                        {isExported && <SuccessBadge>Image uploaded</SuccessBadge>}

                        {/* Publish — only after image is uploaded */}
                        {isExported && (
                          <button
                            onClick={handlePublish}
                            disabled={anyBusy || publishState === "success"}
                            className="flex items-center gap-2 rounded-xl bg-[#1877F2] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#166fe5] disabled:opacity-50 disabled:cursor-not-allowed transition"
                          >
                            {isPublishing
                              ? <><Spinner />Publishing…</>
                              : "Publish to Facebook"}
                          </button>
                        )}
                      </div>

                      {/* Export error */}
                      {exportState === "error" && exportError && (
                        <ErrorBanner message={`Image export failed — ${exportError}`} />
                      )}

                      {/* Publish network/server error */}
                      {publishState === "error" && publishError && (
                        <ErrorBanner message={`Publish request failed — ${publishError}`} />
                      )}

                      {/* Per-platform publish results */}
                      {publishResult && (
                        <div className="mt-1 rounded-xl border border-slate-200 overflow-hidden">
                          {publishResult.results.map((r) => {
                            const succeeded = r.status === "published" || r.status === "success";
                            return (
                              <div
                                key={r.platform}
                                className={`flex items-start gap-3 px-4 py-3 text-sm ${
                                  succeeded
                                    ? "bg-emerald-50 border-b border-emerald-100 last:border-b-0"
                                    : "bg-red-50 border-b border-red-100 last:border-b-0"
                                }`}
                              >
                                {/* Platform icon placeholder + name */}
                                <span className={`mt-0.5 font-semibold capitalize ${succeeded ? "text-emerald-700" : "text-red-700"}`}>
                                  {r.platform}
                                </span>

                                <div className="flex-1 min-w-0">
                                  {succeeded ? (
                                    <span className="text-emerald-700 font-medium">Published</span>
                                  ) : (
                                    <span className="text-red-700 font-medium">Failed</span>
                                  )}

                                  {r.error && (
                                    <p className="mt-0.5 text-xs text-red-600 break-words">{r.error}</p>
                                  )}
                                </div>

                                {/* External link */}
                                {succeeded && r.external_url && (
                                  <a
                                    href={r.external_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition"
                                  >
                                    View post
                                    <ExternalLinkIcon className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ---- Right column: card preview ---- */}
            <div className="sticky top-6 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <SectionLabel>Card preview</SectionLabel>

                {showCardPanel ? (
                  /*
                   * Visible scaled preview.
                   * The card is 1080×1350 (4:5). The sidebar column is 380 px,
                   * minus 2×20 px padding = ~340 px usable. scale = 340/1080 ≈ 0.315.
                   * We set the outer wrapper to the scaled dimensions so it
                   * takes up natural space in the document flow.
                   */
                  <div
                    style={{ width: "100%", aspectRatio: "4/5", overflow: "hidden", borderRadius: 12 }}
                  >
                    <div style={{ transformOrigin: "top left", transform: "scale(0.315)", width: 1080, height: 1350 }}>
                      <NewsPostCard
                        imageUrl={firstNewsItem.thumbnail}
                        source={firstNewsItem.source}
                        date={firstNewsItem.date}
                        headline={data!.headline}
                        description={data!.description}
                        hashtags={data!.hashtags}
                      />
                    </div>
                  </div>
                ) : (
                  /* Empty / pre-save placeholder */
                  <div
                    className="relative w-full rounded-xl border border-slate-200 bg-slate-100"
                    style={{ aspectRatio: "4/5" }}
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
                      <ImagePlaceholderIcon />
                      <span className="text-xs font-medium text-center px-4">
                        {isGenerating
                          ? "Generating your post…"
                          : hasResults
                            ? "Save the draft to see the card preview"
                            : "Post preview will appear here"}
                      </span>
                    </div>
                  </div>
                )}

                <p className="mt-3 text-xs text-center text-slate-400">4:5 · 1080 × 1350 px</p>
              </div>

              {/* Exported image confirmation */}
              {isExported && exportedDataUrl && (
                <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5">
                  <SectionLabel>Exported image</SectionLabel>
                  <div className="overflow-hidden rounded-xl border border-slate-200" style={{ aspectRatio: "4/5" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={exportedDataUrl}
                      alt="Exported post card"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="mt-2 text-xs text-center text-emerald-600 font-medium">
                    ✓ PNG uploaded to server
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Full-resolution off-screen capture target (1080×1350, not scaled)  */}
      {/* domToPng must see real pixel dimensions — do not scale this node.   */}
      {/* ------------------------------------------------------------------ */}
      {showCardPanel && (
        <div aria-hidden="true" style={{ position: "fixed", left: -9999, top: 0, pointerEvents: "none" }}>
          <div ref={captureRef}>
            <NewsPostCard
              imageUrl={firstNewsItem.thumbnail}
              source={firstNewsItem.source}
              date={firstNewsItem.date}
              headline={data!.headline}
              description={data!.description}
              hashtags={data!.hashtags}
            />
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function AlertIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

function ImagePlaceholderIcon() {
  return (
    <svg
      className="h-10 w-10 text-slate-300"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.2}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function ExternalLinkIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

function ClockIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
