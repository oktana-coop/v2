# Giving Files to the WASI Sandbox

How a WebAssembly program is given access to files it needs to read, even though it runs in a sandbox with no filesystem of its own.

## Problem & Terminology (Guest and Host)

A WebAssembly program uses WASI as the interface for its I/O — reading files, stdin/stdout, and so on. The running module is the **guest**; the Node or browser runtime executing it is the **host**. A WASI guest is sandboxed: it has **no ambient access** to the host's filesystem — it cannot open an arbitrary host path. So a program that needs to read a file has nothing to read from by default.

## The Solution: A Preopened Virtual Filesystem

WASI is **capability-based**: the guest starts with zero filesystem authority and can only reach directories the host explicitly **preopens** for it. A preopened directory is a capability handed to the guest before it runs — the guest can resolve paths under it, and nothing else.

So ahead of each run, the adapter:

1. Builds a small **virtual filesystem** containing only the files the program needs — each one given as an absolute guest path plus its bytes.
2. **Preopens the root** (`/`) of that filesystem, granting the guest a capability over the whole tree.

The guest can then open any absolute path under `/`, and the runtime serves the bytes from the virtual filesystem.

### Guest Paths vs Host Storage

A **guest path** (e.g. `/data/config.json`) is the address the program sees inside its sandbox. It is _not_ a host path — where the bytes physically live is the host's business:

- In Node, they're written to a throwaway temp directory on the real disk, mirroring the guest path.
- In the browser, they live in an in-memory filesystem; there is no real disk at all.

Either way the guest sees the same thing: an absolute path under a preopened `/`.

### Worked Example

A run that needs two files is handed this set (path → bytes):

```
/data/config.json        →  <bytes>
/lib/shared/strings.txt  →  <bytes>
```

The adapter lays them out as a virtual filesystem rooted at the preopened `/`:

```
/                       ← preopened root (the guest's only capability)
├── data/
│   └── config.json
└── lib/
    └── shared/
        └── strings.txt
```

The program runs and opens `/data/config.json`; the runtime resolves it through the `/` preopen to the backing store. A path outside the mounted set — say `/etc/passwd` — simply doesn't exist for the guest: the sandbox holds no capability for it.

## Worth Knowing

- **Only the mounted files exist** for the guest; nothing else from the host leaks in.
- **The backing store differs by host** (temp dir in Node, in-memory in the browser), but the guest's view is identical.
