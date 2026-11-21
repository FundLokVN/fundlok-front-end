"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAdminBlogPost } from "@/hooks/use-admin-blog";
import { useRequireAuth } from "@/hooks/use-authentication";
import { useTranslations } from "@/lib/i18n";
import { isAdminRole } from "@/services/authentication.service";
import { AdminPageLoader } from "../../_components/AdminPageLoader";
import { BlogPostEditor } from "../_components/BlogPostEditor";

// Admins only, like the rest of /admin: the proxy turns everyone else away,
// this redirects as a fallback and the API answers 403.
export default function AdminBlogEditorClient({ postId }: { postId: string }) {
  const { user, isLoading } = useRequireAuth();
  const router = useRouter();
  const isAdmin = !!user && isAdminRole(user.role);

  useEffect(() => {
    if (!isLoading && user && !isAdminRole(user.role)) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  if (isLoading || !isAdmin) return <AdminPageLoader />;
  return <PostLoader postId={postId} />;
}

function PostLoader({ postId }: { postId: string }) {
  const { t } = useTranslations();
  const { data: post, isLoading, error } = useAdminBlogPost(postId);

  if (isLoading) return <AdminPageLoader />;
  if (!post) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border bg-card p-6">
        <p className="text-sm text-foreground">
          {error?.status === 404 || error?.status === 422
            ? t("admin.blog.editor.notFound")
            : t("admin.blog.editor.loadError")}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/blog">{t("admin.blog.editor.back")}</Link>
        </Button>
      </div>
    );
  }
  return <BlogPostEditor post={post} />;
}
