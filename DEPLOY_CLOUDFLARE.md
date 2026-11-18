# Cloudflare deployment handoff (owner-run)

No deployment was performed. This repository contains no Cloudflare credentials, domains, routes, databases, or shared bindings.

## GitHub → Cloudflare Workers Builds

In **Cloudflare Dashboard → Workers & Pages → Create application → Import a repository**:

1. Select `ritwikntrehan/Factory-Bottleneck-Experimenter`.
2. Production branch: `main`.
3. Root directory: `/`.
4. Build command: `npm ci && npm run build`.
5. Deploy command: `npm run deploy`.
6. Node.js: `22.12` or newer.
7. Worker name: `factory-bottleneck-experimenter` (or another unique, unused name).

The committed `wrangler.jsonc` is authoritative. It points to `src/cloudflare/index.ts`, uploads `dist/web` with Workers Static Assets, routes `/api/*` through the Worker, and enables observability. No environment variables, secrets, D1, KV, R2, AI, custom route, or existing sibling binding is required. The browser Web Worker runs simulation; the Cloudflare Worker only hosts the app and health endpoint.

## Local verification before owner deployment

```bash
npm ci
npm run check
npm run demo
```

## Preview verification

After the owner initiates deployment, use the printed `workers.dev` URL:

```bash
curl -fsS https://factory-bottleneck-experimenter.YOUR-SUBDOMAIN.workers.dev/api/v1/health
```

Then verify in a browser:

1. The six-station synthetic preset is selected and visibly labeled synthetic.
2. A 100-replication batch reports progress without freezing the editor.
3. Repeating the unchanged batch produces identical distributions and paired effects.
4. Adding a forming machine yields far less than improving coating reliability.
5. Editing demand or margin changes ranking/economics immediately without rerunning physics.
6. JSON import/export, scenario CSV, and the full HTML report download.
7. The HTML report prints completely to PDF and includes model, scenarios, seeds, assumptions, results, and economics.
8. Mobile layout remains usable and invalid imported JSON is rejected visibly.

## Rollback

List deployments and restore the last known-good version:

```bash
npx wrangler deployments list
npx wrangler rollback <DEPLOYMENT_ID>
```

If an automatic GitHub build is bad, disable/stop further builds in the Cloudflare dashboard, roll back, and revert the offending Git commit. There is no persistent data or schema to migrate or restore. Do not reuse the Worker names, routes, bindings, or domains of `Interesting` or `federated-corridor-kernel`.
