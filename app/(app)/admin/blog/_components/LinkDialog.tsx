"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSafeHref } from "@/lib/blog/links";
import { useTranslations } from "@/lib/i18n";
import { useBlogPostEditorContext } from "./BlogPostEditorContext";

/** "fundlok.com/x" means https://fundlok.com/x; everything else is as typed. */
export function normalizeHref(raw: string): string {
  const href = raw.trim();
  if (!href) return href;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || /^[/#]/.test(href)) return href;
  return `https://${href}`;
}

// Replaces window.prompt(): the same rules as the backend (http, https,
// mailto, tel, /path, #anchor), checked before anything reaches the post.
export function LinkDialog() {
  const { editor, linkDialogOpen, setLinkDialogOpen } =
    useBlogPostEditorContext();

  return (
    <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
      <DialogContent className="sm:max-w-md">
        {/* Remounted each time it opens, so it starts from the link under the
            cursor instead of whatever was typed last time. */}
        {linkDialogOpen && editor && (
          <LinkForm
            initialHref={(editor.getAttributes("link").href as string) ?? ""}
            initialNewTab={editor.getAttributes("link").target === "_blank"}
            hasLink={editor.isActive("link")}
            onApply={(href, newTab) => {
              editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href, target: newTab ? "_blank" : null })
                .run();
              setLinkDialogOpen(false);
            }}
            onRemove={() => {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              setLinkDialogOpen(false);
            }}
            onCancel={() => setLinkDialogOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LinkForm({
  initialHref,
  initialNewTab,
  hasLink,
  onApply,
  onRemove,
  onCancel,
}: {
  initialHref: string;
  initialNewTab: boolean;
  hasLink: boolean;
  onApply: (href: string, newTab: boolean) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslations();
  const [href, setHref] = useState(initialHref);
  const [newTab, setNewTab] = useState(initialNewTab);
  const [touched, setTouched] = useState(false);
  const normalized = normalizeHref(href);
  const valid = isSafeHref(normalized);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (valid) onApply(normalized, newTab);
      }}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle>{t("admin.blog.link.title")}</DialogTitle>
        <DialogDescription>
          {t("admin.blog.link.description")}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="blog-link-href">{t("admin.blog.link.urlLabel")}</Label>
        <Input
          id="blog-link-href"
          value={href}
          onChange={(event) => setHref(event.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="https://"
          autoFocus
          aria-invalid={touched && !valid}
          aria-describedby="blog-link-hint"
        />
        <p
          id="blog-link-hint"
          className={
            touched && !valid
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {touched && !valid
            ? t("admin.blog.link.invalid")
            : t("admin.blog.link.urlHint")}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="blog-link-new-tab"
          checked={newTab}
          onCheckedChange={(checked) => setNewTab(checked === true)}
        />
        <Label htmlFor="blog-link-new-tab" className="font-normal">
          {t("admin.blog.link.newTab")}
        </Label>
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        {hasLink ? (
          <Button type="button" variant="ghost" onClick={onRemove}>
            {t("admin.blog.link.remove")}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="submit">{t("admin.blog.link.apply")}</Button>
        </div>
      </DialogFooter>
    </form>
  );
}
