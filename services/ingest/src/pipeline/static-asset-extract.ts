/**
 * Indexación estructural de CSS/SCSS y HTML para Falkor (:StaticAsset + embeddings).
 */

export interface CssIndexDetail {
  customProperties: string[];
  selectors: string[];
  elementSelectors: string[];
  mediaQueries: string[];
  keyframes: string[];
  layers: string[];
  imports: string[];
  fontFaces: string[];
  scssVariables: string[];
  /** `@use` / `@forward` / `@mixin` / `@include` (barrels Sass y partials). */
  sassDirectives: string[];
  /** Pseudo-elementos / clases (`::-webkit-scrollbar`, `:root`, …). */
  pseudos: string[];
}

export interface HtmlIndexDetail {
  tags: string[];
  ids: string[];
  classes: string[];
  links: string[];
  scripts: string[];
  stylesheets: string[];
  formFields: string[];
  meta: string[];
  title?: string;
  landmarks: string[];
}

export interface StaticAssetInfo {
  kind: 'css' | 'html';
  summary: string;
  tokens: string[];
  cssDetail?: CssIndexDetail;
  htmlDetail?: HtmlIndexDetail;
}

export interface StaticAssetParseResult {
  staticAssets: StaticAssetInfo[];
}

const CSS_CUSTOM_PROP_RE = /--([a-zA-Z0-9_-]+)\s*:/g;
const CSS_SCSS_VAR_RE = /\$([a-zA-Z_][\w-]*)\s*:/g;
const CSS_CLASS_ID_RE = /([.#][a-zA-Z][\w-]*(?:\s*,\s*[.#][a-zA-Z][\w-]*)*)\s*\{/g;
const CSS_ELEMENT_RE = /(?:^|[,{}\s])([a-z][\w-]*(?:\s*,\s*[a-z][\w-]*)*)\s*\{/gm;
const CSS_MEDIA_RE = /@media\s+([^{]+)\{/g;
const CSS_KEYFRAMES_RE = /@(?:-webkit-)?keyframes\s+([a-zA-Z0-9_-]+)/g;
const CSS_LAYER_RE = /@layer\s+([a-zA-Z0-9_.-]+)/g;
const CSS_IMPORT_RE = /@import\s+(?:url\()?['"]?([^'")\s;]+)/g;
const CSS_FONT_FACE_RE = /@font-face\s*\{[^}]*font-family\s*:\s*['"]?([^;'"]+)/gi;
/** Sass module / mixin: `@use 'x'`, `@forward "y"`, `@mixin foo`, `@include bar`. */
const CSS_SASS_DIRECTIVE_RE =
  /@(use|forward)\s+['"]([^'"]+)['"]|@(mixin|include)\s+([a-zA-Z_][\w-]*)/g;
/** `:root`, `::before`, `::-webkit-scrollbar`, etc. */
const CSS_PSEUDO_RE = /(:{1,2}-?[a-zA-Z_][\w-]*)/g;

const HTML_TAG_RE = /<\/?([a-zA-Z][\w-]*)\b/g;
const HTML_ID_RE = /\bid\s*=\s*['"]([^'"]+)['"]/gi;
const HTML_CLASS_RE = /\bclass\s*=\s*['"]([^'"]+)['"]/gi;
const HTML_HREF_RE = /\bhref\s*=\s*['"]([^'"]+)['"]/gi;
const HTML_SRC_RE = /\bsrc\s*=\s*['"]([^'"]+)['"]/gi;
const HTML_NAME_RE = /\bname\s*=\s*['"]([^'"]+)['"]/gi;
const HTML_META_RE = /<meta\b[^>]*(?:name|property)\s*=\s*['"]([^'"]+)['"][^>]*>/gi;
const HTML_TITLE_RE = /<title[^>]*>([^<]*)<\/title>/i;
const HTML_LINK_STYLE_RE = /<link\b[^>]*rel\s*=\s*['"]stylesheet['"][^>]*href\s*=\s*['"]([^'"]+)['"]/gi;

const HTML_LANDMARKS = new Set([
  'main',
  'nav',
  'header',
  'footer',
  'aside',
  'section',
  'article',
  'form',
]);

function uniqSorted(items: Iterable<string>, limit = 250): string[] {
  return [...new Set(items)].sort().slice(0, limit);
}

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

export function parseCssSource(path: string, source: string): StaticAssetParseResult {
  const text = stripCssComments(source);
  const customProperties: string[] = [];
  const scssVariables: string[] = [];
  const selectors: string[] = [];
  const elementSelectors: string[] = [];
  const mediaQueries: string[] = [];
  const keyframes: string[] = [];
  const layers: string[] = [];
  const imports: string[] = [];
  const fontFaces: string[] = [];
  const sassDirectives: string[] = [];
  const pseudos: string[] = [];

  for (const m of text.matchAll(CSS_CUSTOM_PROP_RE)) {
    if (m[1]) customProperties.push(`--${m[1]}`);
  }
  for (const m of text.matchAll(CSS_SCSS_VAR_RE)) {
    if (m[1]) scssVariables.push(`$${m[1]}`);
  }
  for (const m of text.matchAll(CSS_CLASS_ID_RE)) {
    const sel = m[1]?.trim();
    if (sel) selectors.push(sel.slice(0, 160));
  }
  for (const m of text.matchAll(CSS_ELEMENT_RE)) {
    const sel = m[1]?.trim();
    if (!sel || sel.includes('.') || sel.includes('#')) continue;
    if (/^(from|to|\d+%)$/.test(sel)) continue;
    elementSelectors.push(sel.slice(0, 80));
  }
  for (const m of text.matchAll(CSS_MEDIA_RE)) {
    if (m[1]) mediaQueries.push(m[1].trim().slice(0, 120));
  }
  for (const m of text.matchAll(CSS_KEYFRAMES_RE)) {
    if (m[1]) keyframes.push(m[1]);
  }
  for (const m of text.matchAll(CSS_LAYER_RE)) {
    if (m[1]) layers.push(m[1]);
  }
  for (const m of text.matchAll(CSS_IMPORT_RE)) {
    if (m[1]) imports.push(m[1].slice(0, 160));
  }
  for (const m of text.matchAll(CSS_FONT_FACE_RE)) {
    if (m[1]) fontFaces.push(m[1].trim().slice(0, 80));
  }
  for (const m of text.matchAll(CSS_SASS_DIRECTIVE_RE)) {
    if (m[1] && m[2]) sassDirectives.push(`@${m[1]} ${m[2]}`.slice(0, 160));
    else if (m[3] && m[4]) sassDirectives.push(`@${m[3]} ${m[4]}`.slice(0, 120));
  }
  for (const m of text.matchAll(CSS_PSEUDO_RE)) {
    if (m[1]) pseudos.push(m[1].slice(0, 80));
  }

  const cssDetail: CssIndexDetail = {
    customProperties: uniqSorted(customProperties),
    selectors: uniqSorted(selectors),
    elementSelectors: uniqSorted(elementSelectors),
    mediaQueries: uniqSorted(mediaQueries),
    keyframes: uniqSorted(keyframes),
    layers: uniqSorted(layers),
    imports: uniqSorted(imports),
    fontFaces: uniqSorted(fontFaces),
    scssVariables: uniqSorted(scssVariables),
    sassDirectives: uniqSorted(sassDirectives),
    pseudos: uniqSorted(pseudos),
  };

  const base = path.replace(/\\/g, '/').split('/').pop() ?? path;
  const tokens = uniqSorted([
    base,
    ...cssDetail.customProperties,
    ...cssDetail.scssVariables,
    ...cssDetail.selectors,
    ...cssDetail.elementSelectors,
    ...cssDetail.mediaQueries.map((q) => `@media ${q}`),
    ...cssDetail.keyframes.map((k) => `@keyframes ${k}`),
    ...cssDetail.layers.map((l) => `@layer ${l}`),
    ...cssDetail.imports.map((i) => `@import ${i}`),
    ...cssDetail.fontFaces.map((f) => `font-face:${f}`),
    ...cssDetail.sassDirectives,
    ...cssDetail.pseudos,
  ]);

  // Siempre indexar el stylesheet (barrels `@forward`/`@use`, overrides vendor, etc.).
  // Antes `tokens.length === 0` → sync lo marcaba como omitido (parse null).
  return {
    staticAssets: [
      {
        kind: 'css',
        summary: [
          `CSS ${path}`,
          `${cssDetail.customProperties.length} vars, ${cssDetail.selectors.length} class/id, ${cssDetail.mediaQueries.length} media`,
          cssDetail.sassDirectives.length ? `${cssDetail.sassDirectives.length} sass` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        tokens,
        cssDetail,
      },
    ],
  };
}

export function parseHtmlSource(path: string, source: string): StaticAssetParseResult {
  const tags: string[] = [];
  const ids: string[] = [];
  const classes: string[] = [];
  const links: string[] = [];
  const scripts: string[] = [];
  const stylesheets: string[] = [];
  const formFields: string[] = [];
  const meta: string[] = [];
  const landmarks: string[] = [];

  for (const m of source.matchAll(HTML_TAG_RE)) {
    const tag = m[1]?.toLowerCase();
    if (!tag) continue;
    tags.push(tag);
    if (HTML_LANDMARKS.has(tag)) landmarks.push(tag);
  }
  for (const m of source.matchAll(HTML_ID_RE)) {
    if (m[1]) ids.push(`#${m[1]}`);
  }
  for (const m of source.matchAll(HTML_CLASS_RE)) {
    for (const c of m[1].split(/\s+/)) {
      if (c) classes.push(`.${c}`);
    }
  }
  for (const m of source.matchAll(HTML_HREF_RE)) {
    if (m[1]) links.push(m[1].slice(0, 200));
  }
  for (const m of source.matchAll(HTML_SRC_RE)) {
    if (m[1]) scripts.push(m[1].slice(0, 200));
  }
  for (const m of source.matchAll(HTML_LINK_STYLE_RE)) {
    if (m[1]) stylesheets.push(m[1].slice(0, 200));
  }
  for (const m of source.matchAll(HTML_NAME_RE)) {
    if (m[1]) formFields.push(m[1].slice(0, 80));
  }
  for (const m of source.matchAll(HTML_META_RE)) {
    if (m[1]) meta.push(m[1].slice(0, 80));
  }
  const titleMatch = source.match(HTML_TITLE_RE);
  const title = titleMatch?.[1]?.trim().slice(0, 200);

  const htmlDetail: HtmlIndexDetail = {
    tags: uniqSorted(tags),
    ids: uniqSorted(ids),
    classes: uniqSorted(classes),
    links: uniqSorted(links),
    scripts: uniqSorted(scripts),
    stylesheets: uniqSorted(stylesheets),
    formFields: uniqSorted(formFields),
    meta: uniqSorted(meta),
    title,
    landmarks: uniqSorted(landmarks),
  };

  const tokens = uniqSorted([
    ...htmlDetail.tags,
    ...htmlDetail.ids,
    ...htmlDetail.classes,
    ...htmlDetail.links,
    ...htmlDetail.scripts,
    ...htmlDetail.stylesheets,
    ...htmlDetail.formFields,
    ...htmlDetail.meta,
    ...htmlDetail.landmarks,
    ...(title ? [`title:${title}`] : []),
  ]);

  if (tokens.length === 0) {
    const base = path.replace(/\\/g, '/').split('/').pop() ?? path;
    return {
      staticAssets: [
        {
          kind: 'html',
          summary: `HTML ${path} · empty/minimal`,
          tokens: [base],
          htmlDetail,
        },
      ],
    };
  }

  return {
    staticAssets: [
      {
        kind: 'html',
        summary: [
          `HTML ${path}`,
          title ? `"${title}"` : null,
          `${htmlDetail.tags.length} tags, ${htmlDetail.links.length} links`,
        ]
          .filter(Boolean)
          .join(' · '),
        tokens,
        htmlDetail,
      },
    ],
  };
}

export function parseStaticAssetSource(path: string, source: string): StaticAssetParseResult | null {
  const lower = path.replace(/\\/g, '/').toLowerCase();
  if (lower.endsWith('.css') || lower.endsWith('.scss')) return parseCssSource(path, source);
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return parseHtmlSource(path, source);
  return null;
}
