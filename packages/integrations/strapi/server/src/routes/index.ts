import adminAPIRoutes from "./admin";
import contentAPIRoutes from "./content-api";

const routes = {
  "content-api": contentAPIRoutes,
  admin: adminAPIRoutes,
};

export default routes;
