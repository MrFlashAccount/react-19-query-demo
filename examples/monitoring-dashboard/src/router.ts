import { createRouter } from "@tanstack/react-router";
import rootRoute from "./routes/__root";
import serverRoute from "./routes/Server";
import alertsRoute from "./routes/Alerts";

const routeTree = rootRoute.addChildren([serverRoute, alertsRoute]);

export const router = createRouter({
  routeTree,
  context: { hello: "world" },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
