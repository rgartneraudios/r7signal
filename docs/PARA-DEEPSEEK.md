# A note to the DeepSeek team

R7 Desktop is a small open source desktop app built around three LLM agents. It exists to test one
hypothesis, and DeepSeek models are the ones it was tested on: a long-running agent does not have to pay
full price for its own history on every turn, and the register a model is asked to answer in changes what
that answer costs.

The mechanism is written out in [`docs/QUE-ES-R7.md`](QUE-ES-R7.md). This note is the short version
plus the three things we would ask a model provider to do about it. It is published as an invitation:
if the numbers below do not reproduce on your side, that is the most useful outcome for us.

## Who built this, and what is being asked for

R7 Desktop is a vibe-coding project. Its author is not a software engineer: the app was built by
directing AI models in natural language, and it is being published at the point where his own knowledge
stops being enough. That is the honest reason this note is an invitation and not a release
announcement. What the project can offer is a running app and a measurement; what it asks for is a
professional review of whether the method is efficient and viable. The gates, the harnesses and the
committed recipes exist for exactly that: so that someone who does this for a living can check the
claims instead of trusting them, and can say plainly what is wrong.

## What the app does, in one paragraph

Instead of resending an ever-growing transcript, the app keeps a local append-only store of turn pairs
(the R7 wheel) and sends those as stable `system` briefs, so the prompt prefix stays byte-identical
between turns and the provider's prefix cache can hit. Each model is pinned to the endpoints that report
cached input, because the same model spread across a marketplace's providers does not cache the same
way. The wheel is compacted by hand — deterministic text surgery, no model call — when the running
billable count crosses 70k tokens. There is no proxy: the user's own key goes to the provider they chose.

## What was measured

The recipe is committed and runs against the app's own request builder, not a reimplementation:
[`tools/s19-measure.mjs`](../tools/s19-measure.mjs). Six turns of a real Cochi session,
`~deepseek/deepseek-v4-flash-latest`, Spanish prompt, 20 requests, **$0.0006 of real spend**.

| arm | served by | cached tokens per turn (1→6) | avg cached, turns 2+ | avg billable |
| --- | --- | --- | --- | --- |
| unpinned | CoreWeave | 0, 0, 0, 1024, 0, 0 | 13.8% | 1425 |
| unpinned (2nd run) | Venice | 768, 768, 768, 768, 0, 0 | 42.7% | 798 |
| pinned | StreamLake | 768, 768, 1024, 1280, 1280, 1536 | 77.5% | 655 |

The pinned and unpinned arms sent byte-identical prefixes (the printed fingerprint matches turn by turn),
so the only difference between those rows is the pin. The caveats are in the design document and they are
real: n=1 per arm, one model, one window, a short session — a reproduction recipe, **not a benchmark**.
No general savings figure is claimed.

## Three asks

**1. Make prefix-cache behaviour a documented, per-endpoint contract.** The pin in this app exists
because the marketplace routes the same model to endpoints that differ in whether they cache and whether
they report it: one endpoint returned `cached = 0` for four of six turns on an unchanged prefix, and a
second one cached for four turns and then stopped. If cached-input capability and its reporting were
published per endpoint — and stable — a client could stop guessing. That is the single change that would
make apps like this one simpler and their costs predictable.

**2. Train the compressed register, instead of leaving it to a system prompt.** The app's prompts ask for
a telegraphic register (short lines, no filler, articles and possessives dropped where the line still
reads) because output tokens are the other half of the bill. That is a prompt-level approximation and it
has a hard ceiling: it changes the visible answer, not the work behind it. The model still reasons in the
vocabulary and grammar it was trained on, so the internal cost of producing the answer is untouched. A
model fine-tuned on a synthetic corpus in that register — human-readable, fact-preserving, and working
across languages rather than only in English — is the version of this idea that would actually hold. The
seed measurement for the OUT side (two samples, 134 vs 209 and 256 vs 315 completion tokens) is in the
design document, and it is honest about being inconclusive.

**3. Attack the measurement.** Run the committed recipe with your own key, on your own models, and
publish the table. If the wheel or the pin does not do what this repository says it does, a
counter-example with the numbers attached is worth more to the project than agreement. The same
invitation goes to anyone reading this who cares about token cost.

## Seed issues

Three issues to open on this repository, ready to paste. All of them are labelled to be picked up by
someone who has never seen the codebase; the first two are contained, the third is open-ended on purpose.

### Seed 1 — Store the provider API key in the OS keyring

**Title:** Store the provider API key in the OS keyring instead of plain text

**Labels:** `good first issue`, `enhancement`

**Body:**

`local_config.json` in the app data folder keeps one API key per provider in plain text. The
`README.md` security notes say so, and it is the weakest part of BYOK: any process that can read the
user's profile can read the key.

Move the secret to the platform store — Windows Credential Manager, macOS Keychain and
Secret Service/libsecret on Linux are all reachable from Rust, and the app already ships Tauri commands
in `src-tauri/`. Keep `local_config.json` for non-secret settings, migrate an existing key on first read
(a key found in the file is moved and the file is scrubbed), and keep the current in-app flow
(`ApiKeyModal`) unchanged for the user.

Acceptance criteria: after the first save, no provider key remains in plain text anywhere under the app
data folder; an existing plain-text key is migrated without the user re-entering it; a harness covers the
migration function; `npm run lint`, `npm run build` and `npm test` are green.

### Seed 2 — Formal i18n for the visible UI

**Title:** Extract the user-visible strings into an i18n catalog

**Labels:** `good first issue`, `enhancement`

**Body:**

The visible text of the three panels is now English, but it is written inline in the components: there is
no catalog and no way to switch language. The agent prompts are already halfway there
(`src/lib/prompts/` carries an English and a Spanish variant, selected by the `chat_language`
preference), so the missing piece is the UI layer.

Extract the user-visible strings into a catalog keyed by an id, ship `en` (current text, unchanged) and
`es`, and wire a locale preference. Keep the agent prompts on `chat_language` — they are a separate
switch, and changing them changes the prompt prefix (and therefore the cache).

Acceptance criteria: no user-visible literal left in the components, one catalog per locale, a harness
that fails when a key is missing in any locale, and no behaviour change when the locale is not touched.

### Seed 3 — Token-saving ideas, with numbers

**Title:** Token-saving ideas: measured proposals only

**Labels:** `help wanted`

**Body:**

This issue is the open door for ideas that reduce what an agent session costs. The rule is the one the
repository already applies to itself: a proposal arrives with a measurement, or with a committed recipe
that produces one, and not with a claim.

Open territory, in the project's own words: the same IN table for Asun and Tito; the extreme case of a
long session where the append-only wheel dominates the prefix; the OUT experiment with more samples,
fixed questions and a blind read of the answers; and any provider- or model-side behaviour (`cached=0`
reporting, cache eviction after idle time) that a client has to work around. Recipes that spend real
money go in `tools/`, never in `harness/`, which runs offline.

Acceptance criteria: for a measurement, the command to reproduce it, the raw output, and the model,
provider and window it was taken on. For a change, the gates this repository already enforces: lint 0/0,
build OK, `npm test` green.

## Contact

Issues and pull requests on
[github.com/rgartneraudios/r7signal](https://github.com/rgartneraudios/r7signal) are the channel, in
English or Spanish. MIT licensed; the design can be argued with, and the numbers live in your own app
data folder.
