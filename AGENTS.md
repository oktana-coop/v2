# Domain

v2 is a rich-text editor with version control capabilities.

# Rich Text Model

v2 is programmatically integrated with Pandoc (included in v2-hs-lib, which is loaded via WASM), so it supports many rich text representations.

Although the "primary" rich text configuration is a variable in our config, assume that the app is writing Markdown files on disk. The document is transformed to the ProseMirror representation to support editing.

# Version Control Systems

There is an abstraction (port) for the version control system. Git is the default, and there are some functions like branching which are not supported for Automerge.

# Filesystem and Paths

When interacting with the filesystem, always consider cross-platform (MacOS/Windows/Linux) usage. In general, you should prefer the relevant `filesystem` port when dealing with the filesystem from the web app.

# Project Types

Projects are used to organize documents and also serve as the unit of sharing. Think of them like Git repositories; when the underlying version control system is Git, project and Git repo are 1:1.

There are multi-document and single-document projects.

## Multi-Document Projects

From a UX perspective, the editor is managing a folder of documents. When Git is used for version control (the default), the editor is managing the `.git` folder.

## Single-Document Projects

From a UX perspective, the editor is managing a single file which contains both the working directory and the version control history. These (e.g. workdir + `.git` folder) are packaged in an SQLite file.
