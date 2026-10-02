"use client";

import { useAuth } from "@/lib/auth-context";
import { useRef, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NewsPostCard, { TEMPLATES, type TemplateVariant } from "@/components/social-post/news-post-template";
import { exportCardAsPng, uploadCardMedia } from "@/lib/export-post-screenshot";
import { PLATFORMS } from "@/lib/platforms";
import { apiFetch, apiGet } from "@/lib/api";

// Icons
// import { 
//   ExclamationTriangleIcon as AlertIcon,
//   CheckIcon,
//   ArrowLeftIcon,
//   PlusIcon,
//   ArrowTopRightOnSquareIcon as ExternalLinkIcon,
//   ArrowPathIcon as Spinner
// } from "@heroicons/react/24/outline";

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
  story_description: string;
  hashtags: string[];
  news_results: NewsResult[];
  variants: {
    [platform: string]: {
      description: string;
      aspect_ratio: string;
      width: number;
      height: number;
      description_max_chars: number;
    };
  };
}

interface PlatformVariantState {
  description: string;
  imageUrl: string | null;  // Selected background image for this platform
  mediaUrl: string | null;   // Exported card image URL
  publishStatus: string;
  aspect_ratio: string;
  width: number;
  height: number;
  description_max_chars: number;
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

interface PlatformVariant {
  id: number;
  history_id: number;
  platform: string;
  description: string | null;
  media_url: string | null;
  aspect_ratio: string | null;
  width: number | null;
  height: number | null;
  publish_status: string;
  external_id: string | null;
  external_url: string | null;
  error: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
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
  social_post_platform_variants?: PlatformVariant[];
}

interface ReadyPlatformsResponse {
  ready_platforms: string[];
}

type AsyncState = "idle" | "loading" | "success" | "error";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps an external image URL through our backend proxy so the browser
 * sees it as same-origin. Required for canvas capture (domToPng) to work
 * without CORS taint. Skip for blob: and data: URLs (user uploads) and
 * for URLs already pointing at our own API.
 */
function proxyImageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("/api/")) return url;
  return `/api/images/proxy?url=${encodeURIComponent(url)}`;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuth();

  const [query, setQuery] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["facebook"]);  // Multi-select for generation

  // generate
  const [generateState, setGenerateState] = useState<AsyncState>("idle");
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [data, setData] = useState<GeneratedData | null>(null);
  
  // Shared fields across all platforms
  const [editedHeadline, setEditedHeadline] = useState<string>("");
  const [editedStoryDescription, setEditedStoryDescription] = useState<string>("");
  const [editedHashtags, setEditedHashtags] = useState<string[]>([]);
  
  // Per-platform variant state
  const [platformVariantsState, setPlatformVariantsState] = useState<{
    [platform: string]: PlatformVariantState;
  }>({});
  
  // Active platform tab
  const [activePlatformTab, setActivePlatformTab] = useState<string>("");
  
  // Shared background image (used by all platforms unless overridden)
  const [sharedImageUrl, setSharedImageUrl] = useState<string | null>(null);
  
  // the article the user has selected as the basis for the card image
  const [selectedArticle, setSelectedArticle] = useState<NewsResult | null>(null);
  // which visual template is active
  const [selectedVariant, setSelectedVariant] = useState<TemplateVariant>("dark");

  // background image gallery
  const [bgImages, setBgImages] = useState<BgImage[]>([]);
  const [bgLoading, setBgLoading] = useState(false);

  // save draft
  const [saveState, setSaveState] = useState<AsyncState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);

  // export + upload - now per-platform
  const [exportingPlatforms, setExportingPlatforms] = useState<Set<string>>(new Set());
  const [exportErrors, setExportErrors] = useState<{ [platform: string]: string }>({});

  // publish - enhanced multi-platform system
  const [publishState, setPublishState] = useState<AsyncState>("idle");
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null);
  const [selectedPlatformsForPublish, setSelectedPlatformsForPublish] = useState<string[]>([]);
  const [platformVariants, setPlatformVariants] = useState<PlatformVariant[]>([]);
  const [readyPlatforms, setReadyPlatforms] = useState<string[]>([]);
  
  // Draft editing state
  const [isEditingDraft, setIsEditingDraft] = useState<boolean>(false);
  
  // Last saved snapshot for change detection
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<{
    query: string;
    headline: string;
    story_description: string;
    hashtags: string[];
    sharedImageUrl: string | null;
    variants: {
      [platform: string]: {
        description: string;
        imageUrl: string | null;
      };
    };
  } | null>(null);

  // ---------------------------------------------------------------------------
  // Draft loading on mount
  // ---------------------------------------------------------------------------
  
  // Derived state: check if current form state differs from last saved snapshot
  const currentSnapshot = {
    query,
    headline: editedHeadline,
    story_description: editedStoryDescription,
    hashtags: editedHashtags,
    sharedImageUrl,
    variants: Object.keys(platformVariantsState).reduce((acc, platform) => {
      acc[platform] = {
        description: platformVariantsState[platform]?.description || "",
        imageUrl: platformVariantsState[platform]?.imageUrl || null,
      };
      return acc;
    }, {} as { [platform: string]: { description: string; imageUrl: string | null } })
  };
  
  const hasUnsavedChanges = isEditingDraft && lastSavedSnapshot && 
    JSON.stringify(currentSnapshot) !== JSON.stringify(lastSavedSnapshot);

  useEffect(() => {
    const draftId = searchParams.get("draft");
    if (!draftId) {
      // No draft ID - ensure we're in "create new" mode
      setIsEditingDraft(false);
      setLastSavedSnapshot(null);
      setHistoryId(null);
      return;
    }
    
    if (!token) return;

    const loadDraft = async () => {
      try {
        const draft = await apiGet<DraftHistory>(`/api/social-post/history/${draftId}`, token);
        
        // Pre-fill all the state
        setQuery(draft.query || "");
        // For drafts created before multi-platform support, we need to handle the old single description field
        // Build a variants object with default Facebook platform
        const variants: GeneratedData["variants"] = {
          facebook: {
            description: draft.description || "",
            aspect_ratio: "1:1",
            width: 1200,
            height: 1200,
            description_max_chars: 280,
          }
        };
        
        setData({
          headline: draft.headline || "",
          story_description: draft.story_description || "",
          hashtags: draft.hashtags || [],
          news_results: draft.news_results || [],
          variants,
        });
        setEditedHeadline(draft.headline || "");
        setEditedStoryDescription(draft.story_description || "");
        
        // Initialize platform variant state for the draft
        // Check if we have loaded variants from the database
        const platformVariantsFromDB: { [platform: string]: PlatformVariantState } = {};
        
        if (draft.social_post_platform_variants && draft.social_post_platform_variants.length > 0) {
          // Load from database variants
          draft.social_post_platform_variants.forEach(dbVariant => {
            platformVariantsFromDB[dbVariant.platform] = {
              description: dbVariant.description || "",
              imageUrl: null, // Custom background image (not the exported card)
              mediaUrl: dbVariant.media_url, // Exported card image URL
              publishStatus: dbVariant.publish_status,
              aspect_ratio: dbVariant.aspect_ratio || "1:1",
              width: dbVariant.width || 1200,
              height: dbVariant.height || 1200,
              description_max_chars: 280, // Default, should be in settings if needed
            };
          });
          setPlatformVariantsState(platformVariantsFromDB);
          setActivePlatformTab(Object.keys(platformVariantsFromDB)[0] || "facebook");
        } else {
          // Fallback: Old draft without variants
          platformVariantsFromDB.facebook = {
            description: draft.description || "",
            imageUrl: null,
            mediaUrl: draft.media_filename ? (
              draft.media_filename.startsWith('http') 
                ? draft.media_filename 
                : `/uploads/social/${draft.media_filename}`
            ) : null,
            publishStatus: draft.media_filename ? "media_ready" : "draft",
            aspect_ratio: "1:1",
            width: 1200,
            height: 1200,
            description_max_chars: 280,
          };
          setPlatformVariantsState(platformVariantsFromDB);
          setActivePlatformTab("facebook");
        }
        setHistoryId(draft.id);
        setIsEditingDraft(true);
        
        // Set the saved snapshot to current loaded state
        const snapshotVariants: { [platform: string]: { description: string; imageUrl: string | null } } = {};
        Object.keys(platformVariantsFromDB).forEach(platform => {
          snapshotVariants[platform] = {
            description: platformVariantsFromDB[platform].description,
            imageUrl: platformVariantsFromDB[platform].imageUrl,
          };
        });
        
        setLastSavedSnapshot({
          query: draft.query || "",
          headline: draft.headline || "",
          story_description: draft.story_description || "",
          hashtags: draft.hashtags || [],
          sharedImageUrl: null, // Will be set later if media exists
          variants: snapshotVariants,
        });
        
        setSaveState("success"); // Mark as already saved
        
        // Auto-select the first article for source/date metadata
        const firstArticle = draft.news_results?.[0] ?? null;
        setSelectedArticle(firstArticle);
        
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
            setSharedImageUrl(articleBgImages[0].original);
          }
        }
        
        // Also load fresh image search results
        if (draft.query) {
          setBgLoading(true);
          try {
            const res = await fetch(
              `/api/images/search?query=${encodeURIComponent(draft.query)}`,
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

  // Update snapshot when sharedImageUrl changes for loaded drafts
  useEffect(() => {
    if (isEditingDraft && lastSavedSnapshot && sharedImageUrl !== lastSavedSnapshot.sharedImageUrl) {
      // Only update if this is the initial load (we have a snapshot but sharedImageUrl was null)
      if (lastSavedSnapshot.sharedImageUrl === null) {
        setLastSavedSnapshot(prev => prev ? {
          ...prev,
          sharedImageUrl
        } : null);
      }
    }
  }, [sharedImageUrl, isEditingDraft, lastSavedSnapshot]);

  // Load platform variants and check ready platforms when historyId changes
  useEffect(() => {
    if (historyId && token) {
      loadPlatformVariants();
      checkReadyPlatforms();
    }
  }, [historyId, token]);

  // Auto-check platforms when they become media_ready
  useEffect(() => {
    const readyPlatformIds = Object.keys(platformVariantsState).filter(
      (platformId) => platformVariantsState[platformId]?.publishStatus === "media_ready"
    );
    
    // Only auto-check platforms that aren't already published
    const unpublishedReady = readyPlatformIds.filter((platformId) => {
      const result = publishResult?.results.find((r) => r.platform === platformId);
      return !result || (result.status !== "published" && result.status !== "success");
    });
    
    setSelectedPlatformsForPublish(unpublishedReady);
  }, [platformVariantsState, publishResult]);

  // ---------------------------------------------------------------------------
  // Reset to initial state for creating a new post
  // ---------------------------------------------------------------------------
  function resetForm() {
    // Reset all form state to initial values
    setQuery("");
    setSelectedPlatforms(["facebook"]);  // Reset to default multi-select
    
    // Clear generation results
    setGenerateState("idle");
    setGenerateError(null);
    setData(null);
    setEditedHeadline("");
    setEditedStoryDescription("");
    setEditedHashtags([]);
    setPlatformVariantsState({});
    setActivePlatformTab("");
    setSelectedArticle(null);
    
    // Clear background images
    setBgImages([]);
    setBgLoading(false);
    setSharedImageUrl(null);
    
    // Clear save state
    setSaveState("idle");
    setSaveError(null);
    setHistoryId(null);
    
    // Clear export state
    setExportingPlatforms(new Set());
    setExportErrors({});
    
    // Clear publish state
    setPublishState("idle");
    setPublishError(null);
    setPublishResult(null);
    setSelectedPlatformsForPublish([]);
    setPlatformVariants([]);
    setReadyPlatforms([]);
  }

  // ---------------------------------------------------------------------------
  // Step 1 — Generate
  // ---------------------------------------------------------------------------
  async function handleGenerate() {
    if (!query.trim()) return;

    setGenerateState("loading");
    setGenerateError(null);
    setData(null);
    setEditedHeadline("");
    setEditedStoryDescription("");
    setEditedHashtags([]);
    setPlatformVariantsState({});
    setActivePlatformTab("");
    setSelectedArticle(null);
    setBgImages([]);
    setSharedImageUrl(null);
    setSaveState("idle");
    setSaveError(null);
    setHistoryId(null);
    setIsEditingDraft(false);
    setLastSavedSnapshot(null);
    setExportingPlatforms(new Set());
    setExportErrors({});
    setPublishState("idle");
    setSelectedPlatformsForPublish([]);
    setPlatformVariants([]);
    setReadyPlatforms([]);

    try {
      // Fire generate and image search in parallel
      const [json] = await Promise.all([
        apiFetch<GeneratedData>(`/api/social-post/generate`, { query, platforms: selectedPlatforms }, token),
        // Image search runs alongside
        (async () => {
          setBgLoading(true);
          try {
            const headers: HeadersInit = {};
            if (token) {
              headers["Authorization"] = `Bearer ${token}`;
            }
            const res = await fetch(`/api/images/search?query=${encodeURIComponent(query)}`, { headers });
            if (res.status === 401) {
              localStorage.removeItem("auth_token");
              router.push("/login");
              return;
            }
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
      setEditedStoryDescription(json.story_description);
      setEditedHashtags(json.hashtags);
      
      // Initialize platform variant state from response
      const variantsState: { [platform: string]: PlatformVariantState } = {};
      Object.keys(json.variants).forEach(platform => {
        const variant = json.variants[platform];
        variantsState[platform] = {
          description: variant.description,
          imageUrl: null,  // Will use shared image by default
          mediaUrl: null,
          publishStatus: "draft",
          aspect_ratio: variant.aspect_ratio,
          width: variant.width,
          height: variant.height,
          description_max_chars: variant.description_max_chars,
        };
      });
      setPlatformVariantsState(variantsState);
      
      // Set first platform as active tab
      const firstPlatform = Object.keys(json.variants)[0];
      if (firstPlatform) {
        setActivePlatformTab(firstPlatform);
      }
      
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
      // Build variants object from platformVariantsState
      const variants: {
        [platform: string]: {
          description: string;
          aspect_ratio: string;
          width: number;
          height: number;
        };
      } = {};
      
      Object.keys(platformVariantsState).forEach(platform => {
        const variant = platformVariantsState[platform];
        variants[platform] = {
          description: variant.description,
          aspect_ratio: variant.aspect_ratio,
          width: variant.width,
          height: variant.height,
        };
      });
      
      const payload = {
        user_id: 1,
        query,
        headline: editedHeadline,
        story_description: editedStoryDescription,
        hashtags: editedHashtags,
        news_results: data.news_results,
        settings_snapshot: null, // Can be used for additional metadata if needed
        variants,
      };
      
      let saved: { id: number };
      
      if (isEditingDraft && historyId) {
        // Update existing draft (PUT)
        saved = await apiFetch<{ id: number }>(
          `/api/social-post/history/${historyId}`,
          payload,
          token,
          "PUT"
        );
      } else {
        // Create new draft (POST)
        saved = await apiFetch<{ id: number }>(
          `/api/social-post/history`,
          payload,
          token
        );
        setHistoryId(saved.id);
        setIsEditingDraft(true);
      }
      
      setSaveState("success");
      
      // Update the saved snapshot to reflect current state
      setLastSavedSnapshot({
        query,
        headline: editedHeadline,
        story_description: editedStoryDescription,
        hashtags: editedHashtags,
        sharedImageUrl,
        variants: Object.keys(platformVariantsState).reduce((acc, platform) => {
          acc[platform] = {
            description: platformVariantsState[platform]?.description || "",
            imageUrl: platformVariantsState[platform]?.imageUrl || null,
          };
          return acc;
        }, {} as { [platform: string]: { description: string; imageUrl: string | null } }),
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unknown error");
      setSaveState("error");
    }
  }

  // ---------------------------------------------------------------------------
  // Step 2b — Export card image and upload (per-platform)
  // ---------------------------------------------------------------------------
  async function handleExportAndUploadForPlatform(platform: string) {
    if (!data || !historyId || !captureRef.current) return;

    const variant = platformVariantsState[platform];
    if (!variant) return;

    // Mark this platform as exporting
    setExportingPlatforms(prev => new Set(prev).add(platform));
    setExportErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[platform];
      return newErrors;
    });

    try {
      const file = await exportCardAsPng(
        captureRef.current,
        `post-${historyId}-${platform}.png`,
        variant.width,
        variant.height
      );
      
      const response = await uploadCardMedia(historyId, platform, file, token);
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Update platform variant state with media URL and status
      setPlatformVariantsState(prev => ({
        ...prev,
        [platform]: {
          ...prev[platform],
          mediaUrl: result.media_url,
          publishStatus: "media_ready",
        },
      }));
      
      // Remove from exporting set
      setExportingPlatforms(prev => {
        const newSet = new Set(prev);
        newSet.delete(platform);
        return newSet;
      });
    } catch (err) {
      setExportErrors(prev => ({
        ...prev,
        [platform]: err instanceof Error ? err.message : "Unknown error",
      }));
      
      // Remove from exporting set
      setExportingPlatforms(prev => {
        const newSet = new Set(prev);
        newSet.delete(platform);
        return newSet;
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Enhanced Multi-Platform Publish Functions
  // ---------------------------------------------------------------------------
  
  async function checkReadyPlatforms() {
    if (!historyId || !token) return;
    
    try {
      const response = await apiGet<ReadyPlatformsResponse>(`/api/social-post/history/${historyId}/publish`, token);
      setReadyPlatforms(response.ready_platforms);
      // Pre-check all ready platforms by default
      setSelectedPlatformsForPublish(response.ready_platforms);
    } catch (err) {
      console.error("Failed to check ready platforms:", err);
    }
  }

  async function loadPlatformVariants() {
    if (!historyId || !token) return;
    
    try {
      const entry = await apiGet<DraftHistory>(`/api/social-post/history/${historyId}`, token);
      if (entry.social_post_platform_variants) {
        setPlatformVariants(entry.social_post_platform_variants);
      }
    } catch (err) {
      console.error("Failed to load platform variants:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 3 — Enhanced Multi-Platform Publish
  // ---------------------------------------------------------------------------
  async function handlePublish() {
    if (!historyId || selectedPlatformsForPublish.length === 0) return;

    setPublishState("loading");
    setPublishError(null);
    setPublishResult(null);

    try {
      const result = await apiFetch<PublishResponse>(
        `/api/social-post/history/${historyId}/publish`,
        { platforms: selectedPlatformsForPublish },
        token
      );
      setPublishResult(result);
      setPublishState("success");
      
      // Reload platform variants to get updated publish statuses
      await loadPlatformVariants();
      await checkReadyPlatforms();
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
    setLastSavedSnapshot(null);
    
    setGenerateState("idle");
    setGenerateError(null);
    setData(null);
    setEditedHeadline("");
    setEditedStoryDescription("");
    setEditedHashtags([]);
    setPlatformVariantsState({});
    setActivePlatformTab("");
    setSelectedArticle(null);
    setSelectedVariant("dark");
    
    setBgImages([]);
    setBgLoading(false);
    setSharedImageUrl(null);
    
    setSaveState("idle");
    setSaveError(null);
    setHistoryId(null);
    
    setExportingPlatforms(new Set());
    setExportErrors({});
    
    setPublishState("idle");
    setPublishError(null);
    setPublishResult(null);
    setSelectedPlatformsForPublish([]);
    setPlatformVariants([]);
    setReadyPlatforms([]);
  }

  // ---------------------------------------------------------------------------
  // Platform Variant Helpers
  // ---------------------------------------------------------------------------
  
  // Update description for current active platform
  function updatePlatformDescription(platform: string, description: string) {
    setPlatformVariantsState(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        description,
      },
    }));
  }
  
  // Set platform-specific image (overrides shared image)
  function setPlatformImage(platform: string, imageUrl: string | null) {
    setPlatformVariantsState(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        imageUrl,
      },
    }));
  }
  
  // Get effective image URL for a platform (platform-specific or shared)
  function getEffectiveImageUrl(platform: string): string {
    const platformImage = platformVariantsState[platform]?.imageUrl;
    return platformImage ?? sharedImageUrl ?? allBgImages[0]?.original ?? "";
  }
  
  // Check if platform is using custom image
  function hasCustomImage(platform: string): boolean {
    return platformVariantsState[platform]?.imageUrl !== null;
  }

  // ---------------------------------------------------------------------------
  // Derived flags
  // ---------------------------------------------------------------------------
  const isGenerating = generateState === "loading";
  const hasResults = !!data;
  const isSaving = saveState === "loading";
  const isSaved = saveState === "success";
  const isExportingAny = exportingPlatforms.size > 0;
  const isPublishing = publishState === "loading";
  const anyBusy = isGenerating || isSaving || isExportingAny || isPublishing;
  
  // Check if current platform has exported image
  const currentPlatformHasImage = activePlatformTab 
    ? platformVariantsState[activePlatformTab]?.publishStatus === "media_ready"
    : false;
  
  // Check if any platform has exported image
  const anyPlatformHasImage = Object.values(platformVariantsState).some(
    v => v.publishStatus === "media_ready"
  );

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

  // The active image URL for the card — sharedImageUrl wins (set by gallery or upload),
  // otherwise fall back to the first image in the combined list
  // For minimal variant, image isn't displayed so we can use a placeholder
  const activeImageUrl = sharedImageUrl ?? allBgImages[0]?.original ?? 
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

          {/* Platform selector - Multi-select */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
            <SectionLabel>Platforms (select one or more)</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((platform) => {
                const isSelected = selectedPlatforms.includes(platform.id);
                const canGenerate = platform.id === "facebook"; // Only facebook is implemented for generation
                return (
                  <button
                    key={platform.id}
                    disabled={!canGenerate}
                    title={canGenerate ? `Generate post for ${platform.label}` : `${platform.label} — coming soon for generation`}
                    onClick={() => {
                      if (!canGenerate) return;
                      // Toggle platform in selection array
                      setSelectedPlatforms(prev =>
                        prev.includes(platform.id)
                          ? prev.filter(p => p !== platform.id)
                          : [...prev, platform.id]
                      );
                    }}
                    className={`relative flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition
                      ${canGenerate
                        ? isSelected
                          ? "border-transparent text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        : "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                      }`}
                    style={
                      canGenerate && isSelected
                        ? { backgroundColor: platform.color, borderColor: platform.color }
                        : undefined
                    }
                  >
                    <span
                      className={
                        canGenerate
                          ? isSelected ? "text-white" : "text-slate-500"
                          : "text-slate-300"
                      }
                    >
                      {platform.icon}
                    </span>
                    {platform.label}
                    {!canGenerate && (
                      <span className="ml-1 text-slate-300 text-xs">·</span>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedPlatforms.length === 0 && (
              <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-700">
                  Select at least one platform to generate content.
                </p>
              </div>
            )}
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
                }}
                onKeyDown={(e) => e.key === "Enter" && !anyBusy && handleGenerate()}
                placeholder="e.g. AI breakthroughs in healthcare this week"
                disabled={isGenerating}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60 transition"
              />
              <button
                onClick={handleGenerate}
                disabled={anyBusy || !query.trim() || selectedPlatforms.length === 0}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isGenerating ? <><Spinner className="h-4 w-4 animate-spin" />Generating…</> : "Generate"}
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
                      <Spinner className="h-3 w-3 animate-spin text-slate-400" />
                      Loading images…
                    </span>
                  )}
                  {!bgLoading && allBgImages.length > 0 && (
                    <span className="text-xs text-slate-400">{allBgImages.length} images</span>
                  )}
                </div>
              </div>

              {allBgImages.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 max-h-80 overflow-y-auto pr-1">
                  {allBgImages.map((img, i) => {
                    const isSelected = activeImageUrl === img.original;
                    const isArticle = i < articleBgImages.length;
                    return (
                      <button
                        key={`${img.original}-${i}`}
                        onClick={() => setSharedImageUrl(img.original)}
                        className={`group relative rounded-lg overflow-hidden border-2 transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
                          isSelected
                            ? "border-indigo-500 shadow-md"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {/* Thumbnail — fixed height, square-ish */}
                        <div className="relative h-20 sm:h-24 bg-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.thumbnail}
                            alt={img.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                            loading="lazy"
                          />
                          
                          {/* "From article" pill for article images */}
                          {isArticle && (
                            <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                              Article
                            </span>
                          )}
                          
                          {/* Selected checkmark */}
                          {isSelected && (
                            <div className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 shadow-sm">
                              <CheckIcon className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        {/* Caption - always show source, truncate */}
                        <div className="px-2 py-1.5 bg-white">
                          <p className="text-xs text-slate-500 truncate" title={img.source || img.title}>
                            {img.source || img.title || "Unknown source"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : bgLoading ? (
                /* Skeleton grid while loading */
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="h-20 sm:h-24 rounded-lg bg-slate-100 animate-pulse" />
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

              {/* Platform Tabs - Show when multi-platform generation is active */}
              {hasResults && Object.keys(platformVariantsState).length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <SectionLabel>Platform Variants</SectionLabel>
                  <div className="flex gap-2 flex-wrap">
                    {Object.keys(platformVariantsState).map((platform) => {
                      const isActive = activePlatformTab === platform;
                      const hasImage = platformVariantsState[platform]?.publishStatus === "media_ready";
                      const platformInfo = PLATFORMS.find(p => p.id === platform);
                      
                      return (
                        <button
                          key={platform}
                          onClick={() => setActivePlatformTab(platform)}
                          className={`relative flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition
                            ${isActive
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                        >
                          <span className={isActive ? "text-indigo-600" : "text-slate-500"}>
                            {platformInfo?.icon || "📱"}
                          </span>
                          <span className="capitalize">{platform}</span>
                          {hasImage && (
                            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500" title="Image ready">
                              <CheckIcon className="h-3 w-3 text-white" />
                            </span>
                          )}
                          {exportingPlatforms.has(platform) && (
                            <Spinner className="ml-1 h-4 w-4 animate-spin text-slate-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description - Platform-specific when available */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <SectionLabel>Description {activePlatformTab && `(${activePlatformTab})`}</SectionLabel>
                {hasResults && activePlatformTab && platformVariantsState[activePlatformTab] ? (
                  <>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {platformVariantsState[activePlatformTab].description}
                    </p>
                    {platformVariantsState[activePlatformTab].description_max_chars && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className={`text-xs ${
                          platformVariantsState[activePlatformTab].description.length > platformVariantsState[activePlatformTab].description_max_chars 
                            ? "text-red-600" 
                            : "text-slate-400"
                        }`}>
                          {platformVariantsState[activePlatformTab].description.length} / {platformVariantsState[activePlatformTab].description_max_chars} characters
                          {platformVariantsState[activePlatformTab].description.length > platformVariantsState[activePlatformTab].description_max_chars && (
                            <span className="ml-1 font-medium">— over limit</span>
                          )}
                        </p>
                      </div>
                    )}
                  </>
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
                          ? <><Spinner className="h-4 w-4 animate-spin text-slate-500" />{isEditingDraft ? "Updating…" : "Saving…"}</>
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

                      {/* Create image row - Per platform */}
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => activePlatformTab && handleExportAndUploadForPlatform(activePlatformTab)}
                          disabled={anyBusy || !activePlatformTab || currentPlatformHasImage}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {exportingPlatforms.has(activePlatformTab)
                            ? <><Spinner className="h-4 w-4 animate-spin text-slate-500" />Creating image…</>
                            : currentPlatformHasImage ? "Image ready" : `Create image for ${activePlatformTab}`}
                        </button>
                        {currentPlatformHasImage && <SuccessBadge>Image uploaded</SuccessBadge>}
                      </div>

                      {exportErrors[activePlatformTab] && (
                        <ErrorBanner message={`Image export failed — ${exportErrors[activePlatformTab]}`} />
                      )}

                      {/* Ready to publish list */}
                      {anyPlatformHasImage && (
                        <div className="space-y-4">
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                            Ready to publish
                          </p>
                          
                          <div className="space-y-2">
                            {selectedPlatforms.map((platformId) => {
                              const platform = PLATFORMS.find((p) => p.id === platformId);
                              if (!platform) return null;

                              const variant = platformVariantsState[platformId];
                              const isMediaReady = variant?.publishStatus === "media_ready";
                              const isChecked = selectedPlatformsForPublish.includes(platformId);
                              
                              // Check if this platform has been published
                              const publishedResult = publishResult?.results.find((r) => r.platform === platformId);
                              const isPublished = publishedResult?.status === "published" || publishedResult?.status === "success";
                              const hasFailed = publishedResult && !isPublished;

                              return (
                                <div
                                  key={platformId}
                                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                                    isPublished
                                      ? "border-emerald-200 bg-emerald-50"
                                      : hasFailed
                                      ? "border-red-200 bg-red-50"
                                      : isMediaReady
                                      ? "border-slate-200 bg-white"
                                      : "border-slate-100 bg-slate-50"
                                  }`}
                                >
                                  {/* Checkbox or status icon */}
                                  <div className="flex items-center justify-center w-5 h-5">
                                    {isPublished ? (
                                      <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                    ) : hasFailed ? (
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setSelectedPlatformsForPublish((prev) =>
                                            prev.includes(platformId)
                                              ? prev.filter((p) => p !== platformId)
                                              : [...prev, platformId]
                                          );
                                        }}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                      />
                                    ) : isMediaReady ? (
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setSelectedPlatformsForPublish((prev) =>
                                            prev.includes(platformId)
                                              ? prev.filter((p) => p !== platformId)
                                              : [...prev, platformId]
                                          );
                                        }}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                      />
                                    ) : (
                                      <div className="w-4 h-4 border-2 border-slate-300 rounded bg-slate-100"></div>
                                    )}
                                  </div>

                                  {/* Platform icon and name */}
                                  <div
                                    className={`flex items-center gap-2 flex-1 ${
                                      isMediaReady ? "text-slate-900" : "text-slate-400"
                                    }`}
                                  >
                                    <span
                                      className={isMediaReady ? "text-slate-600" : "text-slate-300"}
                                      style={isMediaReady ? { color: platform.color } : undefined}
                                    >
                                      {platform.icon}
                                    </span>
                                    <span className="font-medium text-sm">{platform.label}</span>
                                  </div>

                                  {/* Status message */}
                                  <div className="text-xs">
                                    {isPublished ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-emerald-700 font-medium">Published ✓</span>
                                        {publishedResult?.external_url && (
                                          <a
                                            href={publishedResult.external_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 underline"
                                          >
                                            View post
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                          </a>
                                        )}
                                      </div>
                                    ) : hasFailed ? (
                                      <div className="text-red-700">
                                        <div className="flex items-center gap-1">
                                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                          </svg>
                                          <span className="font-medium">Failed</span>
                                        </div>
                                        {publishedResult?.error && (
                                          <p className="mt-1 text-xs text-red-600">{publishedResult.error}</p>
                                        )}
                                      </div>
                                    ) : isMediaReady ? (
                                      <span className="text-slate-500">Ready</span>
                                    ) : (
                                      <span className="text-slate-400">Image not created yet</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {selectedPlatformsForPublish.length === 0 && !publishResult && (
                            <p className="text-xs text-amber-600">Check at least one platform to enable publishing.</p>
                          )}
                        </div>
                      )}

                      {/* Publish button */}
                      {anyPlatformHasImage && !publishResult && (
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            onClick={handlePublish}
                            disabled={anyBusy || selectedPlatformsForPublish.length === 0}
                            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                          >
                            {isPublishing ? (
                              <>
                                <Spinner className="h-4 w-4 animate-spin" />
                                Publishing…
                              </>
                            ) : (
                              "Publish"
                            )}
                          </button>
                        </div>
                      )}

                      {publishState === "error" && publishError && (
                        <ErrorBanner message={`Publish request failed — ${publishError}`} />
                      )}

                      {/* Create New Post button - show after successful publish */}
                      {publishResult && (publishResult.publish_status === "published" || publishResult.publish_status === "partial") && (
                        <div className="flex justify-center pt-2">
                          <button
                            onClick={resetForm}
                            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create New Post
                          </button>
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
                    const currentVariant = activePlatformTab ? platformVariantsState[activePlatformTab] : null;
                    const cardWidth = currentVariant?.width || 1080;
                    const cardHeight = currentVariant?.height || 1350;
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
                            transform: "scale(0.067)", // Scale to 72px wide
                            width: cardWidth, 
                            height: cardHeight, 
                            pointerEvents: "none" 
                          }}>
                            <NewsPostCard
                              imageUrl={activeImageUrl}
                              source={activeArticle?.source ?? "Source"}
                              date={activeArticle?.date ?? "DATE"}
                              headline={editedHeadline || data?.headline || "Headline text goes here"}
                              description={currentVariant?.description || "Description preview"}
                              hashtags={data?.hashtags ?? []}
                              variant={tpl.id}
                              width={cardWidth}
                              height={cardHeight}
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
                    {(() => {
                      const currentVariant = activePlatformTab ? platformVariantsState[activePlatformTab] : null;
                      const cardWidth = currentVariant?.width || 1080;
                      const cardHeight = currentVariant?.height || 1350;
                      const currentDescription = currentVariant?.description || "";
                      
                      return (
                        <>
                          <div style={{ 
                            transformOrigin: "top left", 
                            transform: `scale(${315 / cardWidth})`, 
                            width: cardWidth, 
                            height: cardHeight 
                          }}>
                            <NewsPostCard
                              imageUrl={activeImageUrl}
                              source={activeArticle?.source ?? ""}
                              date={activeArticle?.date ?? ""}
                              headline={editedHeadline}
                              description={currentDescription}
                              hashtags={data!.hashtags}
                              variant={selectedVariant}
                              width={cardWidth}
                              height={cardHeight}
                              onChangeHeadline={(newHeadline) => {
                                setEditedHeadline(newHeadline);
                              }}
                              onChangeDescription={(newDescription) => {
                                if (activePlatformTab) {
                                  updatePlatformDescription(activePlatformTab, newDescription);
                                }
                              }}
                            />
                          </div>
                          
                          {/* Character counter */}
                          {currentVariant && (
                            <div className="mt-3 text-xs text-center">
                              <span className={currentDescription.length > currentVariant.description_max_chars ? "text-red-600 font-semibold" : "text-slate-500"}>
                                {currentDescription.length} / {currentVariant.description_max_chars} characters
                              </span>
                            </div>
                          )}
                        </>
                      );
                    })()}
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

                <p className="mt-3 text-xs text-center text-slate-400">
                  {(() => {
                    const currentVariant = activePlatformTab ? platformVariantsState[activePlatformTab] : null;
                    const aspectRatio = currentVariant?.aspect_ratio || "4:5";
                    const cardWidth = currentVariant?.width || 1080;
                    const cardHeight = currentVariant?.height || 1350;
                    return `${aspectRatio} · ${cardWidth} × ${cardHeight} px`;
                  })()}
                </p>
              </div>

              {/* Show current platform's exported image if available */}
              {activePlatformTab && platformVariantsState[activePlatformTab]?.mediaUrl && (
                <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5">
                  <SectionLabel>Exported image ({activePlatformTab})</SectionLabel>
                  <div className="overflow-hidden rounded-xl border border-slate-200" style={{ aspectRatio: "4/5" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={platformVariantsState[activePlatformTab].mediaUrl!}
                      alt={`Exported post card for ${activePlatformTab}`}
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
            {(() => {
              const currentVariant = activePlatformTab ? platformVariantsState[activePlatformTab] : null;
              const cardWidth = currentVariant?.width || 1080;
              const cardHeight = currentVariant?.height || 1350;
              const currentDescription = currentVariant?.description || "";
              
              return (
                <NewsPostCard
                  imageUrl={activeImageUrl}
                  source={activeArticle?.source ?? ""}
                  date={activeArticle?.date ?? ""}
                  headline={editedHeadline}
                  description={currentDescription}
                  hashtags={data!.hashtags}
                  variant={selectedVariant}
                  width={cardWidth}
                  height={cardHeight}
                />
              );
            })()}
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
