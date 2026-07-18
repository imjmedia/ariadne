import { describe, expect, it } from 'vitest';
import { parseCssSource, parseHtmlSource, parseStaticAssetSource } from './static-asset-extract';

describe('static-asset-extract', () => {
  it('parseCssSource extrae vars, selectores, media y keyframes', () => {
    const css = `
:root { --brand: #000; }
.card, .card--active { color: var(--brand); }
@media (min-width: 768px) { .card { padding: 1rem; } }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@import url('theme.css');
@font-face { font-family: 'Inter'; }
$primary: blue;
`;
    const r = parseCssSource('styles/app.scss', css);
    const asset = r.staticAssets[0];
    expect(asset?.kind).toBe('css');
    expect(asset?.cssDetail?.customProperties).toContain('--brand');
    expect(asset?.cssDetail?.scssVariables).toContain('$primary');
    expect(asset?.cssDetail?.selectors.some((s) => s.includes('.card'))).toBe(true);
    expect(asset?.cssDetail?.mediaQueries.some((q) => q.includes('768px'))).toBe(true);
    expect(asset?.cssDetail?.keyframes).toContain('fade-in');
    expect(asset?.cssDetail?.imports.some((i) => i.includes('theme.css'))).toBe(true);
    expect(asset?.cssDetail?.fontFaces).toContain('Inter');
  });

  it('parseHtmlSource extrae tags, ids, clases, links y title', () => {
    const html = `<!DOCTYPE html>
<html>
<head><title>Portal</title><link rel="stylesheet" href="/app.css"></head>
<body>
  <main id="root">
    <a href="/login" class="btn primary">Login</a>
    <form><input name="email" /></form>
    <meta name="viewport" content="width=device-width" />
  </main>
  <script src="/bundle.js"></script>
</body>
</html>`;
    const r = parseHtmlSource('public/index.html', html);
    const asset = r.staticAssets[0];
    expect(asset?.kind).toBe('html');
    expect(asset?.htmlDetail?.title).toBe('Portal');
    expect(asset?.htmlDetail?.ids).toContain('#root');
    expect(asset?.htmlDetail?.classes).toEqual(expect.arrayContaining(['.btn', '.primary']));
    expect(asset?.htmlDetail?.links).toContain('/login');
    expect(asset?.htmlDetail?.stylesheets).toContain('/app.css');
    expect(asset?.htmlDetail?.scripts).toContain('/bundle.js');
    expect(asset?.htmlDetail?.formFields).toContain('email');
    expect(asset?.htmlDetail?.landmarks).toContain('main');
  });

  it('parseStaticAssetSource enruta por extensión', () => {
    expect(parseStaticAssetSource('a.css', '.x {}')?.staticAssets[0]?.kind).toBe('css');
    expect(parseStaticAssetSource('a.html', '<div></div>')?.staticAssets[0]?.kind).toBe('html');
    expect(parseStaticAssetSource('a.ts', 'export {}')).toBeNull();
  });
});
