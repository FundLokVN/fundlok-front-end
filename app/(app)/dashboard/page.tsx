import { HydrationBoundary } from "@tanstack/react-query";
import { headers } from "next/headers";

import { dashboardPrefetchState } from "@/lib/server/dashboard-prefetch";
import { SESSION_USER_HEADER, decodeSessionUser } from "@/lib/session-user";
import { DashboardView } from "./_components/DashboardView";

/**
 * Server half of /dashboard: fetches what the role's dashboard blocks on
 * (an SME's projects and KYB status, in parallel) before rendering, so the
 * dashboard arrives in the HTML instead of after a chain of browser requests.
 * See lib/server/dashboard-prefetch.ts for the measurements behind it.
 *
 * The layout and its loading.tsx stream first, so the sidebar and header do not
 * wait on this.
 */
export default async function DashboardPage() {
  // The user proxy.ts already resolved for this request — no extra /users/me.
  const sessionUser = decodeSessionUser(
    (await headers()).get(SESSION_USER_HEADER),
  );
  const state = await dashboardPrefetchState(sessionUser?.role);

  return state ? (
    <HydrationBoundary state={state}>
      <DashboardView />
    </HydrationBoundary>
  ) : (
    <DashboardView />
  );
}
