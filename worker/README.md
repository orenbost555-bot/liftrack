# LIFTRACK reminders Worker

A single-file Cloudflare Worker (no dependencies) that sends Web Push reminders.
It implements VAPID (ES256 JWT) and `aes128gcm` payload encryption with WebCrypto only.

Endpoints: `POST /sync` (replace a device's schedule), `POST /nudge` (set/clear the "back to your workout" nudge), `POST /unsubscribe`, `POST /test`.
A cron trigger (`*/5 * * * *`) sends everything that is due.

## Setup (free tier)
1. Create a Worker and paste `worker.js` (remove the `export` keywords, or use a bundler).
2. Create a KV namespace and bind it as `SUBS`.
3. Add variables: `VAPID_PUBLIC_KEY` (text), `VAPID_SUBJECT` (`mailto:you@example.com`), `VAPID_PRIVATE_JWK` (**secret**).
4. Add a cron trigger `*/5 * * * *`.
5. Put the Worker URL and the public key in `js/config.js`.

Generate your own VAPID key pair; never commit the private key (`SECRETS.txt` is git-ignored).

## Tests
`node --test worker/` runs the encryption round-trip and scheduling tests.
