# r7signal

AI-Friendly Data Layer — Token-optimized post-cutoff data feed for LLMs and AI agents

## Environment

The desktop app is BYOK (bring your own key): each user loads their own OpenRouter key
inside the app, and it is stored in `local_config.json` under the app data folder. No key
ever ships in this repository or in the build.

Development variables live in `.env` (gitignored). Copy the template and fill it in:

```
cp .env.example .env
```

**The `VITE_` rule.** Vite inlines every variable prefixed with `VITE_` into the compiled
bundle, so those values are public by definition — anyone who downloads the build can read
them. Never give a secret the `VITE_` prefix. Supabase's anon key is designed to be public
(protected by row level security); the service role key is not, so it stays unprefixed and
server-side only.

Supabase is optional and outside the critical path: without it the app falls back to the
local prompt and simply skips the cloud features.
