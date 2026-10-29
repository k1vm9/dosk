import { defineRailway, project, service } from "railway/iac";

export default defineRailway(() => {
  const botAndPanel = service("Dosk Bot", {
    build: "pnpm run railway:build",
    start: "pnpm run railway:start",
    healthcheck: "/api/healthz",
    healthcheckTimeout: 120,
    replicas: 1,
    env: {
      NODE_ENV: "production",
    },
  });

  return project("Dosk Bot", {
    resources: [botAndPanel],
  });
});
