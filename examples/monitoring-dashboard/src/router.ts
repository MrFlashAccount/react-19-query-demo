import { createRouter } from "@tanstack/react-router";
import rootRoute from "./routes/__root";
import serverRoute from "./routes/Server";
import alertsRoute from "./routes/Alerts";

const routeTree = rootRoute.addChildren([serverRoute, alertsRoute]);
const normalizedBasePath = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL.slice(0, -1)
  : import.meta.env.BASE_URL;
const basepath = normalizedBasePath.length === 0 ? "/" : normalizedBasePath;

export const router = createRouter({
  routeTree,
  basepath,
  context: { hello: "world" },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
