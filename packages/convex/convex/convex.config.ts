import { defineApp } from "convex/server";
import creem from "@mmailaender/convex-creem/convex.config";

const app = defineApp();
app.use(creem);

export default app;
