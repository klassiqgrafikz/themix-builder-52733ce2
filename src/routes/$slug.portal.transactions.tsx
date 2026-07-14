import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/$slug/portal/transactions")({
  component: () => <Outlet />,
});
