// Query-key factory for the GVerify (KYC/KYB) domain. Plain module (no
// "use client") so server components can import it too — the dashboard page
// prefetches an SME's KYB status under this key
// (lib/server/dashboard-prefetch.ts). hooks/use-gverify.ts re-exports it for
// everything else.
export const gverifyKeys = {
  all: ["gverify"] as const,
  status: () => [...gverifyKeys.all, "status"] as const,
  kybCertificate: () => [...gverifyKeys.all, "kyb-certificate"] as const,
  kybStatus: () => [...gverifyKeys.all, "kyb-status"] as const,
  verificationMode: () => [...gverifyKeys.all, "verification-mode"] as const,
  handoff: () => [...gverifyKeys.all, "handoff"] as const,
};
