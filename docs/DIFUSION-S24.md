# Announcement — R7 Desktop (EN / ES)

Drafts for the S24 diffusion session. Everything below claims exactly what `docs/QUE-ES-R7.md` measures
and nothing else: no savings percentage, no benchmark, no promise. The long form goes to GitHub
Discussions, community forums and the note to the DeepSeek team; the short form goes to X and LinkedIn.
The Spanish version follows each English one.

Both languages carry the same four things: what R7 Desktop is, the measured result, the ask to train the
compressed register, and the links — the design note, the note to DeepSeek, the three open issues and the
installer.

Repo: https://github.com/rgartneraudios/r7signal

---

## Long form — English

**Title**

R7 Desktop: an append-only wheel, a provider pin, and the numbers behind them

**Body**

R7 Desktop is a small open source desktop app — Tauri + React, MIT, BYOK — built around three LLM agents.
The interesting part is not the agents. It is the bet underneath them: a long-running agent does not have
to pay full price for its own history on every turn, and the register a model is asked to answer in
changes what that answer costs. It is built and measured on DeepSeek models.

What the app does, in one paragraph. Instead of resending an ever-growing transcript, it keeps a local
append-only store of turn pairs — the R7 wheel, written by the system and not by the model — and sends
those as stable `system` briefs, so the prompt prefix stays byte-identical between turns and the
provider's prefix cache can hit. Each model is pinned to the endpoints that report cached input, because
the same model spread across a marketplace's providers does not cache the same way. The wheel is
compacted by hand — deterministic text surgery, no model call — when the running billable count crosses
70k tokens. There is no proxy: your key goes to the provider you chose, and it stays on your machine.

The measurement, not a promise. The recipe is committed
([`tools/s19-measure.mjs`](https://github.com/rgartneraudios/r7signal/blob/main/tools/s19-measure.mjs)) and
drives the app's own request builder instead of a reimplementation: six turns of a real session,
`~deepseek/deepseek-v4-flash-latest`, 20 requests, **$0.0006 of real spend**.

| arm | served by | avg cached, turns 2+ | avg billable |
| --- | --- | --- | --- |
| unpinned | CoreWeave | 13.8% | 1425 |
| unpinned (2nd run) | Venice | 42.7% | 798 |
| pinned | StreamLake | 77.5% | 655 |

The pinned and unpinned arms sent byte-identical prefixes — the printed fingerprint matches turn by turn
— so the only difference between those rows is the pin. The caveats are real: n=1 per arm, one model, one
window, a short session. This is a reproduction recipe, **not a benchmark**, and no general savings figure
is claimed. Without the pin, the router picked a provider that reported no cached input at all in four of
six turns.

What we are asking for. One thing above all: **train the compressed register instead of leaving it to a
system prompt.** The prompts ask the agents for a telegraphic register — short lines, no filler, articles
and possessives dropped where the line still reads — because output tokens are the other half of the bill.
That is a prompt-level approximation with a hard ceiling: it changes the visible answer, not the work
behind it, and the model still reasons in the vocabulary it was trained on. A model fine-tuned on a
synthetic corpus written in that register — human-readable, fact-preserving, working across languages
rather than only in English — is the version of this idea that would hold. The seed measurement for the
OUT side is two samples, 134 against 209 and 256 against 315 completion tokens, and it is reported as
inconclusive.

The full argument, plus the other two asks — a documented per-endpoint prefix-cache contract, and
attacking this measurement with your own key — is in
[`docs/PARA-DEEPSEEK.md`](https://github.com/rgartneraudios/r7signal/blob/main/docs/PARA-DEEPSEEK.md).
The mechanism is written out in
[`docs/QUE-ES-R7.md`](https://github.com/rgartneraudios/r7signal/blob/main/docs/QUE-ES-R7.md).

Three issues are open for whoever wants to pick one up:
[#11 keyring](https://github.com/rgartneraudios/r7signal/issues/11),
[#12 i18n catalog](https://github.com/rgartneraudios/r7signal/issues/12),
[#13 measured token-saving proposals](https://github.com/rgartneraudios/r7signal/issues/13).

Download (Windows installer, v0.1.0):
https://github.com/rgartneraudios/r7signal/releases/download/v0.1.0/R7.Desktop_0.1.0_x64-setup.exe —
no macOS or Linux build yet. It is a vibe-coding project: built by directing AI models in natural
language, published at the point where that stops being enough. MIT, so the design can be argued with, and
the numbers live in your own app data folder.

## Long form — Español

**Título**

R7 Desktop: una rueda append-only, un pin de proveedor y los números que hay detrás

**Cuerpo**

R7 Desktop es una app de escritorio open source pequeña — Tauri + React, MIT, BYOK — construida alrededor
de tres agentes LLM. Lo interesante no son los agentes. Es la apuesta que hay debajo: un agente de larga
duración no tiene que pagar el precio completo de su propio historial en cada turno, y el registro en el
que se le pide responder cambia lo que cuesta esa respuesta. Está construida y medida sobre modelos
DeepSeek.

Qué hace la app, en un párrafo. En vez de reenviar una transcripción que crece sin fin, mantiene un
almacén local append-only de pares de turno —la rueda R7, que escribe el sistema y no el modelo— y los
manda como briefs `system` estables, así el prefijo del prompt queda byte-idéntico entre turnos y la caché
de prefijo del proveedor puede acertar. Cada modelo va pineado a los endpoints que reportan input
cacheado, porque el mismo modelo repartido entre los proveedores de un marketplace no cachea igual. La
rueda se compacta a mano —cirugía de texto determinista, sin llamada a modelo— cuando el contador
facturable cruza los 70k tokens. No hay proxy: tu key va al proveedor que elegiste y se queda en tu
máquina.

La medición, no una promesa. La receta está commiteada
([`tools/s19-measure.mjs`](https://github.com/rgartneraudios/r7signal/blob/main/tools/s19-measure.mjs)) y
usa el armador de requests de la propia app, no una reimplementación: seis turnos de una sesión real,
`~deepseek/deepseek-v4-flash-latest`, 20 requests, **$0.0006 de gasto real**.

| brazo | servido por | cacheado medio, turnos 2+ | billable medio |
| --- | --- | --- | --- |
| sin pin | CoreWeave | 13.8% | 1425 |
| sin pin (2ª pasada) | Venice | 42.7% | 798 |
| con pin | StreamLake | 77.5% | 655 |

Los brazos con pin y sin pin mandaron prefijos byte-idénticos —el fingerprint que imprime la tabla coincide
turno a turno—, así que la única diferencia entre esas filas es el pin. Las salvedades son reales: n=1 por
brazo, un modelo, una ventana, una sesión corta. Esto es una receta reproducible, **no un benchmark**, y no
se reclama ninguna cifra general de ahorro. Sin el pin, el ruteo cayó en un proveedor que no reportó input
cacheado en cuatro de seis turnos.

Qué pedimos. Una cosa por encima de todo: **entrenar el registro comprimido en vez de dejarlo a un system
prompt.** Los prompts piden a los agentes un registro telegráfico —líneas cortas, sin relleno, artículos y
posesivos fuera donde la línea todavía se lee— porque los tokens de salida son la otra mitad de la
factura. Eso es una aproximación por prompt con techo duro: cambia la respuesta visible, no el trabajo que
hay detrás, y el modelo sigue razonando con el vocabulario con el que fue entrenado. Un modelo afinado
sobre un corpus sintético escrito en ese registro —legible para humanos, que preserva los hechos, que
funciona en varios idiomas y no sólo en inglés— es la versión de esta idea que se sostendría. La medición
semilla del lado OUT son dos muestras, 134 contra 209 y 256 contra 315 tokens de completion, y se reporta
como inconclusa.

El argumento completo, más los otros dos pedidos —un contrato de caché de prefijo documentado por endpoint,
y atacar esta medición con tu propia key— está en
[`docs/PARA-DEEPSEEK.md`](https://github.com/rgartneraudios/r7signal/blob/main/docs/PARA-DEEPSEEK.md).
El mecanismo está escrito en
[`docs/QUE-ES-R7.md`](https://github.com/rgartneraudios/r7signal/blob/main/docs/QUE-ES-R7.md).

Hay tres issues abiertas para quien quiera tomar una:
[#11 keyring](https://github.com/rgartneraudios/r7signal/issues/11),
[#12 catálogo de i18n](https://github.com/rgartneraudios/r7signal/issues/12),
[#13 propuestas de ahorro de tokens medidas](https://github.com/rgartneraudios/r7signal/issues/13).

Descarga (instalador de Windows, v0.1.0):
https://github.com/rgartneraudios/r7signal/releases/download/v0.1.0/R7.Desktop_0.1.0_x64-setup.exe —
todavía no hay build de macOS ni de Linux. Es un proyecto de vibe coding: construido dirigiendo modelos de
IA en lenguaje natural, publicado en el punto donde eso deja de alcanzar. MIT, así que se puede discutir
el diseño, y los números viven en tu propia carpeta de datos de la app.

---

## Short form — English (X, 280 characters max)

```text
R7 Desktop (MIT, BYOK): an append-only context wheel + a provider pin. Pinned vs unpinned: 77.5% served from cache, billable 655 vs 1425. Recipe committed; n=1, not a benchmark. The ask to DeepSeek: train the compressed register.
https://github.com/rgartneraudios/r7signal
```

## Short form — Español (X, 280 caracteres máximo)

```text
R7 Desktop (MIT, BYOK): rueda de contexto append-only + pin de proveedor. Con y sin pin: 77.5% servido desde caché, billable 655 vs 1425. Receta commiteada; n=1, no es un benchmark. El pedido a DeepSeek: entrenar el registro comprimido.
https://github.com/rgartneraudios/r7signal
```

---

## Channels

- **GitHub Discussions** → category **Announcements** (only the owner opens topics there; anyone can
  comment). Done: `discussions/15`, with the placeholder welcome topic deleted.
- **Community forums** → the long form, as is.
- **X / LinkedIn** → the short form, in a thread: English first, Spanish as the reply.

### Verified contacts (read off DeepSeek's own properties, not from memory)

| channel | address | source |
| --- | --- | --- |
| API / platform, email | `api-service@deepseek.com` | footer of [api-docs.deepseek.com](https://api-docs.deepseek.com/), under *Community → Email* |
| General, email | `service@deepseek.com` | §Contact of DeepSeek's own model repos, e.g. [DeepSeek-V3](https://github.com/deepseek-ai/DeepSeek-V3#9-contact) |
| Discord | https://discord.gg/Tc7c45Zzu5 | API docs footer and the badge on the model repos |
| X | [@deepseek_ai](https://twitter.com/deepseek_ai) | API docs footer and the badge on the model repos |
| Curated list | [awesome-deepseek-integration](https://github.com/deepseek-ai/awesome-deepseek-integration) | linked from the API docs |

There is no separately published developer-relations address: `api-service@deepseek.com` is the API-facing
contact DeepSeek documents, and it is the one that matches what this project asks for. Sending to both
addresses at once is unnecessary; a copy to `service@deepseek.com` is defensible but not required.

**The public path is worth more than the cold email.** That curated list already carries desktop clients
built on the API — Chatbox, Cherry Studio, DeepChat, AingDesk — which is exactly the category R7 Desktop
belongs to, and a merged PR there leaves a permanent trace that an inbox does not. The repo has **no
CONTRIBUTING.md** (verified: 404), so the convention is read off the existing entries: a
`docs/<project>/README.md` plus a row in the **Applications** table with a small logo. Do that first; the
email is for the two platform asks, which are not a listing matter.

### Mail draft — the two platform asks (English)

**To:** `api-service@deepseek.com`

**Subject:** Prefix-cache reporting per endpoint, and a measured case for a compressed output register

**Body:**

Hello,

I maintain R7 Desktop, a small open source desktop app (MIT, BYOK) whose agents run on DeepSeek models. It
was built to test one hypothesis, and it produced a measurement I think is worth thirty seconds of your
time.

The finding: with byte-identical prompt prefixes and the same model, and with provider routing as the only
difference, the share of the prefix served from cache went from 13.8% to 77.5% between two runs, and the
billable count from 1425 to 655. One endpoint reported no cached input at all in four of six turns on an
unchanged prefix; a second one cached for four turns and then stopped. That is why the app pins each model
to the endpoints that report cached input.

Two asks, both small on your side:

1. Publish prefix-cache behaviour as a per-endpoint contract — whether an endpoint caches, and whether it
   reports it. That is the single change that would let a client stop guessing.

2. Consider training the compressed register instead of leaving it to a system prompt. The prompts ask for
   a telegraphic register, and that is a prompt-level approximation with a hard ceiling: it changes the
   visible answer, not the work behind it. The OUT seed measurement is two samples, 134 against 209 and
   256 against 315 completion tokens, and it is reported as inconclusive.

Everything is committed and reproducible with your own key: the recipe is `tools/s19-measure.mjs`, the
numbers and their caveats are in `docs/QUE-ES-R7.md`, and the full note is `docs/PARA-DEEPSEEK.md`, in
[github.com/rgartneraudios/r7signal](https://github.com/rgartneraudios/r7signal).

If the numbers do not reproduce on your side, that is the most useful outcome for me: a counter-example
with numbers attached is worth more than agreement.

Thank you,
R. Gartner (R7Signal)

### What not to do

- Do not send the announcement text as the email. The email has two concrete asks; the announcement is for
  the public channels.
- Do not restate the numbers as a savings percentage. 655 against 1425 is what was measured, once, with
  the caveats above it.
- Do not open the pull request and send the email in the same breath as a campaign. The PR is a listing;
  the email is a platform request. They are different conversations.

## What this text does not claim

- No savings percentage. The only figures are the three rows of the table above, and they are already in
  `docs/QUE-ES-R7.md` with their caveats.
- Not a benchmark: n=1 per arm, one model, one window, a short session — a reproduction recipe.
- The OUT side is **not established**. Two samples point one way; that is all they do.
- No free tier, no hosted tier: BYOK, no proxy, no vendor behind the key.
- No roadmap promise about the register being trained. It is a request to a model provider, not a plan.
