// Query-key factory for the projects domain. Plain module (no "use client") so
// server components can import it too — the dashboard page prefetches the
// SME's projects under this key (lib/server/dashboard-prefetch.ts).
// hooks/use-projects.ts re-exports it for everything else.
export const projectKeys = {
  all: ["projects"] as const,
  mine: () => [...projectKeys.all, "mine"] as const,
  public: () => [...projectKeys.all, "public"] as const,
};
