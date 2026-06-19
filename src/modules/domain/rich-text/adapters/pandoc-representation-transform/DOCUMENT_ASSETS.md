# Document Assets in Exports & Previews

How referenced images (and other local assets) end up embedded when a document is exported (HTML, PDF, Docx) or shown in Print Preview. This describes the landscape and the approach, not the wiring.

## The Problem

Documents are Markdown; image references are **document-relative** paths like `assets/logo.png` or `../shared/chart.png`. To export or preview a document, we convert it with Pandoc, and Pandoc has to **read the actual image bytes** to embed them (inline data in HTML/PDF, native media in Docx).

The catch: **Pandoc runs as a WASM/WASI module with no filesystem, and we hand it the document as a string, not a file.** So a relative ref like `assets/logo.png` points at nothing — there is no directory for Pandoc to read it from. Without a fix, images are broken in Preview/PDF/HTML and missing in Docx. (In the editor images render fine, because there they go through an app-internal mechanism that doesn't involve Pandoc.)

## The Solution: A Virtual Filesystem + Resource Path

For each export we give Pandoc just enough of a filesystem to do its job:

1. Find the assets the document references.
2. Read their bytes from the project (through the same path the rest of the app uses, so it works regardless of how the project is stored).
3. **Mount only those assets into Pandoc's WASI virtual filesystem**, laid out at their project-relative locations — mirroring the project's folder structure, but containing only the referenced files. The document itself is not mounted; its content is the string we pass in.
4. Tell Pandoc the document's own folder as the **resource path**.

With that in place, each format embeds its images: HTML and PDF inline them as data, Docx embeds them as native media.

### What the Resource Path Is

Pandoc's **resource path** is simply the base directory it resolves _relative_ references against: for a relative ref it reads `resourceDir / ref`. (Absolute paths and URLs ignore it.)

Normally Pandoc reads a document _from a file_, so it resolves relative refs against that file's directory automatically. We instead pass the document as a **string into a sandbox**, so there is no such directory — we have to state it explicitly. Setting the resource path to the document's folder makes its relative refs resolve exactly as if the document lived there on a real disk: the join `resourceDir / ref` reproduces each asset's project-relative location, which is precisely where we mounted it.

### Worked Example

Document `book/chapters/intro.md` referencing three different folders:

```markdown
![](media/photo.jpg) <!-- doc-relative -->
![](../../assets/logo.png)
![](../../shared/figures/chart.png)
```

Virtual filesystem (only the referenced files; no `intro.md`):

```
/                       ← virtual FS root (stands in for the project root)
├── assets/
│   └── logo.png
├── book/
│   └── chapters/
│       └── media/
│           └── photo.jpg
└── shared/
    └── figures/
        └── chart.png
```

Everything lives in this virtual filesystem, which starts at its own root `/` (standing in for the project root). So the mounted assets and the resource path are all absolute paths from `/` — the document's folder, for instance, is `/book/chapters`.

Pandoc resolves each reference against the resource path, `/book/chapters` — where `..` means "go up to the parent folder", as it does everywhere else:

- `media/photo.jpg` → into the doc's own `media/` → `/book/chapters/media/photo.jpg` ✓
- `../../assets/logo.png` → up two levels to the root, then into `assets/` → `/assets/logo.png` ✓
- `../../shared/figures/chart.png` → up two levels to the root, then into `shared/figures/` → `/shared/figures/chart.png` ✓

One resource path (the doc's own folder) resolves refs reaching into any folder at any depth. The `..` never climbs above the root, so the WASI sandbox permits them.

## Worth Knowing

- **Only referenced assets are mounted**, never the whole project.
- **A missing asset is skipped, not fatal** — a dangling ref degrades to a broken image rather than failing the whole export.
