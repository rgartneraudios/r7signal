# What is R7?

R7 Desktop is a desktop app built around three LLM agents. The interesting part is not the agents: it
is the bet underneath them — that a long-running agent does not have to pay full price for its own
history on every turn, and that the way a model is asked to answer can shrink what it costs to read.

This document explains the mechanism, in the open, so it can be attacked. The IN measurement it
promised is no longer pending: the recipe is committed and the numbers are in
["What was measured"](#what-was-measured), with their caveats. The OUT side is still open — and this
project does not publish claims it has not measured.

## Why three agents, and why each one has tiers

Three agents instead of one, because the work does not live in one place and does not want the same
register: files and code (Cochi), media and planning (Asun), the live web (Tito). They are meant to
collaborate — the user is the messenger between them, and one artifact crosses over: the plan board Asun
writes and Cochi executes. Each keeps its own wheel, so a session with one agent never pays for the
history of the others, and each panel picks the cheapest model that can do the job.

**Cochi — the team's file administrator.** It has two tiers. *Centinela* is the everyday driver: a
low-cost flash model, text only. *Terminator* is the escalation: a bigger vision-capable model for work
that needs more rigor. The subagents Cochi spawns can be configured in either tier — they reuse the
parent's endpoint and key, which is why the selector only offers the tiers that live behind it.

**Asun — three modes in one agent.** The conversational side has a base tier and a High tier, like
Cochi: *MaríaBase* is multimodal and cheap to run with a very low cached-input rate, and *IrmaMax* is the
reasoning escalation, which in turn carries the extra *Project* mode for the IrmaMax architect (the
planning mode described above). The other two modes are not chat: in image generation Asun interviews
the user to build the ideal prompt before anything is rendered, and in music an LLM writes the song
prompt while an audio model renders it.

**Tito — current web search.** Perplexity was the first choice, and it was dropped on cost. The rule
that settled it is this repository's own: the engine left behind does not cache the prefix, and an
expensive answer that caches is cheaper per turn than a cheaper one that does not. What ships is the
same flash model as Centinela plus OpenRouter's default search engine as a server tool — around $0.007
per search, capped at two searches per turn, with the citations painted back into the answer instead of
being taken from what the model claims to have read.

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
after a reload, and it **never** travels to the model. Memory is a third object, and it gets its own
section right below.

That separation is the point. What travels is small, ordered, stable and cacheable; what you see stays
rich.

## Cold by default, and what "Session Memories" adds

A new session starts **cold**. That is the default position of the toggle in the header, and it is not a
compromise: a cold session has no accumulated memory, no wheel from another day and no context borrowed
from another agent. The briefs it writes are its own, written from zero.

The other position, `Session Memories`, injects one file as context: `Memories.txt`, in the app data
folder. It is plain text, one memory per line, written in the clipped register the agents answer in. Two
rules make it safe to read:

- **Only the user writes it.** There is no memory tool: the agents may read the file and cannot touch
  it. It is created and edited from the `Memories` button on the left side door, or by hand in the data
  folder.
- **It rides outside the wheel.** With the mode on, the file travels as a stable `system` block tagged
  `[USER MEMORIES]`, placed after the system prompt and before the wheel briefs — the same position for
  all three agents, because the file is shared by Cochi, Asun and Tito.

The cost logic is the same as everywhere else in this document: while the file does not change, that
block is byte-identical on every turn of the session, so it caches with the rest of the prefix. Edit the
memory mid-session and the prefix moves from that turn on — memory is context, and context that changes
is not free. Cold means only that the file is not read: it stays on disk, and flipping the toggle does
not delete it. Loading an old wheel is a separate, explicit action (the right side door, `Sessions`),
never a side effect of the switch.

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

Compaction is, in fact, the one place where this design deliberately lets the prefix move. The surviving
turns are renumbered, so the next request builds a new prefix and pays the cache write again. It is a
visible, one-off cost, and it is cheaper than carrying a wheel that grows without bound.

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

## Asun's project mode: planning so sessions stay short

Asun has a second role behind the `PROJECT` tab, on the models the catalog marks as project-capable:
senior architect. In that mode it writes no code, images or music. It interviews the user until the
scope is real — target language and stack, prototype versus product, whether web research is needed,
whether workspace write permission will be granted — and then turns the idea into a plan of short,
verifiable blocks and saves it to the board with a single tool call.

- One block = one atomic, actionable task. Too much in one block, and it gets split.
- Every block must declare its evidence: **how** completion is checked (a harness, a test, a commit, a
  manual check). A block whose completion cannot be checked is not a block.
- The definition belongs to Asun; the **status** belongs to Cochi, which executes the blocks and marks
  them. The board — not the chat — is the source of truth, and it lives outside the workspace and
  outside the prefix, as a JSON file in the app data folder that Cochi reads through tools.
- The user is the messenger: there are no automatic calls between agents.

The reason to plan this way is not tidiness. It is the budget argument of this whole document, applied
one level up: a short block becomes a short session with one objective, and a short session is one whose
prefix stays small and whose executor has one thing to hold in mind. Past roughly 70,000 tokens — the
line the app uses for its own warning banner — the models tested here start spending more on the same
work, and even granting that they do not hallucinate, there is simply less runway left before they
would. Splitting the project into blocks is how the app tries to keep the executor away from that line,
instead of compacting after crossing it.

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

### What prompting can and cannot do

Asking for the register in the prompt is a mitigation, not the fix. It changes the **visible** answer; it
does not change the work behind it. The model still reasons in the vocabulary and grammar it was trained
on, so the internal cost of that reasoning is untouched — the same tokens are spent, one layer below the
part the user reads. A system prompt can trim completion tokens; it cannot compress what the model
thinks with.

That is the argument for treating this as a training problem rather than a prompting problem: a synthetic
corpus written in the compressed register, or a model fine-tuned on it, is what would make the saving
hold across languages, and not only in the last layer of the output. Until then R7 Desktop ships the
prompt and measures what it can, with the numbers above as the honest size of the claim.

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

## What was measured

The recipe is committed: [`tools/s19-measure.mjs`](../tools/s19-measure.mjs) drives the app's own request
builder — `resolveProvider` + `buildBody` from `src/lib/llmClient.js`, the production Cochi prompt, the
real wheel briefs, and the same billable accounting the header shows — against a six-turn session, and
prints the table. Run it with your own key:

```powershell
$env:OPENROUTER_API_KEY='sk-or-v1-...'
node tools/s19-measure.mjs
```

Measured on 2026-10-13, `~deepseek/deepseek-v4-flash-latest`, Spanish prompt, six turns, 20 requests,
**$0.0006 of real spend**. The pinned arm sent byte-identical prefixes to the first unpinned arm — the
printed `prefix fingerprint` matches turn by turn — so the only difference between those two rows is the
pin.

| arm | served by | cached tokens per turn (1→6) | avg cached, turns 2+ | avg prompt | avg billable |
| --- | --- | --- | --- | --- | --- |
| unpinned | CoreWeave | 0, 0, 0, 1024, 0, 0 | 13.8% | 1397 | 1425 |
| unpinned (2nd run) | Venice | 768, 768, 768, 768, 0, 0 | 42.7% | 1153 | 798 |
| pinned | StreamLake | 768, 768, 1024, 1280, 1280, 1536 | 77.5% | 1397 | 655 |

Read it plainly. With the pin, the same prefixes were served at 77.5% cached and the billable counter
reported a bit over half of the unpinned run — 655 against 1425, for identical prompts. Without it, the
router picked a provider that reported no cached input at all in four of six turns, and a second
unpinned run landed on a third provider that cached for four turns and then stopped. The pin is
insurance: it costs nothing when default routing happens to be good, and it is the whole difference when
it is not.

Two caveats. This is n=1 per arm, one model, one window: a reproduction recipe, not a benchmark. And the
unpinned number is a lottery — an earlier run of the same arms landed everything on a single caching
provider and showed no difference at all, which is exactly why the unpinned arm now runs first and twice.

## What is still not measured

The OUT side of the thesis. Two single samples answered the same question with the production prompt and
with an explicit prose override: 134 against 209 completion tokens in one run, 256 against 315 in the
other. Both point the same way, and that is all they do — the telegraphic register was not even followed
reliably in one of the runs, so a register effect is not established. It needs the same treatment the IN
side got: more samples, fixed questions, and a blind read of the answers. And even then it would be a
prompt-level effect, for the reason given under "What prompting can and cannot do": whatever the
register saves on the page, the reasoning that produced it was still done in the model's own training
vocabulary.

Also pending: the same table for Asun and Tito, and the extreme case of a long session, where the
append-only wheel dominates the prefix and the cached share should climb towards the whole brief history.
No general savings figure is claimed.

Measurement is the invitation. If you think the wheel, the pin or the register does not do what is
described here, build the counter-example — the numbers live in your own app data folder.
