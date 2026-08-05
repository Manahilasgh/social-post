import { Barlow_Condensed, Source_Serif_4, JetBrains_Mono } from "next/font/google";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-display",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-body",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

// ---------------------------------------------------------------------------
// Template registry — add more variants here as needed
// ---------------------------------------------------------------------------

export type TemplateVariant = "dark" | "light" | "minimal" | "bold" | "split";

export interface TemplateDefinition {
  id: TemplateVariant;
  label: string;
}

export const TEMPLATES: TemplateDefinition[] = [
  { id: "dark",    label: "Dark"    },
  { id: "light",   label: "Light"   },
  { id: "minimal", label: "Minimal" },
  { id: "bold",    label: "Bold"    },
  { id: "split",   label: "Split"   },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NewsPostCardProps {
  imageUrl: string;
  source: string;
  date: string;       // pre-formatted, e.g. "JUL 30"
  headline: string;
  description: string;
  hashtags: string[];
  variant?: TemplateVariant;
  /** When provided the headline becomes contentEditable in the live preview. */
  onChangeHeadline?: (value: string) => void;
  /** When provided the description becomes contentEditable in the live preview. */
  onChangeDescription?: (value: string) => void;
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export default function NewsPostCard({
  imageUrl,
  source,
  date,
  headline,
  description,
  hashtags,
  variant = "dark",
  onChangeHeadline,
  onChangeDescription,
}: NewsPostCardProps) {
  const fontVars = `${barlowCondensed.variable} ${sourceSerif.variable} ${jetbrainsMono.variable}`;
  const editProps = { onChangeHeadline, onChangeDescription };
  const sharedProps = { imageUrl, source, date, headline, description, hashtags, fontVars, ...editProps };

  switch (variant) {
    case "light":
      return <LightCard {...sharedProps} />;
    case "minimal":
      return <MinimalCard {...sharedProps} />;
    case "bold":
      return <BoldCard {...sharedProps} />;
    case "split":
      return <SplitCard {...sharedProps} />;
    default:
      return <DarkCard {...sharedProps} />;
  }
}

// ---------------------------------------------------------------------------
// Shared editable element helpers
// ---------------------------------------------------------------------------

/**
 * Thin wrapper that makes any element contentEditable when a change handler
 * is supplied.  Commits on blur; suppresses Enter (single-line) on headline.
 */
function EditableField({
  as: Tag,
  style,
  value,
  onChange,
  singleLine = false,
  editHintColor = "rgba(255,255,255,0.15)",
  children,
}: {
  as: "h1" | "p";
  style: React.CSSProperties;
  value: string;
  onChange?: (v: string) => void;
  singleLine?: boolean;
  editHintColor?: string;
  children?: React.ReactNode;
}) {
  if (!onChange) {
    // Non-editable — render exactly as before (used by off-screen capture)
    return <Tag style={style}>{children ?? value}</Tag>;
  }

  return (
    <Tag
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={(e) => {
        const text = (e.currentTarget.textContent ?? "").trim();
        if (text !== value) onChange(text);
      }}
      onKeyDown={(e) => {
        if (singleLine && e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      style={{
        ...style,
        outline: "none",
        cursor: "text",
        borderRadius: 4,
        // Subtle box-shadow ring on hover/focus — visible at 1080px, readable when scaled
        boxShadow: `0 0 0 0px ${editHintColor}`,
        transition: "box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 6px ${editHintColor}`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        if (document.activeElement !== el) {
          el.style.boxShadow = `0 0 0 0px ${editHintColor}`;
        }
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 6px ${editHintColor}`;
      }}
    >
      {value}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// Internal prop shape (shared between DarkCard / LightCard)
// ---------------------------------------------------------------------------

interface InternalProps {
  imageUrl: string;
  source: string;
  date: string;
  headline: string;
  description: string;
  hashtags: string[];
  fontVars: string;
  onChangeHeadline?: (v: string) => void;
  onChangeDescription?: (v: string) => void;
}

// ---------------------------------------------------------------------------
// Dark variant
// ---------------------------------------------------------------------------

function DarkCard({
  imageUrl, source, date, headline, description, hashtags, fontVars,
  onChangeHeadline, onChangeDescription,
}: InternalProps) {
  return (
    <div
      id="news-post-card"
      className={fontVars}
      style={{
        width: 1080, height: 1350,
        position: "relative", overflow: "hidden",
        backgroundColor: "#12151C", fontFamily: "var(--font-body)",
      }}
    >
      <img src={imageUrl} alt=""
        crossOrigin="anonymous"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />

      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, #12151C 0%, rgba(18,21,28,0.94) 28%, rgba(18,21,28,0.55) 52%, rgba(18,21,28,0.05) 72%, transparent 85%)",
      }} />

      <div style={{ position: "absolute", left: 64, right: 64, bottom: 72, display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Source / date */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 22, letterSpacing: "0.08em", color: "#D9A441", textTransform: "uppercase" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#E33D2E", display: "inline-block", boxShadow: "0 0 0 4px rgba(227,61,46,0.25)" }} />
          {source} · {date}
        </div>

        {/* Accent rule */}
        <div style={{ width: 88, height: 6, backgroundColor: "#E33D2E" }} />

        {/* Headline — editable */}
        <EditableField
          as="h1"
          value={headline}
          onChange={onChangeHeadline}
          singleLine
          editHintColor="rgba(245,243,237,0.18)"
          style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 76, lineHeight: 1.02, letterSpacing: "-0.01em", color: "#F5F3ED", textTransform: "uppercase" }}
        />

        {/* Description — editable */}
        <EditableField
          as="p"
          value={description}
          onChange={onChangeDescription}
          editHintColor="rgba(146,152,162,0.25)"
          style={{ margin: 0, fontFamily: "var(--font-body)", fontWeight: 400, fontSize: 30, lineHeight: 1.4, color: "#9298A2", maxWidth: 880 }}
        />

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 22, color: "#F5F3ED" }}>
            {hashtags.map((tag) => (
              <span key={tag} style={{ padding: "6px 14px", border: "1px solid rgba(245,243,237,0.35)", borderRadius: 999 }}>
                #{tag.replace(/\s+/g, "")}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Light variant
// ---------------------------------------------------------------------------

function LightCard({
  imageUrl, source, date, headline, description, hashtags, fontVars,
  onChangeHeadline, onChangeDescription,
}: InternalProps) {
  const PANEL_TOP = 1350 * 0.58;

  return (
    <div
      id="news-post-card"
      className={fontVars}
      style={{ width: 1080, height: 1350, position: "relative", overflow: "hidden", backgroundColor: "#FFFFFF", fontFamily: "var(--font-body)" }}
    >
      <img src={imageUrl} alt=""
        crossOrigin="anonymous"
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: PANEL_TOP, objectFit: "cover" }}
      />

      <div style={{ position: "absolute", top: PANEL_TOP, left: 0, width: "100%", height: 8, backgroundColor: "#2563EB" }} />

      <div style={{
        position: "absolute", top: PANEL_TOP + 8, left: 0, right: 0, bottom: 0,
        backgroundColor: "#FFFFFF", display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "48px 64px 56px",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Source / date */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 20, letterSpacing: "0.08em", color: "#2563EB", textTransform: "uppercase" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: "#2563EB", display: "inline-block" }} />
            {source} · {date}
          </div>

          {/* Headline — editable */}
          <EditableField
            as="h1"
            value={headline}
            onChange={onChangeHeadline}
            singleLine
            editHintColor="rgba(15,23,42,0.1)"
            style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 68, lineHeight: 1.04, letterSpacing: "-0.01em", color: "#0F172A", textTransform: "uppercase" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Description — editable */}
          <EditableField
            as="p"
            value={description}
            onChange={onChangeDescription}
            editHintColor="rgba(71,85,105,0.15)"
            style={{ margin: 0, fontFamily: "var(--font-body)", fontWeight: 400, fontSize: 26, lineHeight: 1.45, color: "#475569" }}
          />

          {/* Hashtags */}
          {hashtags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontFamily: "var(--font-mono)", fontSize: 20, color: "#2563EB" }}>
              {hashtags.map((tag) => (
                <span key={tag} style={{ padding: "5px 14px", border: "1px solid rgba(37,99,235,0.35)", borderRadius: 999 }}>
                  #{tag.replace(/\s+/g, "")}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// ---------------------------------------------------------------------------
// Minimal variant — clean white/light background, no photo overlay
// ---------------------------------------------------------------------------

function MinimalCard({
  source, date, headline, description, hashtags, fontVars,
  onChangeHeadline, onChangeDescription,
}: InternalProps) {
  return (
    <div
      id="news-post-card"
      className={fontVars}
      style={{
        width: 1080, height: 1350,
        position: "relative", overflow: "hidden",
        backgroundColor: "#FEFEFE", fontFamily: "var(--font-body)",
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "80px 72px",
      }}
    >
      {/* Accent line */}
      <div style={{ 
        width: 120, height: 4, backgroundColor: "#DC2626", 
        marginBottom: 48, borderRadius: 2 
      }} />

      {/* Source / date */}
      <div style={{ 
        display: "flex", alignItems: "center", gap: 12,
        fontFamily: "var(--font-mono)", fontSize: 24, letterSpacing: "0.1em",
        color: "#374151", textTransform: "uppercase", marginBottom: 36
      }}>
        <span style={{ 
          width: 8, height: 8, borderRadius: "50%", 
          backgroundColor: "#DC2626", display: "inline-block" 
        }} />
        {source} · {date}
      </div>

      {/* Headline — editable */}
      <EditableField
        as="h1"
        value={headline}
        onChange={onChangeHeadline}
        singleLine
        editHintColor="rgba(17,24,39,0.08)"
        style={{ 
          margin: "0 0 40px 0", fontFamily: "var(--font-display)", 
          fontWeight: 800, fontSize: 84, lineHeight: 0.95, 
          letterSpacing: "-0.02em", color: "#111827", 
          textTransform: "uppercase" 
        }}
      />

      {/* Description — editable */}
      <EditableField
        as="p"
        value={description}
        onChange={onChangeDescription}
        editHintColor="rgba(75,85,99,0.12)"
        style={{ 
          margin: "0 0 48px 0", fontFamily: "var(--font-body)", 
          fontWeight: 400, fontSize: 32, lineHeight: 1.5, 
          color: "#4B5563", maxWidth: 900 
        }}
      />

      {/* Hashtags */}
      {hashtags.length > 0 && (
        <div style={{ 
          display: "flex", flexWrap: "wrap", gap: 16, 
          fontFamily: "var(--font-mono)", fontSize: 22, color: "#DC2626" 
        }}>
          {hashtags.map((tag) => (
            <span key={tag} style={{ 
              padding: "8px 16px", 
              backgroundColor: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.2)", 
              borderRadius: 8 
            }}>
              #{tag.replace(/\s+/g, "")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bold variant — photo fills entire card with heavy solid color band at bottom
// ---------------------------------------------------------------------------

function BoldCard({
  imageUrl, source, date, headline, description, hashtags, fontVars,
  onChangeHeadline, onChangeDescription,
}: InternalProps) {
  const BAND_HEIGHT = 420;

  return (
    <div
      id="news-post-card"
      className={fontVars}
      style={{
        width: 1080, height: 1350,
        position: "relative", overflow: "hidden",
        backgroundColor: "#000000", fontFamily: "var(--font-body)",
      }}
    >
      {/* Full background image */}
      <img src={imageUrl} alt=""
        crossOrigin="anonymous"
        style={{ 
          position: "absolute", inset: 0, 
          width: "100%", height: "100%", objectFit: "cover" 
        }}
      />

      {/* Solid color band at bottom */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: BAND_HEIGHT, backgroundColor: "#F59E0B",
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "0 60px",
      }}>
        {/* Source / date */}
        <div style={{ 
          display: "flex", alignItems: "center", gap: 10,
          fontFamily: "var(--font-mono)", fontSize: 20, letterSpacing: "0.1em",
          color: "#000000", textTransform: "uppercase", marginBottom: 20
        }}>
          <span style={{ 
            width: 8, height: 8, borderRadius: "50%", 
            backgroundColor: "#000000", display: "inline-block" 
          }} />
          {source} · {date}
        </div>

        {/* Headline — editable */}
        <EditableField
          as="h1"
          value={headline}
          onChange={onChangeHeadline}
          singleLine
          editHintColor="rgba(0,0,0,0.15)"
          style={{ 
            margin: "0 0 24px 0", fontFamily: "var(--font-display)", 
            fontWeight: 800, fontSize: 64, lineHeight: 0.98, 
            letterSpacing: "-0.015em", color: "#000000", 
            textTransform: "uppercase" 
          }}
        />

        {/* Description — editable */}
        <EditableField
          as="p"
          value={description}
          onChange={onChangeDescription}
          editHintColor="rgba(0,0,0,0.1)"
          style={{ 
            margin: "0 0 28px 0", fontFamily: "var(--font-body)", 
            fontWeight: 600, fontSize: 26, lineHeight: 1.3, 
            color: "#000000", maxWidth: 800 
          }}
        />

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div style={{ 
            display: "flex", flexWrap: "wrap", gap: 10, 
            fontFamily: "var(--font-mono)", fontSize: 18, color: "#000000" 
          }}>
            {hashtags.map((tag) => (
              <span key={tag} style={{ 
                padding: "4px 12px", 
                backgroundColor: "rgba(0,0,0,0.15)",
                borderRadius: 6 
              }}>
                #{tag.replace(/\s+/g, "")}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Split variant — photo on top half, solid color block with text on bottom half
// ---------------------------------------------------------------------------

function SplitCard({
  imageUrl, source, date, headline, description, hashtags, fontVars,
  onChangeHeadline, onChangeDescription,
}: InternalProps) {
  const SPLIT_POINT = 675; // 50% split

  return (
    <div
      id="news-post-card"
      className={fontVars}
      style={{
        width: 1080, height: 1350,
        position: "relative", overflow: "hidden",
        backgroundColor: "#1E293B", fontFamily: "var(--font-body)",
      }}
    >
      {/* Top half - image */}
      <img src={imageUrl} alt=""
        crossOrigin="anonymous"
        style={{ 
          position: "absolute", top: 0, left: 0, 
          width: "100%", height: SPLIT_POINT, objectFit: "cover" 
        }}
      />

      {/* Bottom half - solid color with content */}
      <div style={{
        position: "absolute", top: SPLIT_POINT, left: 0, right: 0, bottom: 0,
        backgroundColor: "#1E293B",
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "48px 64px",
      }}>
        {/* Source / date */}
        <div style={{ 
          display: "flex", alignItems: "center", gap: 12,
          fontFamily: "var(--font-mono)", fontSize: 22, letterSpacing: "0.08em",
          color: "#10B981", textTransform: "uppercase", marginBottom: 32
        }}>
          <span style={{ 
            width: 10, height: 10, borderRadius: "50%", 
            backgroundColor: "#10B981", display: "inline-block",
            boxShadow: "0 0 0 3px rgba(16,185,129,0.2)"
          }} />
          {source} · {date}
        </div>

        {/* Headline — editable */}
        <EditableField
          as="h1"
          value={headline}
          onChange={onChangeHeadline}
          singleLine
          editHintColor="rgba(248,250,252,0.15)"
          style={{ 
            margin: "0 0 28px 0", fontFamily: "var(--font-display)", 
            fontWeight: 800, fontSize: 72, lineHeight: 1.0, 
            letterSpacing: "-0.01em", color: "#F8FAFC", 
            textTransform: "uppercase" 
          }}
        />

        {/* Description — editable */}
        <EditableField
          as="p"
          value={description}
          onChange={onChangeDescription}
          editHintColor="rgba(148,163,184,0.2)"
          style={{ 
            margin: "0 0 32px 0", fontFamily: "var(--font-body)", 
            fontWeight: 400, fontSize: 28, lineHeight: 1.4, 
            color: "#94A3B8", maxWidth: 860 
          }}
        />

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div style={{ 
            display: "flex", flexWrap: "wrap", gap: 12, 
            fontFamily: "var(--font-mono)", fontSize: 20, color: "#F8FAFC" 
          }}>
            {hashtags.map((tag) => (
              <span key={tag} style={{ 
                padding: "6px 14px", 
                border: "1px solid rgba(16,185,129,0.4)",
                borderRadius: 999 
              }}>
                #{tag.replace(/\s+/g, "")}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}