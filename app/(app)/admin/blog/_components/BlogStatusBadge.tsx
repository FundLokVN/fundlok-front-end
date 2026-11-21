"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/lib/i18n";
import type { BlogPostStatus } from "@/services/admin-blog.service";

// Published reads as live (brand emerald), a draft as quiet.
export function BlogStatusBadge({ status }: { status: BlogPostStatus }) {
  const { t } = useTranslations();
  return status === "published" ? (
    <Badge
      variant="outline"
      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    >
      {t("admin.blog.status.published")}
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      {t("admin.blog.status.draft")}
    </Badge>
  );
}
