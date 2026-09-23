/**
 * Site-wide constants. Single source of truth for metadata, navigation and
 * contact details so the shell components never hard-code copy.
 */

export const SITE = {
  /** Used for <title> suffix and og:site_name. */
  name: 'Sean Melotti',
  /** Fallback <title> on pages that don't pass one. */
  title: 'Sean Melotti — Projects & Fabrication',
  /** Fallback meta description. */
  description:
    'Portfolio of custom vehicle projects, fabrication and restoration work by Sean Melotti.',
  /** Default Open Graph image, served from /public. */
  ogImage: '/og-default.png',
  locale: 'en_US',
} as const;

export type NavItem = {
  label: string;
  href: string;
};

export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Projects', href: '/projects' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export type ContactMethod = {
  label: string;
  href: string;
  /** Shown as the visible value next to the label. */
  value: string;
};

/** Sean's direct contact details. Rendered in the footer and on /contact. */
export const CONTACT_METHODS: ContactMethod[] = [
  { label: 'Email', href: 'mailto:seancmelotti@gmail.com', value: 'seancmelotti@gmail.com' },
  { label: 'Phone', href: 'tel:+14434808889', value: '443-480-8889' },
];

export type SocialLink = {
  label: string;
  href: string;
  /** Shown as the visible handle next to the label. */
  handle: string;
};

/**
 * Social profiles are switched off for now — Sean asked for them off the site
 * until the accounts are ready. Leave the list empty rather than deleting the
 * wiring: the footer and /contact render it when it has entries, so adding a
 * handle here is all it takes to turn socials back on.
 */
export const SOCIAL_LINKS: SocialLink[] = [];
