/**
 * Photo resolution for pages — wraps the shared normaliser (`photo-path.mjs`)
 * around the one `import.meta.glob` of src/assets/photos.
 *
 * Every page goes through here so a photo reference resolves identically
 * wherever it appears: a card cover, a hero, a sequence step, a gallery tile or
 * an OG tag. Anything that cannot be resolved returns null — callers fall back
 * to the placeholder rather than emitting a 404 <img>.
 */
import { toPhotoKey, PLACEHOLDER_COVER, photoRefs } from './photo-path.mjs';

export { PLACEHOLDER_COVER };

const allImages = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/photos/**/*.{jpg,jpeg,JPG,JPEG,png,PNG,webp,WEBP}',
  { eager: true },
);

/** Resolve one frontmatter `src` to an optimisable image, or null. */
export function resolvePhoto(src: string | null | undefined): ImageMetadata | null {
  const key = toPhotoKey(src);
  return key ? (allImages[key]?.default ?? null) : null;
}

type CoverSource = {
  coverImage?: string;
  hero?: { src: string; alt: string };
  steps?: { src: string; alt: string }[];
  gallery?: { src: string; alt: string }[];
};

/**
 * The cover for an entry: its `coverImage` if that resolves, otherwise the
 * hero, the first sequence step, or the first gallery photo. An entry with any
 * real photo on it therefore always shows a real photo on a card, even if
 * `coverImage` was never set or still holds a legacy path.
 */
export function resolveCover(data: CoverSource): ImageMetadata | null {
  for (const ref of photoRefs(data)) {
    const img = resolvePhoto(ref.src);
    if (img) return img;
  }
  return null;
}

/** Alt text for a cover, preferring the entry's own wording. */
export function coverAlt(
  data: CoverSource & { coverImageAlt?: string; title?: string; vehicle?: string },
): string {
  return (
    data.coverImageAlt ??
    data.hero?.alt ??
    data.steps?.[0]?.alt ??
    data.gallery?.[0]?.alt ??
    `Cover photo for ${data.title}${data.vehicle ? ` (${data.vehicle})` : ''}`
  );
}
