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
  { label: 'Skills', href: '/skills' },
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
  // Phone intentionally removed for now (2026-09-24). Restore by uncommenting:
  // { label: 'Phone', href: 'tel:+14434808889', value: '443-480-8889' },
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

export type Discipline = {
  name: string;
  /** One line on what the discipline covers. Shown on /about. */
  description: string;
};

/**
 * The four disciplines from Sean's positioning statement, expanded one line
 * each. Order matches the statement on the homepage — keep them in sync.
 */
export const DISCIPLINES: Discipline[] = [
  {
    name: 'Mechanical Restoration',
    description:
      'Teardown, inspection and rebuild of worn assemblies — measured on the way apart so it goes back together to a spec that holds up in use.',
  },
  {
    name: 'Fabrication',
    description:
      'Metalwork made to fit: panels formed on the bench, mounts and brackets cut and welded, repair sections let into original structure.',
  },
  {
    name: '3D Modeling',
    description:
      'CAD models of the parts that have to be replaced, adapted or made from nothing — measured first, drawn to fit the car it is going in.',
  },
  {
    name: 'Additive Manufacturing',
    description:
      'Printed parts, patterns and fixtures — replacements for trim nobody stocks any more, and the tooling that makes the rest of the job easier.',
  },
];

export type ProfileFact = {
  label: string;
  /**
   * Null until Sean supplies it. Unset facts are skipped entirely rather than
   * rendered as placeholder text, and the whole block hides when none are set.
   */
  value: string | null;
};

/**
 * Everything the /about page says, in one place — Sean can rewrite that page
 * without touching markup.
 *
 * `intro` is a holding draft written in a neutral voice: it restates the
 * positioning statement and the documentation promise already on the homepage
 * and makes no biographical claims. Replace it with Sean's own words.
 */
export const PROFILE = {
  lede: 'Restoration, fabrication and 3D work — documented from teardown to the last torque check.',
  intro: [
    'I restore and build mechanical things — assemblies brought back to spec, metal formed and welded to fit, and parts modelled in CAD and printed when nothing off the shelf will do the job.',
    'Every project here is documented end to end: what came in, what it needed, how it was measured, and where it ended up. The write-up is as much of the work as the photos are.',
  ],
  facts: [
    { label: 'Based in', value: null },
    { label: 'Working since', value: null },
    { label: 'Shop setup', value: null },
    { label: 'Open to', value: null },
  ] as ProfileFact[],
};
