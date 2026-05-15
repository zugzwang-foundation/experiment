// Vitest shim for "server-only". The real npm package
// (https://npm.im/server-only) throws if a server module is bundled into a
// client component — Next.js detects this at build time. Tests run in Node
// without a client/server bundle split, so the throw is spurious. This shim
// is wired via `resolve.alias` in vitest.config.ts.
export {};
