# What is R7?

R7 Desktop is a desktop app built around three LLM agents. The interesting part is not the agents: it
is the bet underneath them — that a long-running agent does not have to pay full price for its own
history on every turn, and that the way a model is asked to answer can shrink what it costs to read.

This document explains the mechanism, in the open, so it can be attacked. It deliberately states no
savings figures: the reproducible measurement is a separate, pending job (`docs/PLAN-OPENSOURCE.md`,
S19), and this project does not publish claims it has not measured.

## The problem

Most agent apps resend the whole conversation every turn. Two things follow.

The context grows, so the input grows. And — the part that costs more than people expect — the prompt
prefix stops being byte-identical from turn to turn, which is exactly the condition a provider's prefix
cache needs in order to hit. A timestamp in the system prompt, a tool result spliced into the middle of
the history, a mid-turn rewrite of the conversation to "clean it up": any of those invalidate the cache
for every turn that follows, and the whole history is billed at the full input rate again.

So the design target is not "send fewer tokens". It is "keep the prefix stable enough that the tokens
you do send are billed at the cached rate".

## Ingredient 1 — the R7 wheel

The R7 wheel is an append-only store of turn pairs per agent, written by **the system**, not by the
model. It never carries the full transcript.

- At the end of every turn the system seals one pair: `R1` is the first line of the user's request,
  capped at 300 characters; `R2` is the visible answer, capped at 1,500 characters.
- The pair is appended to the wheel as a block headed `── Turno N ──`, and nothing already written is
  ever rewritten. Append-only is the whole point: a prefix that only grows is a prefix that keeps
  caching.
- On the next turn those blocks travel as stable `system` messages, in order, ahead of the new user
  message. The model reads its own recent history as short briefs instead of as a full transcript.
- The wheel lives on your machine, one per agent (`R7/<agent>/chat_N.txt` inside the app data folder).
  `R9` is the separate global store for selections and reusable context.

The conversation you see in the UI is a different object. It is kept only so the window can repaint
after a reload, and it **never** travels to the model. Memory (`Memories.txt`, the "session memories"
mode) is a third object: a user-written block that rides as a stable `system` message outside the wheel.

That separation is the point. What travels is small, ordered, stable and cacheable; what you see stays
rich.

## Ingredient 2 — pinning the provider

A prefix cache is tied to a model **and** an endpoint. If you leave routing to the marketplace default,
requests for the same model get spread across providers — and providers differ in whether they report
and apply cached input at all. One request lands on a caching endpoint, the next one does not, the
prefix shows up as uncached, and the saving evaporates turn after turn.

So each model used by the app is pinned to a provider order, declared next to the measurement that
justified it, and the pin is sent as `provider.order` in the request with `allow_fallbacks` still on.
The rule this repo applies before adopting any model is blunt: **if it does not cache the prefix at a
cheap cached-input rate, it is not worth using**, no matter how good or cheap its headline price is.
A cheap model that reports `cached=0` costs more per turn than an expensive one that hits.

## Ingredient 3 — compaction with no model call

Left alone, an append-only wheel grows forever. The app warns when the running billable count crosses
70,000 tokens, and the banner offers a button. That button compacts the wheel **without calling a
model**:

- the first turn is always kept — it is the original intent;
- the most recent turns are kept while they fit in the character budget (6,000 by default);
- everything in between is collapsed into a single marker recording how many turns were folded;
- the surviving turns are renumbered so the sequence stays readable;
- markers from earlier compactions are discarded, so they never accumulate.

This is deterministic text surgery, not summarisation. It has a real cost — the middle of a very long
session is gone, and the marker says how much — and that is a deliberate trade: a summarisation step
would mean a model call that rewrites the prefix, which is precisely what breaks the cache.

## Ingredient 4 — one loop, tools, and snapshots

There is no planner model, no multi-lane pipeline and no intra-turn rewriting of the conversation. One
turn is one loop: the system sends `[system prompt][wheel briefs][user message]` plus the tool
definitions, the model calls tools, the system executes them and returns the results, and the loop ends
when the model answers with text (capped at 25 iterations). The middle of the thread is never rewritten
mid-turn, because rewriting it would move the prefix.

What the agent may do is scoped per message: `read`, `edit` (file mutations only), `task`, and `full`
(which adds command execution, the plan board, memory and subagents). Every file write, and every effect
a command has inside the workspace, is captured in a per-turn snapshot, so a turn can be reverted; the
UI offers undo and regenerate. The bundle also ships a `cochi-full-access` capability that lets the
agent spawn a shell with scope over your home folder — that is real access, and the README says so
before you run it.

## Ingredient 5 — the OUT side: a register, not just a context trick

Saving tokens on the input is engineering. The author's thesis is that there is a second, less explored
dimension: **the format of the output**. Models spend output tokens on grammar that carries no
information — articles, possessives, prepositions. R7 Desktop's prompts ask the agents to answer in a
telegraphic register: short lines, no filler, no chat pleasantries. That is a prompt-level
approximation of something the author argues should be trained, not prompted — a compressed register,
still readable by humans, that shortens machine output across languages.

In the author's words, translated from his Spanish notes:

> The OUT was chosen in a telegram format, dropping prepositions and possessive vocabulary, to reduce
> OUT tokens. The ideal is a model trained specifically that way, achieving a new language for machines
> that shortens token consumption. Example:
> NOW — IN: "Where is that?" / OUT: "It is in the city warehouses"
> NEW LANGUAGE — OUT: "Warehouses City" (Spanish) / "Magasins City" (English).
> It is something humans understand, it reduces tokens and it can be a hybrid, but a language for
> machines has to be built that works across languages: for example, by removing prepositions and
> articles. That is why the prompts ask the LLMs to behave that way, though ideally they would come
> trained that way synthetically, in a language we humans understand.

And on the input side:

> The R7 wheel was effective on the IN, even though it only travelled inside the cache: it reduced IN
> spending.

A precision that does not contradict the author, it lands it: the wheel does not send *fewer* tokens so
much as it sends them at the **cached** rate — roughly an order of magnitude below normal input on
caching providers. The claim to publish is therefore: *the IN is paid at cache price, not at full
price.*

## How the numbers are accounted for

The app does not show raw token totals, because raw totals lie: they count cached input as if it were
billed at full rate, which can inflate a turn several times over. What the panels report is a
*billable* figure — uncached input at 1:1, cached input weighted by its own rate, completion tokens
1:1 — and the same accounting drives the 70k banner. Alongside it, a cache audit log records each
request's routing and cache hit, so a claim can be traced back to a real turn rather than to a
spreadsheet.

## What the rest of the engineering is

- **BYOK, no proxy.** Your key is stored on your machine and used to call the provider you chose.
  OpenRouter is the default; DeepSeek direct, Ollama and LM Studio are supported. There is no hosted
  tier in v0.1, and nothing in this project's name sits between you and the provider.
- **Supabase is optional and outside the critical path.** The system prompts and the image styles are
  versioned in the repository; without Supabase the app still starts and the image and music features
  still work, because they call the provider directly with your key.
- **A real SSRF guard.** URL filtering happens in JavaScript, but the fetch itself goes through a Rust
  command that resolves DNS, rejects internal addresses, pins the validated IP so the name cannot be
  rebound between check and request, and revalidates every redirect.
- **34 harness suites, no network.** The pure logic — wheel, session, plans, snapshots, permissions,
  token accounting, provider registry — runs under `npm test`. If you want to argue with the design,
  the assays are there to be argued with.

## What is not measured yet

The claim this project would eventually like to make is precise: the same session, same model, IN with
the pin and without it, OUT in the telegraphic register and OUT in a normal one, run as one turn per
agent, reported as a table with the billable counters and the cache audit lines. That table does not
exist yet. Until it does, everything above is a mechanism description, and the README says the same
thing: no savings figures are claimed.

Measurement is the invitation. If you think the wheel, the pin or the register does not do what is
described here, build the counter-example — the numbers live in your own app data folder.
