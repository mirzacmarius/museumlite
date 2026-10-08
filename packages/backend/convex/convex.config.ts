import aggregate from "@convex-dev/aggregate/convex.config";
import polar from "@convex-dev/polar/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(polar);
app.use(rateLimiter);
app.use(aggregate, { name: "metrics" });

export default app;
