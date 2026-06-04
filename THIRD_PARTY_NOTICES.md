# Third-Party Notices

This repository is licensed AGPL-3.0-or-later (see `License.md` / ADR-0001). It
incorporates work derived from the third-party software listed below. The
required notices are reproduced verbatim.

## Manifold (manifoldmarkets/manifold)

- **Derived surface:** the CPMM mathematics in `docs/specs/cpmm.md` and its
  implementation under `src/server/cpmm/` (see `cpmm.md` §2 for the exact
  kept / stripped / replaced inventory).
- **Source read at:** `zugzwang-foundation/manifold-reference`, tag
  `ref-2026-04-28-found5` = commit
  `d5b55cf9472ec05f545e6c1a817d88005b8dbf2b` (read-only reference fork of
  upstream `manifoldmarkets/manifold`; map: `docs/references/manifold.md`),
  file `common/src/calculate-cpmm.ts`.
- **License:** MIT — full notice below, byte-exact from the pinned fork's
  `LICENSE.md`.

```text
MIT License

Copyright (c) 2022 Manifold Markets, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
