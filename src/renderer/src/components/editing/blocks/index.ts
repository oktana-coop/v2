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

// PM appends a `ProseMirror-trailingBreak` <br> we don't need.
// Selection and diff styles are defined in CSS.
export const figure =
  'block relative mb-4 [&_.ProseMirror-trailingBreak]:hidden';

export const caption = 'block text-sm text-neutral-600 dark:text-neutral-400';
