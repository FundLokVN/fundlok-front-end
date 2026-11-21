import type { Metadata } from "next";
import { Suspense } from "react";
import AdminTransactionsClient from "./client";
import { AdminPageLoader } from "../_components/AdminPageLoader";
import { getServerTranslations } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("admin.sidebar.transactions"),
  };
}

// The client reads `?tab=` with useSearchParams, which needs a Suspense
// boundary in the App Router.
export default function AdminTransactionsPage() {
  return (
    <Suspense fallback={<AdminPageLoader />}>
      <AdminTransactionsClient />
    </Suspense>
  );
}
