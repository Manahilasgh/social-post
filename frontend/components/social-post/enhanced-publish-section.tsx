"use client";

import { PLATFORMS } from "@/lib/platforms";

// Simple icon components (replace with heroicons if available)
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
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

interface EnhancedPublishSectionProps {
  historyId: number | null;
  isExported: boolean;
  platformVariants: PlatformVariant[];
  readyPlatforms: string[];
  selectedPlatformsForPublish: string[];
  setSelectedPlatformsForPublish: React.Dispatch<React.SetStateAction<string[]>>;
  publishState: "idle" | "loading" | "success" | "error";
  publishError: string | null;
  publishResult: PublishResponse | null;
  isPublishing: boolean;
  anyBusy: boolean;
  onPublish: () => void;
  onNewPost: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
      {children}
    </p>
  );
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

export default function EnhancedPublishSection({
  historyId,
  isExported,
  platformVariants,
  readyPlatforms,
  selectedPlatformsForPublish,
  setSelectedPlatformsForPublish,
  publishState,
  publishError,
  publishResult,
  isPublishing,
  anyBusy,
  onPublish,
  onNewPost,
}: EnhancedPublishSectionProps) {
  const hasReadyPlatforms = readyPlatforms.length > 0;
  const hasAnyVariants = platformVariants.length > 0;

  // Get platform info for display
  const getPlatformInfo = (platformId: string) => {
    return PLATFORMS.find(p => p.id === platformId) || {
      id: platformId,
      label: platformId,
      color: "#6b7280",
      icon: "📱",
      publishEnabled: false,
    };
  };

  // Handle platform checkbox toggle
  const togglePlatform = (platformId: string) => {
    setSelectedPlatformsForPublish(prev => 
      prev.includes(platformId)
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    );
  };

  // Get variant for a platform
  const getVariantForPlatform = (platformId: string) => {
    return platformVariants.find(v => v.platform === platformId);
  };

  // Check if platform was successfully published
  const isPlatformPublished = (platformId: string) => {
    const result = publishResult?.results.find(r => r.platform === platformId);
    return result?.status === "success";
  };

  // Get publish error for platform
  const getPlatformError = (platformId: string) => {
    const result = publishResult?.results.find(r => r.platform === platformId);
    return result?.error;
  };

  // Get external URL for platform
  const getPlatformExternalUrl = (platformId: string) => {
    const result = publishResult?.results.find(r => r.platform === platformId);
    return result?.external_url;
  };

  if (!historyId || !isExported) {
    return null;
  }

  return (
    <div className="space-y-4 pt-3 border-t border-slate-100">
      {/* Ready to Publish Section */}
      {hasReadyPlatforms && (
        <div>
          <SectionLabel>Ready to publish</SectionLabel>
          <div className="space-y-2">
            {PLATFORMS.filter(platform => platform.publishEnabled).map((platform) => {
              const isReady = readyPlatforms.includes(platform.id);
              const isSelected = selectedPlatformsForPublish.includes(platform.id);
              const isPublished = isPlatformPublished(platform.id);
              const hasError = !!getPlatformError(platform.id);
              const externalUrl = getPlatformExternalUrl(platform.id);
              const variant = getVariantForPlatform(platform.id);

              return (
                <div key={platform.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div style={{ color: platform.color }}>{platform.icon}</div>
                    <div>
                      <div className="font-medium text-sm text-slate-900">{platform.label}</div>
                      {!isReady && (
                        <div className="text-xs text-slate-500">Image not created yet</div>
                      )}
                      {isReady && !isPublished && (
                        <div className="text-xs text-emerald-600">Ready to publish</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isPublished ? (
                      <div className="flex items-center gap-2">
                        <CheckIcon className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-medium text-emerald-700">Published</span>
                        {externalUrl && (
                          <a
                            href={externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-700"
                          >
                            <ExternalLinkIcon className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    ) : hasError ? (
                      <div className="flex items-center gap-2">
                        <XMarkIcon className="h-4 w-4 text-red-500" />
                        <span className="text-sm text-red-600">Failed</span>
                      </div>
                    ) : isReady ? (
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePlatform(platform.id)}
                          disabled={!isReady || isPublishing}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                        />
                      </label>
                    ) : (
                      <div className="w-5 h-5 bg-slate-100 rounded border border-slate-200"></div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Platform variants that aren't in the main platform list */}
            {platformVariants.filter(variant => 
              !PLATFORMS.find(p => p.id === variant.platform)?.publishEnabled
            ).map((variant) => {
              const isReady = readyPlatforms.includes(variant.platform);
              const isSelected = selectedPlatformsForPublish.includes(variant.platform);
              const isPublished = isPlatformPublished(variant.platform);
              const hasError = !!getPlatformError(variant.platform);
              const externalUrl = getPlatformExternalUrl(variant.platform);

              return (
                <div key={variant.platform} className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="text-slate-400">📱</div>
                    <div>
                      <div className="font-medium text-sm text-slate-900 capitalize">{variant.platform}</div>
                      {!isReady && (
                        <div className="text-xs text-slate-500">Image not created yet</div>
                      )}
                      {isReady && !isPublished && (
                        <div className="text-xs text-emerald-600">Ready to publish</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isPublished ? (
                      <div className="flex items-center gap-2">
                        <CheckIcon className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-medium text-emerald-700">Published</span>
                        {externalUrl && (
                          <a
                            href={externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-700"
                          >
                            <ExternalLinkIcon className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    ) : hasError ? (
                      <div className="flex items-center gap-2">
                        <XMarkIcon className="h-4 w-4 text-red-500" />
                        <span className="text-sm text-red-600">Failed</span>
                      </div>
                    ) : isReady ? (
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePlatform(variant.platform)}
                          disabled={!isReady || isPublishing}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                        />
                      </label>
                    ) : (
                      <div className="w-5 h-5 bg-slate-100 rounded border border-slate-200"></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No ready platforms message */}
      {!hasReadyPlatforms && hasAnyVariants && (
        <div className="text-center py-4 text-slate-500 text-sm">
          No platforms ready to publish yet. Create images for your platforms first.
        </div>
      )}

      {/* Publish button */}
      {hasReadyPlatforms && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onPublish}
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
          
          {selectedPlatformsForPublish.length === 0 && (
            <p className="text-xs text-amber-600">Select platforms to publish.</p>
          )}
        </div>
      )}

      {/* Error display */}
      {publishState === "error" && publishError && (
        <ErrorBanner message={`Publish request failed — ${publishError}`} />
      )}

      {/* Per-platform error details */}
      {publishResult && publishResult.results.some(r => r.error) && (
        <div className="space-y-2">
          <SectionLabel>Platform errors</SectionLabel>
          <div className="space-y-2">
            {publishResult.results.filter(r => r.error).map((result) => (
              <div key={result.platform} className="p-3 rounded-lg border border-red-200 bg-red-50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-red-600 capitalize font-medium">{result.platform}</div>
                  <XMarkIcon className="h-4 w-4 text-red-500" />
                </div>
                <p className="text-sm text-red-700">{result.error}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create New Post button - show after successful publish */}
      {(publishResult?.publish_status === "published" || publishResult?.publish_status === "partial") && (
        <div className="flex justify-center pt-2">
          <button
            onClick={onNewPost}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
          >
            Create New Post
          </button>
        </div>
      )}
    </div>
  );
}