# Contributing to R7 Desktop

Thanks for wanting to help. This document is the short version of how work happens here. The long
version — the roadmap by sessions and every design decision — lives in `AGENTS.md` and
`docs/PLAN-OPENSOURCE.md`. Read those two before opening a pull request that touches behaviour.

## What this project is

R7 Desktop is a Tauri 2 + React 18 desktop app with three LLM agents (Cochi for workspace tasks,
Asun for music and images, Tito for chat and web search) built around the **R7 context wheel**: an
append-only store of turn pairs that keeps the prompt prefix cacheable and compactable without a
model call. The interesting engineering is in `src/lib/` — pure, injectable logic — and in
`src-tauri/src/fetch.rs`, the SSRF guard for `web_fetch`.

## Ground rules

1. **One change, one front.** A pull request should not mix, say, a translation with a refactor.
2. **Small diffs.** The reference size is about three files per change. If the work grows past that,
   cut it and open a second pull request.
3. **Pure logic gets a harness.** Any new non-UI logic in `src/lib/` must be pure and injectable, and
   must ship with a `harness/<name>.harness.mjs` following the existing `check(label, actual,
   expected)` pattern. `npm test` runs all of them.
4. **No comments unless asked.** The codebase is deliberately comment-light.
5. **User-visible text is written in English.** Code comments and `AGENTS.md` stay in Spanish.
6. **Never commit a key.** See *Secrets* below.

## Development setup

Requirements: Node.js, the Rust toolchain, and on Windows the WebView2 runtime.

```bash
npm install
cp .env.example .env      # optional; only needed for the Supabase features
npx tauri dev             # desktop app
npm run dev               # web hub only (http://localhost:5173)
```

The app is BYOK (bring your own key): on first launch it asks for an OpenRouter key and stores it in
`local_config.json` under the app data folder. Without a key the agents cannot answer, and the web
hub still runs.

No API key is needed to run the gates, and none of the harnesses touch the network.

## Gates

Every pull request must pass all three, with no exceptions:

```bash
npm run lint     # eslint: 0 errors, 0 warnings
npm run build    # vite build
npm test         # every harness in harness/
```

If a gate fails, the change is fixed or reverted — it is not merged with a failing gate. Paste the
three results in the pull request description.

## Secrets

The `VITE_` prefix rule matters here: Vite inlines every variable prefixed with `VITE_` into the
compiled bundle, so it is public by definition. Never give a secret that prefix. `OPENROUTER_API_KEY`
and `SUPABASE_SERVICE_ROLE_KEY` are unprefixed and server-side only; `.env` and `.env.local` are
gitignored, and `.env.example` is the versioned template. If you think you found a leaked secret,
open an issue marked as a security report before anything else.

## Prompts

The system prompts for the three agents live in Supabase today, not in this repository;
`src/lib/cochiAgentPrompt.js` is only a minimal fallback. Editing the prompt files here does not
change the running app. Moving the prompts into versioned code is planned work; until then, treat
prompt changes as configuration changes, not code changes.

## Commits and pull requests

Commits are written in Spanish, with a prefix that states the kind of change, and explain the root
cause plus what was verified:

```
Cochi: fix del truncado de líneas en cochiTools - harness cochiTools actualizado
Refactor: extraer el parseo de la rueda a r7Wheel.js
Fix: el editor restaura el EOL original al reemplazar en CRLF
```

A good pull request says what changed, why the previous behaviour was wrong, and which harness or
gate proves the fix. Screenshots help a lot for UI work. If the change is a design decision rather
than a bug fix, add a line to the plan document so the next person finds the reasoning.

## Reporting bugs

Include the app version, your OS, the provider and model you were using, and whether the turn went
through the single loop or a tool call. If the bug involves token counts or cost, attach the header
numbers (`cached`, `billable`) — the token accounting is the part of this project most worth
critiquing.

## License and trademark

The code is MIT (see `LICENSE`). By contributing you agree that your contribution is licensed under
the same terms. MIT covers the code, not the name: "R7Signal" and "R7 Desktop" belong to the author,
and a fork may not present itself as the official app. See the Trademark section of the `README.md`.
