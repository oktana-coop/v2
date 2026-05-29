export const paragraph = 'block text-base/loose mb-4';

// Editor headings get font-family, font-weight, and font-size from CSS variables (see App.css).
// Only color and margin classes are needed here.
export const heading =
  'text-black dark:text-white text-opacity-90 dark:text-opacity-90 mb-4';

export const codeBlock =
  'block text-sm leading-5 p-4 font-mono bg-[var(--shiki-light-bg,rgb(237,237,237))] dark:bg-[var(--shiki-dark-bg,rgb(60,60,60))] mb-4';

export const blockquote =
  'block text-base/loose pl-4 border-l-4 border-black/10 dark:border-white/20 mb-4';

export const bulletList = 'list-disc pl-6 mb-4';

export const orderedList = 'list-decimal pl-6 mb-4';

export const noteContent = 'block text-sm mb-4';

// The <hr> element itself is a transparent block — just padding, no border.
// The "line" is a 1px-tall background-image (a `currentcolor → currentcolor`
// gradient) constrained to 100% width and pinned to `bg-center`, so it sits
// vertically centered. Drawing the line this way (instead of `border-top`,
// which would anchor it to the top of the box) lets the selection
// background-color fill symmetrically above and below it.
export const horizontalRule =
  'py-2 mb-4 border-0 text-gray-200 dark:text-gray-700 bg-[linear-gradient(currentcolor,currentcolor)] bg-no-repeat bg-center bg-[length:100%_1px] [&.ProseMirror-selectednode]:bg-black/5 dark:[&.ProseMirror-selectednode]:bg-white/10 [&.ProseMirror-selectednode]:outline-none';

// Figure selection follows the horizontal-rule pattern: a subtle background
// tint instead of an outline. Clicks usually land on the inline `image`, so
// `ProseMirror-selectednode` ends up on a descendant; `:has()` lifts the
// tint up to the figure element so the whole block is highlighted. A small
// padding (compensated with negative horizontal margin) gives the tint
// somewhere to show around the image without shifting layout.
//
// `figure_content` has inline content (`image?`), so PM classifies it as a
// textblock and injects a `ProseMirror-trailingBreak` `<br>` at the end for
// caret-placement scaffolding — which we don't need (figure_content is
// `atom: true`, no caret enters it). The `<br>` forces a second empty line
// below the image; hiding it removes the strip.
//
// Selection visual: Bear-style translucent overlay (an `::after`
// pseudo-element absolutely positioned over the figure). Avoids the
// outline-against-the-image harshness, and reads as "selected" by dimming
// the whole figure box. Clicks usually land on the inline `image`, so the
// `ProseMirror-selectednode` class ends up on a descendant — `:has()`
// lifts the overlay up to the figure.
export const figure =
  'block relative mb-4 [&_.ProseMirror-trailingBreak]:hidden [&.ProseMirror-selectednode]:after:content-[""] [&.ProseMirror-selectednode]:after:absolute [&.ProseMirror-selectednode]:after:inset-0 [&.ProseMirror-selectednode]:after:bg-black/25 [&.ProseMirror-selectednode]:after:pointer-events-none [&:has(.ProseMirror-selectednode)]:after:content-[""] [&:has(.ProseMirror-selectednode)]:after:absolute [&:has(.ProseMirror-selectednode)]:after:inset-0 [&:has(.ProseMirror-selectednode)]:after:bg-black/25 [&:has(.ProseMirror-selectednode)]:after:pointer-events-none';

export const caption = 'block text-sm text-neutral-600 dark:text-neutral-400';
