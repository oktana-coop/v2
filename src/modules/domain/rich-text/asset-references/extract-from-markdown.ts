import { toPosixPath } from '../../../infrastructure/filesystem';

const MARKDOWN_IMAGE_REF = /!\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g;

const stripFragmentAndQuery = (url: string) => url.replace(/[?#].*$/, '');

const isLikelyExternalUrl = (url: string) =>
  /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) || url.startsWith('//');

/**
 * INTERIM IMPLEMENTATION — extracts asset paths from inline Markdown image
 * syntax (`![alt](path)`) via regex. POSIX-normalized, deduped, strips
 * fragments/queries, skips external URLs.
 *
 * Known limitations of this regex approach:
 *  - Matches `![...](...)` patterns inside code fences and inline code
 *    (false positives).
 *  - Doesn't ignore HTML comments (`<!-- ![alt](x.png) -->`).
 *  - Misses reference-style images (`![alt][ref]` + `[ref]: path`).
 *  - Misses raw `<img src="...">` tags embedded in Markdown.
 *  - Misbehaves with Pandoc attribute syntax `![cap](p.png){#fig width=50%}`
 *    and with URLs containing nested parentheses.
 *
 * TODO: replace with an AST-based extractor that goes through v2-hs-lib /
 * Pandoc, since Pandoc is already our source of truth for Markdown round-
 * tripping. Any second parser will disagree with Pandoc on edge cases — and
 * disagreements here mean we'd fail to auto-stage assets that Pandoc would
 * have rendered as a Figure (the worst-case failure for commit consistency).
 */
export const extractAssetReferencesFromMarkdown = (
  content: string
): string[] => {
  const seen = new Set<string>();
  for (const match of content.matchAll(MARKDOWN_IMAGE_REF)) {
    const raw = match[1];
    if (!raw || isLikelyExternalUrl(raw)) continue;
    const cleaned = toPosixPath(stripFragmentAndQuery(raw)).replace(
      /^\.?\/+/,
      ''
    );
    if (!cleaned) continue;
    seen.add(cleaned);
  }
  return Array.from(seen);
};
