// Generate static HTML for the Privacy Policy and Terms from the same source
// as the in-app screens, so the App Store / paywall public URLs never drift.
//   node scripts/build-legal.mjs   → writes legal/privacy.html, legal/terms.html
// Host the `legal/` folder anywhere (Vercel, GitHub Pages, your domain) and use
// those URLs in App Store Connect.

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Pull the two docs out of the TS source without a build step.
const src = readFileSync(join(root, 'src/constants/legal.ts'), 'utf8');
const mod = await import(
  'data:text/javascript,' +
    encodeURIComponent(
      src
        .replace(/export interface[\s\S]*?\n}\n/, '')
        .replace(/:\s*LegalDoc/g, '')
        .replace(/export const/g, 'export const')
    )
);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function html(doc) {
  const sections = doc.sections
    .map(
      (s) =>
        `<h2>${esc(s.heading)}</h2>` + s.body.map((p) => `<p>${esc(p)}</p>`).join('')
    )
    .join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stride — ${esc(doc.title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 0 auto;
         padding: 40px 20px 80px; line-height: 1.6; color: #1a1a1a; background: #fff; }
  @media (prefers-color-scheme: dark){ body{ color:#e8e8e8; background:#0b0f14; } }
  h1 { font-size: 28px; margin-bottom: 4px; }
  .updated { color: #888; font-size: 13px; margin-bottom: 24px; }
  .intro { font-size: 16px; margin-bottom: 28px; }
  h2 { font-size: 17px; margin-top: 28px; }
  p { font-size: 15px; }
</style></head><body>
<h1>Stride — ${esc(doc.title)}</h1>
<div class="updated">Last updated ${esc(doc.updated)}</div>
<p class="intro">${esc(doc.intro)}</p>
${sections}
</body></html>`;
}

const out = join(root, 'legal');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'privacy.html'), html(mod.PRIVACY));
writeFileSync(join(out, 'terms.html'), html(mod.TERMS));
console.log('Wrote legal/privacy.html and legal/terms.html');
