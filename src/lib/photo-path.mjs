/**
 * Photo path normalisation — the single source of truth for turning whatever a
 * content entry says into the one canonical key used by `import.meta.glob`.
 *
 * Plain `.mjs` on purpose: both the Astro pages (via `src/lib/photos.ts`) and
 * the Node-only reference checker (`scripts/check-image-refs.mjs`) import it, so
 * the build and the test can never drift apart on what "resolvable" means.
 *
 * The canonical form written by the Studio export is relative to the photo root:
 *   'giulietta-spyder-veloce/IMG_6512.jpg'
 * Legacy forms are accepted and rewritten; anything that is not a photo asset
 * (a /placeholders SVG, an external URL) resolves to null so the caller can fall
 * back deliberately instead of emitting a broken <img>.
 */

/** Root every optimised photo lives under, as Vite keys it. */
export const PHOTO_ROOT = '/src/assets/photos/';

/** Extensions the glob picks up. Keep in sync with PHOTO_GLOB below. */
export const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/** The glob pattern used by every page. Exported so the checker can assert it. */
export const PHOTO_GLOB = '/src/assets/photos/**/*.{jpg,jpeg,JPG,JPEG,png,PNG,webp,WEBP}';

/** Public-directory fallback shown when a cover cannot be resolved. */
export const PLACEHOLDER_COVER = '/placeholders/project-01.svg';

/**
 * Normalise a frontmatter `src` to the glob key, or null when it is not a
 * managed photo.
 *
 * @param {string | null | undefined} src
 * @returns {string | null} e.g. '/src/assets/photos/slug/file.jpg'
 */
export function toPhotoKey(src) {
  if (typeof src !== 'string') return null;

  let p = src.trim().split('\\').join('/');
  if (!p) return null;

  // External or inline images are somebody else's problem.
  if (/^[a-z][a-z0-9+.-]*:/i.test(p)) return null;

  p = p.replace(/^\.\//, '');

  if (p.startsWith(PHOTO_ROOT)) {
    p = p.slice(PHOTO_ROOT.length);
  } else if (p.startsWith('src/assets/photos/')) {
    p = p.slice('src/assets/photos/'.length);
  } else if (p.startsWith('/photos/')) {
    // Legacy: the dev-only middleware serves src/assets/photos at /photos.
    // That route does not exist in a production build.
    p = p.slice('/photos/'.length);
  } else if (p.startsWith('photos/')) {
    p = p.slice('photos/'.length);
  } else if (p.startsWith('/')) {
    // Any other absolute path is a /public asset (placeholders, og images).
    return null;
  }

  p = p.replace(/^\/+/, '');
  if (!p || p.includes('..')) return null;

  const ext = p.slice(p.lastIndexOf('.')).toLowerCase();
  if (!PHOTO_EXTENSIONS.includes(ext)) return null;

  return PHOTO_ROOT + p;
}

/**
 * Normalise to the relative form the Studio export and MDX frontmatter use.
 *
 * @param {string | null | undefined} src
 * @returns {string | null} e.g. 'slug/file.jpg'
 */
export function toRelativePhotoPath(src) {
  const key = toPhotoKey(src);
  return key ? key.slice(PHOTO_ROOT.length) : null;
}

/**
 * Every photo reference an entry's frontmatter makes, in the order a cover
 * should be chosen: explicit cover first, then hero, then the sequence, then
 * the gallery. Used both to pick a cover and to enumerate refs for the checker.
 *
 * @param {Record<string, any>} data frontmatter object
 * @returns {{ field: string, src: string }[]}
 */
export function photoRefs(data) {
  /** @type {{ field: string, src: string }[]} */
  const refs = [];
  if (data?.coverImage) refs.push({ field: 'coverImage', src: data.coverImage });
  if (data?.hero?.src) refs.push({ field: 'hero.src', src: data.hero.src });
  (data?.steps ?? []).forEach((s, i) => {
    if (s?.src) refs.push({ field: `steps[${i}].src`, src: s.src });
  });
  (data?.gallery ?? []).forEach((g, i) => {
    if (g?.src) refs.push({ field: `gallery[${i}].src`, src: g.src });
  });
  return refs;
}
