import { dehydrate, type DehydratedState } from "@tanstack/react-query";

import { gverifyKeys } from "@/hooks/gverify-keys";
import { projectKeys } from "@/hooks/project-keys";
import { GVERIFY_ENDPOINTS, PROJECT_ENDPOINTS } from "@/lib/endpoints";
import { makeQueryClient } from "@/lib/query-client";
import { backendGet } from "@/lib/server/backend-get";
import type { User } from "@/services/authentication.service";
import {
  gverifyKybNotStarted,
  type GVerifyKybStatusResponse,
} from "@/services/gverify.service";
import type { Project } from "@/services/projects.service";

/**
 * React Query state for the /dashboard page, fetched on the server.
 *
 * Why: the SME dashboard cannot render until it knows the SME's projects, and
 * fetched in the browser that was a waterfall — hydrate, then GET /projects,
 * then download the SmeDashboard chunk, then mount it, and only then GET
 * /gverify/kyb/status (useVerificationGate). Measured against the stub API
 * that put the SME's first paint ~830ms behind the investor's, whose
 * dashboard needs no data to render. Fetched here, in parallel, the SME
 * dashboard is in the server-rendered HTML and its chunk is preloaded with
 * the page.
 *
 * Seeds the same keys and shapes the hooks use (useMyProjects,
 * useGVerifyKybStatus), so they start with data and do not refetch until
 * stale. A request that fails is simply left out: the hook fetches it in the
 * browser as before.
 */
export async function dashboardPrefetchState(
  role: User["role"] | undefined,
): Promise<DehydratedState | null> {
  // Investors' dashboard renders without waiting on data (its tranche list
  // fills in); admins never reach /dashboard. Only SMEs block on a fetch.
  if (role !== "SME") return null;

  const [projects, kyb] = await Promise.all([
    backendGet<Project[]>(PROJECT_ENDPOINTS.list),
    backendGet<GVerifyKybStatusResponse>(GVERIFY_ENDPOINTS.kybStatus),
  ]);

  const queryClient = makeQueryClient();
  if (projects.ok) {
    queryClient.setQueryData(projectKeys.mine(), projects.data);
  }
  // Same mapping as useGVerifyKybStatus: 404 means "never started".
  if (kyb.ok) {
    queryClient.setQueryData(gverifyKeys.kybStatus(), kyb.data);
  } else if (kyb.status === 404) {
    queryClient.setQueryData(gverifyKeys.kybStatus(), gverifyKybNotStarted());
  }
  return dehydrate(queryClient);
}
