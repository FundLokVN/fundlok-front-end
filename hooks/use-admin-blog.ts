"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import type { ApiError } from "@/lib/types";
import {
  adminBlogService,
  type BlogKeywordUsage,
  type BlogMediaConfirm,
  type BlogPostDetail,
  type BlogPostList,
  type BlogPostListParams,
  type BlogPostUpdatePayload,
} from "@/services/admin-blog.service";

// Posts are shared by every admin, so the keys carry no admin id.
export const adminBlogKeys = {
  all: ["admin-blog"] as const,
  lists: () => [...adminBlogKeys.all, "list"] as const,
  list: (params: BlogPostListParams) =>
    [...adminBlogKeys.lists(), params] as const,
  detail: (id: string) => [...adminBlogKeys.all, "detail", id] as const,
  keywordUsage: (keyword: string, excludeId: string) =>
    [...adminBlogKeys.all, "keyword-usage", keyword, excludeId] as const,
};

export function useBlogKeywordUsage(keyword: string, excludeId: string) {
  const trimmed = keyword.trim();
  return useQuery<BlogKeywordUsage, ApiError>({
    queryKey: adminBlogKeys.keywordUsage(
      trimmed.toLocaleLowerCase("vi"),
      excludeId,
    ),
    queryFn: () => adminBlogService.keywordUsage(trimmed, excludeId),
    enabled: trimmed.length > 0,
    staleTime: 30 * 1000,
    retry: false,
  });
}

/** A write answered with the post: cache it and refresh every list. */
function storePost(queryClient: QueryClient, post: BlogPostDetail) {
  queryClient.setQueryData(adminBlogKeys.detail(post.id), post);
  void queryClient.invalidateQueries({ queryKey: adminBlogKeys.lists() });
}

export function useAdminBlogPosts(params: BlogPostListParams) {
  return useQuery<BlogPostList, ApiError>({
    queryKey: adminBlogKeys.list(params),
    queryFn: () => adminBlogService.list(params),
    // Paging and filtering keep the old rows on screen until the new ones land.
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    retry: false,
  });
}

export function useAdminBlogPost(id: string) {
  return useQuery<BlogPostDetail, ApiError>({
    queryKey: adminBlogKeys.detail(id),
    queryFn: () => adminBlogService.get(id),
    // The editor keeps its own draft once loaded (local form state), so a
    // background refetch would only bump the version under it and turn the
    // next save into a self-inflicted 409. Writes update the cache instead.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: !!id,
  });
}

export function useCreateBlogPost() {
  const queryClient = useQueryClient();
  return useMutation<BlogPostDetail, ApiError, string>({
    mutationFn: (title) => adminBlogService.create(title),
    onSuccess: (post) => storePost(queryClient, post),
  });
}

export function useUpdateBlogPost(id: string) {
  const queryClient = useQueryClient();
  return useMutation<BlogPostDetail, ApiError, BlogPostUpdatePayload>({
    mutationFn: (payload) => adminBlogService.update(id, payload),
    onSuccess: (post) => storePost(queryClient, post),
  });
}

export function usePublishBlogPost(id: string) {
  const queryClient = useQueryClient();
  return useMutation<BlogPostDetail, ApiError, number>({
    mutationFn: (version) => adminBlogService.publish(id, version),
    onSuccess: (post) => storePost(queryClient, post),
  });
}

export function useUnpublishBlogPost(id: string) {
  const queryClient = useQueryClient();
  return useMutation<BlogPostDetail, ApiError, number>({
    mutationFn: (version) => adminBlogService.unpublish(id, version),
    onSuccess: (post) => storePost(queryClient, post),
  });
}

export function useDeleteBlogPost(id: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: () => adminBlogService.remove(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: adminBlogKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: adminBlogKeys.lists() });
    },
  });
}

export interface BlogImageUpload {
  file: File;
  onProgress?: (percent: number) => void;
}

/** Uploads one image (cover or inline); resolves with its public URL. */
export function useUploadBlogImage() {
  return useMutation<BlogMediaConfirm, ApiError, BlogImageUpload>({
    mutationFn: ({ file, onProgress }) =>
      adminBlogService.uploadImage(file, onProgress),
  });
}
