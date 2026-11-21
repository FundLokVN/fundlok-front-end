import type { Metadata } from "next";
import AdminBlogEditorClient from "./client";
import { getServerTranslations } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("admin.sidebar.blog"),
  };
}

// One post in the editor, at /admin/blog/<post id>.
export default async function AdminBlogEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminBlogEditorClient postId={id} />;
}
