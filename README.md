# Orcha Slack Agent Template

A production-ready public GitHub template for building a Slack AI teammate with
[OrchaJS](https://github.com/Amarsia/orcha), Slack Bolt Socket Mode, and
Next.js 16.4.3.

It includes a polished public dashboard, a visitor-isolated local test chat,
durable Slack thread sessions, responsive themes, environment validation, and a
single-container production runtime for both Next.js and the Slack worker.

## Included

- Slack app mentions and direct messages over Socket Mode
- Durable Orcha sessions mapped to each Slack channel thread or DM
- Shared server-side assistant for Slack and the browser test chat
- Safe Slack message splitting and user-friendly failures
- Bot profile, capabilities, example commands, setup status, and recent sessions
- Light, dark, and system themes with responsive, accessible UI
- Signed `HttpOnly` visitor cookies and strict session ownership checks
- Loading, empty, streaming, and error states
- Multi-process Docker orchestration with clean signal forwarding
- Slack app manifest and typed product configuration

## Prerequisites

- Node.js 20.9 or newer (Node.js 22 recommended)
- An OpenAI API key
- A Slack workspace where you can install apps

## 1. Create the Slack app

1. Open [Slack API apps](https://api.slack.com/apps) and choose **Create New App**.
2. Choose **From an app manifest**.
3. Paste `slack-app-manifest.yml` and create the app.
4. Under **Basic Information → App-Level Tokens**, generate a token with the
   `connections:write` scope. This is the `xapp-` token.
5. Install the app to the workspace and copy the bot `xoxb-` token.
6. Invite the bot to any channel where it should answer mentions.

The manifest subscribes to `app_mention` and `message.im`, enables Socket Mode,
and requests only `app_mentions:read`, `chat:write`, and `im:history`.

## 2. Configure and run

```bash
npm install
cp .env.example .env.local
```

Fill in:

```dotenv
OPENAI_API_KEY=...
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
VISITOR_COOKIE_SECRET=a-random-value-with-at-least-32-characters
```

Start Next.js and the Bolt worker together:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then mention the bot in an
invited Slack channel or send it a direct message.

## Customize

Product-facing identity, avatar, welcome copy, capabilities, and examples:

```text
config/bot.ts
public/bot-avatar.svg
```

Agent model and behavior:

```text
orcha/assistant/index.json
orcha/assistant/instructions.md
```

Purpose-based visual tokens and responsive styles:

```text
app/globals.css
```

Keep the display name in `config/bot.ts`, `orcha/assistant/index.json`, and
`slack-app-manifest.yml` aligned when renaming the bot.

## Session model

Slack and web sessions share the same Orcha assistant and durable JSONL store,
but their identities are separated:

- Channel mentions map to `workspace + channel + thread`.
- DMs map to `workspace + DM channel` and continue as one durable conversation.
- Browser sessions carry `surface=web` and a signed visitor identifier.
- Every browser list, read, and resume operation checks that identifier.

The Slack worker serializes messages per conversation key to avoid races when
multiple events arrive together. It never sends tokens, hidden metadata, or
internal session IDs to Slack.

## Scripts

```text
npm run dev              Next.js + watched Slack worker
npm run build            Next.js standalone output + Slack worker bundle
npm start                Production process orchestrator
npm run dev:web          Next.js only
npm run dev:slack        Slack worker only
npm run agent:playground Orcha agent playground
npm run agent:test       Orcha agent tests
```

## Docker

```bash
docker build -t orcha-slack-agent .
docker run \
  --env-file .env.local \
  -p 3000:3000 \
  -v orcha-slack-sessions:/data/sessions \
  orcha-slack-agent
```

The container runs one Next.js process and one Slack Socket Mode worker. The
orchestrator forwards termination signals and stops the container if either
process exits. Mount `/data/sessions` for durable history.

This local JSONL storage model is intended for one long-running container. For
horizontal scaling, replace it with a shared durable Orcha storage adapter and
coordinate Socket Mode worker ownership.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | Server-side model provider credential |
| `SLACK_BOT_TOKEN` | Yes | Slack bot OAuth token (`xoxb-`) |
| `SLACK_APP_TOKEN` | Yes | Socket Mode app token (`xapp-`) |
| `VISITOR_COOKIE_SECRET` | Production | Signs browser visitor identities |
| `SLACK_WORKSPACE_NAME` | No | Public workspace label in the dashboard |
| `SLACK_WORKSPACE_URL` | No | Optional public workspace URL |
| `ORCHA_SESSION_DIRECTORY` | No | Durable session directory |
| `AMARSIA_PROJECT_KEY` | No | Agent sync and privacy-safe analytics |
| `AMARSIA_API_URL` | No | Amarsia API endpoint |

Secrets are read only by server code. The status API returns booleans and
optional public workspace labels, never credential values.

## Project structure

```text
app/                     Next.js UI and server API routes
components/              Dashboard, local chat, and theme controls
config/bot.ts            Typed public bot configuration
lib/                     Shared assistant, env, session, and visitor logic
slack/worker.ts          Slack Bolt Socket Mode worker
scripts/orchestrate.mjs  Development and production process supervisor
orcha/                   Agent registry, model manifest, and instructions
.amarsia/template.json   Template catalog metadata
```

## Security notes

- Use a unique, random `VISITOR_COOKIE_SECRET` in every production deployment.
- Keep `.env*` files out of source control; `.env.example` contains no secrets.
- Rotate Slack and provider tokens immediately if they are exposed.
- Review Slack scopes before adding capabilities.
- Treat this dashboard as public. Do not add private workspace data to
  `config/bot.ts` or public environment labels.

## License

MIT
