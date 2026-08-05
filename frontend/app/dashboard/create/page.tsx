"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NewsPostCard, { TEMPLATES, type TemplateVariant } from "@/components/social-post/news-post-template";
import { exportCardAsPng, uploadCardMedia } from "@/lib/export-post-screenshot";
import { PLATFORMS } from "@/lib/platforms";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, apiGet, API_BASE } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NewsResult {
  title: string;
  snippet: string;
  source: string;
  date: string;
  thumbnail: string;
  link?: string | null;
}

interface ImageResult {
  thumbnail: string | null;
  original: string | null;
  title: string | null;
  source: string | null;
}

// A unified item in the background image gallery
interface BgImage {
  thumbnail: string;  // shown in the grid
  original: string;   // used as imageUrl in the card
  title: string;
  source: string;
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
  status: string;
  external_id?: string | null;
  external_url?: string | null;
  error?: string | null;
}

interface PublishResponse {
  history_id: number;
  publish_status: string;
  results: PlatformResult[];
}

interface DraftHistory {
  id: number;
  user_id: number;
  query: string;
  headline: string | null;
  description: string | null;
  story_description: string | null;
  hashtags: string[];
  news_results: NewsResult[];
  settings_snapshot: Record<string, unknown> | null;
  media_filename: string | null;
  publish_status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

type AsyncState = "idle" | "loading" | "success" | "error";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps an external image URL through our backend proxy so the browser
 * sees it as same-origin. Required for canvas capture (domToPng) to work
 * without CORS taint. Skip for blob: and data: URLs (user uploads) and
 * for URLs already pointing at our own backend.
 */
function proxyImageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (url.startsWith(API_BASE)) return url;
  return `${API_BASE}/api/images/proxy?url=${encodeURIComponent(url)}`;
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

export default function CreatePostPage() {
  const captureRef = useRef<HTMLDivElement>(null);
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [isEditingDraft, setIsEditingDraft] = useState(false); // Track if we're editing an existing draft
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false); // Track if draft has unsaved changes

  // generate
  const [generateState, setGenerateState] = useState<AsyncState>("idle");
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [data, setData] = useState<GeneratedData | null>(null);
  // editable copies of headline/description — updated by inline edits on the card
  const [editedHeadline, setEditedHeadline] = useState<string>("");
  const [editedDescription, setEditedDescription] = useState<string>("");
  // the article the user has selected as the basis for the card image
  const [selectedArticle, setSelectedArticle] = useState<NewsResult | null>(null);
  // which visual template is active
  const [selectedVariant, setSelectedVariant] = useState<TemplateVariant>("dark");

  // background image gallery
  const [bgImages, setBgImages] = useState<BgImage[]>([]);
  const [bgLoading, setBgLoading] = useState(false);
  // the URL actually used as the card background (original-quality)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  // save draft
  const [saveState, setSaveState] = useState<AsyncState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);

  // export + upload
  const [exportState, setExportState] = useState<AsyncState>("idle");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportedDataUrl, setExportedDataUrl] = useState<string | null>(null);

  // publish
  const [publishState, setPublishState] = useState<AsyncState>("idle");
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null);
  // which platforms are selected; starts with just facebook (the only live one)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["facebook"]);

  // ---------------------------------------------------------------------------
  // Draft loading on mount
  // ---------------------------------------------------------------------------
  
  // Helper to mark content as changed
  const markAsChanged = () => {
    if (isEditingDraft) setHasUnsavedChanges(true);
  };
  
  useEffect(() => {
    const draftId = searchParams.get("draft");
    if (!draftId) {
      // No draft ID - ensure we're in "create new" mode
      setIsEditingDraft(false);
      setHasUnsavedChanges(false);
      setHistoryId(null);
      return;
    }
    
    if (!token) return;

    const loadDraft = async () => {
      try {
        const draft = await apiGet<DraftHistory>(`${API_BASE}/api/social-post/history/${draftId}`, token);
        
        // Pre-fill all the state
        setQuery(draft.query || "");
        setData({
          headline: draft.headline || "",
          description: draft.description || "",
          story_description: draft.story_description || "",
          hashtags: draft.hashtags || [],
          news_results: draft.news_results || [],
        });
        setEditedHeadline(draft.headline || "");
        setEditedDescription(draft.description || "");
        setHistoryId(draft.id);
        setIsEditingDraft(true);
        setHasUnsavedChanges(false); // No unsaved changes when just loaded
        setSaveState("success"); // Mark as already saved
        
        // Auto-select the first article for source/date metadata
        const firstArticle = draft.news_results?.[0] ?? null;
        setSelectedArticle(firstArticle);
        
        // If there's an existing media file, show it
        if (draft.media_filename) {
          setExportState("success");
          const mediaUrl = `${API_BASE}/uploads/social/${draft.media_filename}`;
          setExportedDataUrl(mediaUrl);
        }
        
        // Set up the background image gallery - combining article thumbnails + search results
        if (draft.news_results?.length > 0) {
          const articleBgImages = draft.news_results
            .filter((a: NewsResult) => a.thumbnail)
            .map((a: NewsResult) => ({
              thumbnail: proxyImageUrl(a.thumbnail),
              original: proxyImageUrl(a.thumbnail),
              title: a.title,
              source: a.source,
            }));
          setBgImages(articleBgImages);
          
          // Auto-select the first image if no media file exists
          if (!draft.media_filename && articleBgImages[0]) {
            setSelectedImageUrl(articleBgImages[0].original);
          }
        }
        
        // Also load fresh image search results
        if (draft.query) {
          setBgLoading(true);
          try {
            const res = await fetch(
              `${API_BASE}/api/images/search?query=${encodeURIComponent(draft.query)}`,
              token ? { headers: { Authorization: `Bearer ${token}` } } : {}
            );
            if (res.ok) {
              const imgs: ImageResult[] = await res.json();
              const valid: BgImage[] = imgs
                .filter((i) => i.original && i.thumbnail)
                .map((i) => ({
                  thumbnail: proxyImageUrl(i.thumbnail!),
                  original: proxyImageUrl(i.original!),
                  title: i.title ?? "",
                  source: i.source ?? "",
                }));
              setBgImages(prev => [...prev, ...valid]); // Append search results to articles
            }
          } finally {
            setBgLoading(false);
          }
        }
        
        setGenerateState("success");
      } catch (err) {
        console.error("Failed to load draft:", err);
        // Don't show error in UI, just fall back to normal create flow
      }
    };

    loadDraft();
  }, [searchParams, token]);

  // ---------------------------------------------------------------------------
  // Step 1 — Generate
  // ---------------------------------------------------------------------------
  async function handleGenerate() {
    if (!query.trim()) return;

    setGenerateState("loading");
    setGenerateError(null);
    setData(null);
    setEditedHeadline("");
    setEditedDescription("");
    setSelectedArticle(null);
    setBgImages([]);
    setSelectedImageUrl(null);
    setSaveState("idle");
    setSaveError(null);
    setHistoryId(null);
    setIsEditingDraft(false); // Reset to "create new" mode when generating fresh content
    setHasUnsavedChanges(false); // Reset unsaved changes
    setExportState("idle");
    setExportedDataUrl(null);
    setPublishState("idle");
    setSelectedPlatforms(["facebook"]);

    try {
      // Fire generate and image search in parallel
      const [json] = await Promise.all([
        apiFetch<GeneratedData>(`${API_BASE}/api/social-post/generate`, { query }, token),
        // Image search runs alongside; results populate the gallery asynchronously
        (async () => {
          setBgLoading(true);
          try {
            const res = await fetch(
              `${API_BASE}/api/images/search?query=${encodeURIComponent(query)}`,
              token ? { headers: { Authorization: `Bearer ${token}` } } : {}
            );
            if (res.ok) {
              const imgs: ImageResult[] = await res.json();
              const valid: BgImage[] = imgs
                .filter((i) => i.original && i.thumbnail)
                .map((i) => ({
                  thumbnail: proxyImageUrl(i.thumbnail!),
                  original: proxyImageUrl(i.original!),
                  title: i.title ?? "",
                  source: i.source ?? "",
                }));
              setBgImages(valid);
            } else if (res.status === 401) {
              router.replace("/login");
            }
          } finally {
            setBgLoading(false);
          }
        })(),
      ]);

      setData(json);
      setEditedHeadline(json.headline);
      setEditedDescription(json.description);
      // Auto-select the first article for source/date metadata
      const firstArticle = json.news_results?.[0] ?? null;
      setSelectedArticle(firstArticle);
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
      if (isEditingDraft && historyId) {
        // Update existing draft
        await apiFetch(
          `${API_BASE}/api/social-post/history/${historyId}`,
          {
            query,
            headline: editedHeadline,
            description: editedDescription,
            story_description: data.story_description,
            hashtags: data.hashtags,
            news_results: data.news_results,
          },
          token,
          "PUT"
        );
      } else {
        // Create new draft
        const saved = await apiFetch<{ id: number }>(
          `${API_BASE}/api/social-post/history`,
          {
            query,
            headline: editedHeadline,
            description: editedDescription,
            story_description: data.story_description,
            hashtags: data.hashtags,
            news_results: data.news_results,
          },
          token
        );
        setHistoryId(saved.id);
        setIsEditingDraft(true);
      }
      setHasUnsavedChanges(false); // Clear unsaved changes flag after successful save
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
      const file = await exportCardAsPng(captureRef.current, `post-${historyId}.png`);
      const localUrl = URL.createObjectURL(file);
      setExportedDataUrl(localUrl);
      await uploadCardMedia(historyId, file, token);
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
        { platforms: selectedPlatforms },
        token
      );
      setPublishResult(result);
      setPublishState("success");
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Unknown error");
      setPublishState("error");
    }
  }

  // ---------------------------------------------------------------------------
  // Reset to create new post
  // ---------------------------------------------------------------------------
  function handleNewPost() {
    // Clear URL params and navigate to clean create page
    router.push("/dashboard/create");
    
    // Reset all state to initial values
    setQuery("");
    setIsEditingDraft(false);
    setHasUnsavedChanges(false);
    
    setGenerateState("idle");
    setGenerateError(null);
    setData(null);
    setEditedHeadline("");
    setEditedDescription("");
    setSelectedArticle(null);
    setSelectedVariant("dark");
    
    setBgImages([]);
    setBgLoading(false);
    setSelectedImageUrl(null);
    
    setSaveState("idle");
    setSaveError(null);
    setHistoryId(null);
    
    setExportState("idle");
    setExportError(null);
    setExportedDataUrl(null);
    
    setPublishState("idle");
    setPublishError(null);
    setPublishResult(null);
    setSelectedPlatforms(["facebook"]);
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

  // selectedArticle drives the card preview; falls back to first result
  const activeArticle = selectedArticle ?? data?.news_results?.[0] ?? null;
  const showCardPanel = hasResults && isSaved;

  // Build the unified background image list:
  // 1. Article thumbnails (prepended) — keeps the existing article choice visible
  // 2. Image search results
  const articleBgImages: BgImage[] = (data?.news_results ?? [])
    .filter((a) => a.thumbnail)
    .map((a) => ({
      thumbnail: proxyImageUrl(a.thumbnail),
      original: proxyImageUrl(a.thumbnail),
      title: a.title,
      source: a.source,
    }));

  const allBgImages: BgImage[] = [...articleBgImages, ...bgImages];

  // The active image URL for the card — selectedImageUrl wins (set by gallery or upload),
  // otherwise fall back to the first image in the combined list
  // For minimal variant, image isn't displayed so we can use a placeholder
  const activeImageUrl = selectedImageUrl ?? allBgImages[0]?.original ?? 
    (selectedVariant === "minimal" ? "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB2aWV3Qm94PSIwIDAgMSAxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNmZmZmZmYiLz48L3N2Zz4=" : "");

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-10">

          {/* Page heading */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                {isEditingDraft && (
                  <div className="mb-3">
                    <button
                      onClick={() => router.push("/dashboard/history")}
                      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition"
                    >
                      <ArrowLeftIcon className="h-4 w-4" />
                      Back to History
                    </button>
                  </div>
                )}
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {isEditingDraft ? "Edit draft" : "Create a social post"}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {isEditingDraft 
                    ? "Update your draft and continue from where you left off."
                    : "Enter a topic and let AI generate a ready-to-publish post card."}
                </p>
              </div>
              {(hasResults || isEditingDraft) && (
                <button
                  onClick={handleNewPost}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition"
                >
                  <PlusIcon className="h-4 w-4" />
                  {publishState === "success" ? "Create Another" : "New Post"}
                </button>
              )}
            </div>
          </div>

          {/* Query input */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
            <SectionLabel>Topic / Query</SectionLabel>
            <div className="flex gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  markAsChanged();
                }}
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
          {/* Background image gallery — shown after generation              */}
          {/* Article thumbnails are prepended; image search fills the rest  */}
          {/* Hidden for minimal variant which doesn't use images            */}
          {/* ---------------------------------------------------------------- */}
          {hasResults && selectedVariant !== "minimal" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Background image</SectionLabel>
                <div className="flex items-center gap-2">
                  {bgLoading && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Spinner className="text-slate-400" />
                      Loading images…
                    </span>
                  )}
                  {!bgLoading && allBgImages.length > 0 && (
                    <span className="text-xs text-slate-400">{allBgImages.length} images</span>
                  )}
                </div>
              </div>

              {allBgImages.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 max-h-80 overflow-y-auto pr-1">
                  {allBgImages.map((img, i) => {
                    const isSelected = activeImageUrl === img.original;
                    const isArticle = i < articleBgImages.length;
                    return (
                      <button
                        key={`${img.original}-${i}`}
                        onClick={() => {
                          setSelectedImageUrl(img.original);
                          markAsChanged();
                        }}
                        className={`relative group rounded-lg overflow-hidden border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 hover:scale-105 hover:shadow-lg ${
                          isSelected
                            ? "border-indigo-500 shadow-md"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {/* Thumbnail — compact size */}
                        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden" style={{ height: '100px' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.thumbnail}
                            alt={img.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                            loading="lazy"
                          />
                          
                          {/* "From article" pill for article images */}
                          {isArticle && (
                            <span className="absolute top-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white">
                              Article
                            </span>
                          )}
                          
                          {/* Selected checkmark */}
                          {isSelected && (
                            <div className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 shadow-md">
                              <CheckIcon className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        
                        {/* Compact caption */}
                        {img.title && (
                          <div className="px-2 py-1.5 bg-white border-t border-slate-100">
                            <p className="text-[10px] text-slate-500 font-medium truncate leading-tight">
                              {img.title}
                            </p>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : bgLoading ? (
                /* Skeleton grid while loading */
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="aspect-[4/3] rounded-lg bg-slate-100 animate-pulse" style={{ height: '100px' }} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-3">No images found for this query.</p>
              )}
            </div>
          )}

          {/* Note for minimal template */}
          {hasResults && selectedVariant === "minimal" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
              <SectionLabel>Template Style</SectionLabel>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                  <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-slate-900">Text-focused design</p>
                  <p className="text-xs text-slate-500">The minimal template uses typography and clean layout instead of background images.</p>
                </div>
              </div>
            </div>
          )}

          {/* Two-column area */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

            {/* Left column */}
            <div className="space-y-4">

              {/* Headline */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <SectionLabel>Headline</SectionLabel>
                {hasResults ? (
                  <p className="text-lg font-bold text-slate-900 leading-snug">
                    {editedHeadline}
                  </p>
                ) : (
                  <SkeletonBlock className={`h-7 w-3/4 ${isGenerating ? "" : "opacity-30"}`} />
                )}
              </div>

              {/* Description */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <SectionLabel>Description</SectionLabel>
                {hasResults ? (
                  <p className="text-sm text-slate-600 leading-relaxed">{editedDescription}</p>
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
                        disabled={anyBusy || (!isEditingDraft && isSaved) || (isEditingDraft && !hasUnsavedChanges)}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {isSaving 
                          ? <><Spinner className="text-slate-500" />{isEditingDraft ? "Updating…" : "Saving…"}</>
                          : isEditingDraft ? "Update draft" : "Save draft"}
                      </button>
                      {isSaved && historyId && (
                        <SuccessBadge>
                          {isEditingDraft 
                            ? hasUnsavedChanges 
                              ? "Changes saved" 
                              : "No unsaved changes"
                            : `Draft saved — id ${historyId}`}
                        </SuccessBadge>
                      )}
                    </div>
                    {saveState === "error" && saveError && (
                      <div className="mt-3">
                        <ErrorBanner message={`Could not save draft — ${saveError}`} />
                      </div>
                    )}
                  </div>

                  {/* Export + Publish */}
                  {isSaved && (
                    <div className="space-y-4 pt-3 border-t border-slate-100">

                      {/* Create image row */}
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={handleExportAndUpload}
                          disabled={anyBusy || isExported}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {isExporting
                            ? <><Spinner className="text-slate-500" />Creating image…</>
                            : isExported ? "Update image" : "Create image"}
                        </button>
                        {isExported && <SuccessBadge>Image uploaded</SuccessBadge>}
                      </div>

                      {exportState === "error" && exportError && (
                        <ErrorBanner message={`Image export failed — ${exportError}`} />
                      )}

                      {/* Platform selector */}
                      {isExported && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                            Publish to
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {PLATFORMS.map((platform) => {
                              const isSelected = selectedPlatforms.includes(platform.id);
                              return (
                                <button
                                  key={platform.id}
                                  disabled={!platform.publishEnabled}
                                  title={platform.publishEnabled ? platform.label : `${platform.label} — coming soon`}
                                  onClick={() => {
                                    if (!platform.publishEnabled) return;
                                    setSelectedPlatforms((prev) =>
                                      prev.includes(platform.id)
                                        ? prev.filter((p) => p !== platform.id)
                                        : [...prev, platform.id]
                                    );
                                  }}
                                  className={`relative flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition
                                    ${platform.publishEnabled
                                      ? isSelected
                                        ? "border-transparent text-white shadow-sm"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                      : "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                                    }`}
                                  style={
                                    platform.publishEnabled && isSelected
                                      ? { backgroundColor: platform.color, borderColor: platform.color }
                                      : undefined
                                  }
                                >
                                  <span
                                    className={
                                      platform.publishEnabled
                                        ? isSelected ? "text-white" : "text-slate-500"
                                        : "text-slate-300"
                                    }
                                  >
                                    {platform.icon}
                                  </span>
                                  {platform.label}
                                  {!platform.publishEnabled && (
                                    <span className="ml-0.5 text-slate-300 text-xs">·</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          {selectedPlatforms.length === 0 && (
                            <p className="text-xs text-amber-600">Select at least one platform to publish.</p>
                          )}
                        </div>
                      )}

                      {/* Publish button */}
                      {isExported && (
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            onClick={handlePublish}
                            disabled={anyBusy || publishState === "success" || selectedPlatforms.length === 0}
                            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                          >
                            {isPublishing ? <><Spinner />Publishing…</> : "Publish"}
                          </button>
                          {publishState === "success" && <SuccessBadge>Published!</SuccessBadge>}
                          {publishState === "success" && (
                            <button
                              onClick={handleNewPost}
                              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
                            >
                              <PlusIcon className="h-4 w-4" />
                              New Post
                            </button>
                          )}
                        </div>
                      )}

                      {publishState === "error" && publishError && (
                        <ErrorBanner message={`Publish request failed — ${publishError}`} />
                      )}

                      {/* Per-platform results */}
                      {publishResult && (
                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                          {publishResult.results.map((r) => {
                            const succeeded = r.status === "published" || r.status === "success";
                            return (
                              <div
                                key={r.platform}
                                className={`flex items-start gap-3 px-4 py-3 text-sm border-b last:border-b-0 ${
                                  succeeded ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
                                }`}
                              >
                                <span className={`mt-0.5 font-semibold capitalize ${succeeded ? "text-emerald-700" : "text-red-700"}`}>
                                  {r.platform}
                                </span>
                                <div className="flex-1 min-w-0">
                                  {succeeded
                                    ? <span className="text-emerald-700 font-medium">Published</span>
                                    : <span className="text-red-700 font-medium">Failed</span>}
                                  {r.error && (
                                    <p className="mt-0.5 text-xs text-red-600 break-words">{r.error}</p>
                                  )}
                                </div>
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

            {/* Right column: card preview */}
            <div className="sticky top-6 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <SectionLabel>Card preview</SectionLabel>

                {/* Template picker */}
                <div className="flex gap-3 mb-4 overflow-x-auto pb-2">
                  {TEMPLATES.map((tpl) => {
                    const isActive = selectedVariant === tpl.id;
                    // Tiny thumbnail previews — same scale trick as the main preview
                    return (
                      <button
                        key={tpl.id}
                        onClick={() => setSelectedVariant(tpl.id)}
                        title={tpl.label}
                        className={`relative flex-shrink-0 rounded-xl overflow-hidden border-2 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
                          isActive ? "border-indigo-500 shadow-lg" : "border-slate-200 hover:border-slate-300"
                        }`}
                        style={{ width: 72, aspectRatio: "4/5" }}
                      >
                        {/* Scaled-down card thumbnail */}
                        <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
                          <div style={{ 
                            transformOrigin: "top left", 
                            transform: "scale(0.067)", // 1080px → 72px
                            width: 1080, 
                            height: 1350, 
                            pointerEvents: "none" 
                          }}>
                            <NewsPostCard
                              imageUrl={activeImageUrl}
                              source={activeArticle?.source ?? "Source"}
                              date={activeArticle?.date ?? "DATE"}
                              headline={editedHeadline || data?.headline || "Headline text goes here"}
                              description={editedDescription || data?.description || "Description preview"}
                              hashtags={data?.hashtags ?? []}
                              variant={tpl.id}
                            />
                          </div>
                        </div>
                        
                        {/* Selected checkmark */}
                        {isActive && (
                          <div className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 shadow-sm">
                            <CheckIcon className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                        
                        {/* Label at bottom */}
                        <div className={`absolute bottom-0 left-0 right-0 px-1 py-1 text-center text-[10px] font-medium leading-tight ${
                          isActive ? "text-indigo-700 bg-white/95" : "text-slate-600 bg-white/90"
                        }`}>
                          {tpl.label}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {showCardPanel ? (
                  <div
                    style={{ width: "100%", aspectRatio: "4/5", overflow: "hidden", borderRadius: 12 }}
                  >
                    <div style={{ transformOrigin: "top left", transform: "scale(0.315)", width: 1080, height: 1350 }}>
                      <NewsPostCard
                        imageUrl={activeImageUrl}
                        source={activeArticle?.source ?? ""}
                        date={activeArticle?.date ?? ""}
                        headline={editedHeadline}
                        description={editedDescription}
                        hashtags={data!.hashtags}
                        variant={selectedVariant}
                        onChangeHeadline={(newHeadline) => {
                          setEditedHeadline(newHeadline);
                          markAsChanged();
                        }}
                        onChangeDescription={(newDescription) => {
                          setEditedDescription(newDescription);
                          markAsChanged();
                        }}
                      />
                    </div>
                  </div>
                ) : (
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

      {/* Off-screen capture target */}
      {showCardPanel && (
        <div aria-hidden="true" style={{ position: "fixed", left: -9999, top: 0, pointerEvents: "none" }}>
          <div ref={captureRef}>
            <NewsPostCard
              imageUrl={activeImageUrl}
              source={activeArticle?.source ?? ""}
              date={activeArticle?.date ?? ""}
              headline={editedHeadline}
              description={editedDescription}
              hashtags={data!.hashtags}
              variant={selectedVariant}
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

function ArrowLeftIcon({ className = "" }: { className?: string }) {
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  );
}

function PlusIcon({ className = "" }: { className?: string }) {
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
