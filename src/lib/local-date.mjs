/**
 * Local-calendar date stamping for Studio content.
 *
 * Why this exists: `new Date().toISOString().slice(0, 10)` yields the date in
 * UTC, not in the author's timezone. In US Central (UTC-5/-6) every entry
 * created after ~18:00-19:00 local is stamped with TOMORROW's date. Content
 * dates are calendar facts about the author's day, not instants in time, so
 * they must be derived from local components.
 */

/**
 * Today's date in the local timezone as `YYYY-MM-DD`.
 * @param {Date} [d] - override for testing
 * @returns {string}
 */
export function localDateStamp(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
