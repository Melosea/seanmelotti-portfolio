/**
 * Human date labels for project eyebrows and page headers.
 *
 * Supports three shapes from frontmatter:
 *   date only              -> "Aug 2025"
 *   date + dateEnd         -> "Aug – Nov 2025" (same year) / "Aug 2025 – Mar 2026"
 *   date + ongoing: true   -> "Aug 2025 – Present" (ongoing wins over dateEnd)
 *
 * Frontmatter dates parse from 'YYYY-MM-DD' as UTC midnight, so every
 * formatter here pins timeZone: 'UTC'. Without it, a viewer in any
 * negative-offset timezone sees the previous day, which drifts the month
 * label backward for entries dated the 1st of a month.
 */
export function formatDateLabel(data, { monthStyle = 'short' } = {}) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    month: monthStyle,
    year: 'numeric',
    timeZone: 'UTC',
  });
  const start = fmt.format(data.date);

  if (data.ongoing) return `${start} – Present`;

  if (data.dateEnd) {
    const end = fmt.format(data.dateEnd);
    if (end === start) return start;
    if (data.date.getUTCFullYear() === data.dateEnd.getUTCFullYear()) {
      const monthOnly = new Intl.DateTimeFormat('en-US', {
        month: monthStyle,
        timeZone: 'UTC',
      });
      return `${monthOnly.format(data.date)} – ${end}`;
    }
    return `${start} – ${end}`;
  }

  return start;
}
