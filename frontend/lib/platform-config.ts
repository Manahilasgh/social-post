export const PLATFORM_CONFIG = {
  facebook: {
    description_max_chars: 500,
    aspect_ratio: "4:5",
    width: 1080,
    height: 1350,
  },
  x: {
    description_max_chars: 280,
    aspect_ratio: "16:9",
    width: 1200,
    height: 675,
  },
  instagram: {
    description_max_chars: 2200,
    aspect_ratio: "4:5",
    width: 1080,
    height: 1350,
  },
  linkedin: {
    description_max_chars: 700,
    aspect_ratio: "1.91:1",
    width: 1200,
    height: 628,
  },
  pinterest: {
    description_max_chars: 500,
    aspect_ratio: "2:3",
    width: 1000,
    height: 1500,
  },
} as const;

export const DEFAULT_PLATFORM = "facebook";

export function getPlatformConfig(platform: string) {
  return (
    PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG] ||
    PLATFORM_CONFIG[DEFAULT_PLATFORM]
  );
}
