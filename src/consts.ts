/**
 * Site-wide constants. Single source of truth for metadata, navigation and
 * social links so the shell components never hard-code copy.
 */

export const SITE = {
  /** Used for <title> suffix and og:site_name. */
  name: 'Sean Melotti',
  /** Fallback <title> on pages that don't pass one. */
  title: 'Sean Melotti — Builds & Fabrication',
  /** Fallback meta description. */
  description:
    'Portfolio of custom vehicle builds, fabrication and restoration work by Sean Melotti.',
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
  { label: 'Builds', href: '/builds' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export type SocialLink = {
  label: string;
  href: string;
  /** Shown as the visible handle next to the label. */
  handle: string;
};

/** Placeholder socials — Sean supplies real handles in a later phase. */
export const SOCIAL_LINKS: SocialLink[] = [
  { label: 'Instagram', href: '#', handle: '@placeholder' },
  { label: 'YouTube', href: '#', handle: '@placeholder' },
  { label: 'Email', href: 'mailto:hello@seanmelotti.com', handle: 'hello@seanmelotti.com' },
];
