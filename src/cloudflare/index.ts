import { Hono } from "hono";

interface Env { ASSETS: Fetcher }
const app = new Hono<{ Bindings: Env }>();
app.get("/api/v1/health", (c) => c.json({ ok: true, service: "factory-bottleneck-experimenter", version: "1.0.0", simulation: "browser-web-worker" }));
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));
export default app;
