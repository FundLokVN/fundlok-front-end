"use client";

import { createContext, useContext } from "react";

import type { BlogPostDetail } from "@/services/admin-blog.service";
import {
  useBlogPostEditor,
  type BlogPostEditorState,
} from "./useBlogPostEditor";

const BlogPostEditorContext = createContext<BlogPostEditorState | null>(null);

export function useBlogPostEditorContext(): BlogPostEditorState {
  const value = useContext(BlogPostEditorContext);
  if (!value) {
    throw new Error(
      "useBlogPostEditorContext must be used within BlogPostEditorProvider",
    );
  }
  return value;
}

/**
 * Runs the editor hook once and shares it with the title, toolbar, dialogs
 * and settings panel. Render it with `key={post.id}` so a different post
 * starts from a fresh draft.
 */
export function BlogPostEditorProvider({
  post,
  children,
}: {
  post: BlogPostDetail;
  children: React.ReactNode;
}) {
  const value = useBlogPostEditor(post);
  return (
    <BlogPostEditorContext.Provider value={value}>
      {children}
    </BlogPostEditorContext.Provider>
  );
}
