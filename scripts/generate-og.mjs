/**
 * Renders the default Open Graph card to public/og-default.png.
 * Run with `node scripts/generate-og.mjs` after changing the design tokens.
 * Output is committed so no image work happens at build time.
 */
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const W = 1200;
const H = 630;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <g stroke="#f0f1f3" stroke-width="1">
    ${Array.from({ length: Math.floor(W / 64) }, (_, i) => `<path d="M${i * 64 + 0.5} 0V${H}"/>`).join('')}
    ${Array.from({ length: Math.floor(H / 64) }, (_, i) => `<path d="M0 ${i * 64 + 0.5}H${W}"/>`).join('')}
  </g>
  <rect x="0" y="0" width="${W}" height="6" fill="#2f56d9"/>
  <g font-family="Segoe UI, Inter, Helvetica, Arial, sans-serif">
    <text x="96" y="268" font-size="30" letter-spacing="4" fill="#7c838e" font-family="Consolas, monospace">BUILDS &#183; FABRICATION &#183; RESTORATION</text>
    <text x="92" y="374" font-size="92" font-weight="600" letter-spacing="-3" fill="#16181c">Sean Melotti</text>
    <text x="96" y="432" font-size="32" fill="#5c626c">Custom vehicle builds, documented end to end.</text>
  </g>
  <rect x="96" y="496" width="72" height="3" fill="#2f56d9"/>
  <text x="96" y="556" font-size="26" letter-spacing="2" fill="#a3a9b3" font-family="Consolas, monospace">seanmelotti.com</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
await writeFile(new URL('../public/og-default.png', import.meta.url), png);
console.log(`Wrote public/og-default.png (${W}x${H}, ${png.length} bytes)`);
