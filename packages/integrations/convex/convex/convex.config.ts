import { defineApp } from "convex/server";
import creem from "@creem_io/convex/convex.config";

const app = defineApp();
app.use(creem);

export default app;
