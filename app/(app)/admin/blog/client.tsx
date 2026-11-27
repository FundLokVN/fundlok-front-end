"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Newspaper, Plus, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRequireAuth } from "@/hooks/use-authentication";
import { useAdminBlogPosts, useCreateBlogPost } from "@/hooks/use-admin-blog";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage } from "@/lib/api-error-message";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { isAdminRole } from "@/services/authentication.service";
import type {
  BlogPostStatus,
  BlogPostSummary,
  BlogSearchConsoleStatus,
} from "@/services/admin-blog.service";
import { AdminPageLoader } from "../_components/AdminPageLoader";
import { DataTable, type Column } from "../_components/DataTable";
import { TablePager } from "../_components/TablePager";
import { BlogStatusBadge } from "./_components/BlogStatusBadge";

const PAGE_SIZE = 20;

type StatusFilter = "all" | BlogPostStatus;

// Admin > Blog: every post, drafts and published, newest change first. "New
// post" creates a draft straight away and opens it in the editor. Admins only
// — the proxy turns everyone else away, this page redirects as a fallback,
// and the API answers 403.
export default function AdminBlogClient() {
  const { user, isLoading } = useRequireAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && !isAdminRole(user.role)) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user || !isAdminRole(user.role)) {
    return <AdminPageLoader />;
  }

  return <BlogPostsDirectory />;
}

function BlogPostsDirectory() {
  const router = useRouter();
  const { t, locale } = useTranslations();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Debounced, and back to the first page whenever the text changes.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { data, isLoading, isFetching, isError, refetch } = useAdminBlogPosts({
    page,
    page_size: PAGE_SIZE,
    status: status === "all" ? undefined : status,
    search: search || undefined,
  });
  const createPost = useCreateBlogPost();

  const handleCreate = () => {
    createPost.mutate(t("admin.blog.untitled"), {
      onSuccess: (post) => router.push(`/admin/blog/${post.id}`),
      onError: (error) =>
        toast({
          variant: "destructive",
          title: t("admin.blog.createError"),
          description: apiErrorMessage(
            error,
            locale,
            t("admin.blog.toast.error"),
          ),
        }),
    });
  };

  const columns: Column<BlogPostSummary>[] = [
    {
      key: "title",
      header: t("admin.blog.columns.title"),
      render: (post) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-medium text-foreground">{post.title}</span>
          <span className="truncate text-xs text-muted-foreground">
            /blog/{post.slug}
          </span>
        </div>
      ),
      filterValue: (post) => post.title,
    },
    {
      key: "status",
      header: t("admin.blog.columns.status"),
      render: (post) => <BlogStatusBadge status={post.status} />,
      filterValue: (post) => t(`admin.blog.status.${post.status}`),
    },
    {
      key: "updated",
      header: t("admin.blog.columns.updated"),
      render: (post) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatDateTime(post.updated_at, locale)}
        </span>
      ),
      sortValue: (post) => post.updated_at,
    },
    {
      key: "views",
      header: t("admin.blog.columns.views"),
      render: (post) => (
        <span className="tabular-nums">
          {post.view_count == null
            ? "—"
            : new Intl.NumberFormat(locale).format(post.view_count)}
        </span>
      ),
      sortValue: (post) => post.view_count ?? -1,
    },
    {
      key: "clicks",
      header: t("admin.blog.columns.clicks"),
      render: (post) => <SearchFigure value={post.search?.clicks} />,
      sortValue: (post) => post.search?.clicks,
    },
    {
      key: "impressions",
      header: t("admin.blog.columns.impressions"),
      render: (post) => <SearchFigure value={post.search?.impressions} />,
      sortValue: (post) => post.search?.impressions,
    },
    {
      key: "ctr",
      header: t("admin.blog.columns.ctr"),
      render: (post) => (
        <SearchFigure
          value={searchCtr(post)}
          format={{ style: "percent", maximumFractionDigits: 1 }}
        />
      ),
      sortValue: searchCtr,
    },
    {
      key: "position",
      header: t("admin.blog.columns.position"),
      render: (post) => (
        <SearchFigure
          value={post.search?.position}
          format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
        />
      ),
      // Lower ranks higher; posts with no position sort last either way.
      sortValue: (post) => post.search?.position,
    },
    {
      key: "published",
      header: t("admin.blog.columns.published"),
      render: (post) =>
        post.published_at ? (
          <span className="whitespace-nowrap tabular-nums">
            {formatDateTime(post.published_at, locale)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      sortValue: (post) => post.published_at ?? "",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Newspaper className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("admin.blog.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("admin.blog.subtitle")}
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={handleCreate}
          disabled={createPost.isPending}
          className="gap-2 self-start sm:self-auto"
        >
          {createPost.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {t("admin.blog.newPost")}
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as StatusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-full sm:w-44"
              aria-label={t("admin.blog.filter.label")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.blog.filter.all")}</SelectItem>
              <SelectItem value="draft">
                {t("admin.blog.filter.draft")}
              </SelectItem>
              <SelectItem value="published">
                {t("admin.blog.filter.published")}
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="flex min-w-0 items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-initial">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("admin.blog.searchPlaceholder")}
                aria-label={t("admin.blog.searchLabel")}
                className="pl-9"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              aria-label={t("admin.table.refresh")}
              className="h-9 shrink-0 gap-1.5 px-3 text-xs"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
                aria-hidden
              />
              <span className="hidden sm:inline">
                {t("admin.table.refresh")}
              </span>
            </Button>
          </div>
        </div>

        <SearchConsoleNote status={data?.search_console} />

        <DataTable<BlogPostSummary>
          columns={columns}
          rows={data?.items ?? []}
          getRowKey={(post) => post.id}
          isLoading={isLoading}
          isFetching={isFetching}
          emptyMessage={
            isError ? t("admin.blog.loadError") : t("admin.blog.empty")
          }
          onRowClick={(post) => router.push(`/admin/blog/${post.id}`)}
          getRowLabel={(post) =>
            t("admin.blog.openPost").replace("{title}", post.title)
          }
        />

        <TablePager
          page={page}
          pageSize={PAGE_SIZE}
          total={data?.total ?? 0}
          unit={t("admin.blog.unit")}
          isFetching={isFetching}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

// Clicks per impression; none without impressions.
function searchCtr(post: BlogPostSummary): number | undefined {
  const search = post.search;
  return search && search.impressions > 0
    ? search.clicks / search.impressions
    : undefined;
}

function SearchFigure({
  value,
  format,
}: {
  value: number | null | undefined;
  format?: Intl.NumberFormatOptions;
}) {
  const { locale } = useTranslations();
  if (value == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="tabular-nums">
      {new Intl.NumberFormat(locale, format).format(value)}
    </span>
  );
}

// Says where the Google columns come from and how fresh they are, or why
// they are empty.
function SearchConsoleNote({
  status,
}: {
  status: BlogSearchConsoleStatus | undefined;
}) {
  const { t, locale } = useTranslations();
  if (!status) return null;

  let text: string;
  if (!status.configured) {
    text = t("admin.blog.searchConsole.notConfigured");
  } else if (!status.data_through || !status.last_synced_at) {
    text = t("admin.blog.searchConsole.notSynced");
  } else {
    text = `${t("admin.blog.searchConsole.window")
      .replace("{days}", String(status.window_days))
      .replace("{date}", formatDate(status.data_through, locale))} ${t(
      "admin.blog.searchConsole.synced",
    ).replace("{time}", formatDateTime(status.last_synced_at, locale))}`;
  }
  return (
    <p
      data-testid="search-console-note"
      className="border-b px-4 py-2 text-xs text-muted-foreground"
    >
      {text}
    </p>
  );
}
