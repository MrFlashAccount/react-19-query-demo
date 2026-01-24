import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root";
import { AlertsPage } from "@components/AlertsPage";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/alerts",
  component: AlertsPage,
});
