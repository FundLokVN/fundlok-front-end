"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Circle, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSuggestBlogSeo } from "@/hooks/use-admin-blog";
import { useTranslations } from "@/lib/i18n";
import type { ApiError } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBlogPostEditorContext } from "./BlogPostEditorContext";
import { seoSuggestionErrorKey } from "./SeoSuggestions";
import type { AutoSeoFill } from "./useBlogPostEditor";

const STEPS = ["read", "title", "description", "keywords"] as const;
// One request does all four; the steps advance on a timer so the admin sees
// what is happening, and the last one waits for the answer.
const STEP_MS = 2500;

type Phase =
  | { kind: "running" }
  | { kind: "done"; filled: AutoSeoFill[] }
  | { kind: "error"; error: ApiError | null };

// Opened by Publish when the SEO title, meta description or focus keyword is
// empty: Claude reads the draft on screen, the empty fields are filled (the
// admin's own stay), and the admin publishes or goes back to review. Nothing
// is saved until Publish now, which saves and publishes as usual.
export function AutoSeoDialog() {
  const { autoSeoOpen, setAutoSeoOpen } = useBlogPostEditorContext();
  return (
    <Dialog open={autoSeoOpen} onOpenChange={setAutoSeoOpen}>
      <DialogContent className="sm:max-w-md" data-testid="blog-auto-seo">
        {/* Remounted on each open, so every Publish starts a fresh run. */}
        {autoSeoOpen && <AutoSeoRun />}
      </DialogContent>
    </Dialog>
  );
}

function AutoSeoRun() {
  const { post, editor, draft, publish, setAutoSeoOpen, applySeoSuggestions } =
    useBlogPostEditorContext();
  const { t } = useTranslations();
  const suggest = useSuggestBlogSeo();
  const [phase, setPhase] = useState<Phase>({ kind: "running" });
  const [step, setStep] = useState(0);
  const runRef = useRef(0);
  const mounted = useRef(false);

  const run = () => {
    if (!editor) return;
    const id = ++runRef.current;
    setPhase({ kind: "running" });
    setStep(0);
    suggest
      .mutateAsync({
        title: draft.title.trim(),
        locale: post.locale,
        text: editor.getText({ blockSeparator: "\n\n" }),
      })
      .then((suggestions) => {
        if (!mounted.current || runRef.current !== id) return;
        setPhase({ kind: "done", filled: applySeoSuggestions(suggestions) });
      })
      .catch((error: ApiError) => {
        if (!mounted.current || runRef.current !== id) return;
        setPhase({ kind: "error", error });
      });
  };

  // Start once on open; an answer that lands after the dialog closed is
  // dropped. (StrictMode remounts in development: the run survives that.)
  const started = useRef(false);
  useEffect(() => {
    mounted.current = true;
    if (!started.current) {
      started.current = true;
      run();
    }
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase.kind !== "running") return;
    const timer = window.setInterval(
      () => setStep((current) => Math.min(current + 1, STEPS.length - 1)),
      STEP_MS,
    );
    return () => window.clearInterval(timer);
  }, [phase.kind]);

  const close = () => setAutoSeoOpen(false);
  const publishNow = () => {
    setAutoSeoOpen(false);
    void publish({ skipSeo: true });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          {phase.kind === "done"
            ? t("admin.blog.autoSeo.doneTitle")
            : t("admin.blog.autoSeo.title")}
        </DialogTitle>
        <DialogDescription>
          {phase.kind === "done"
            ? phase.filled.length > 0
              ? t("admin.blog.autoSeo.reviewHint")
              : t("admin.blog.autoSeo.nothingFilled")
            : t("admin.blog.autoSeo.description")}
        </DialogDescription>
      </DialogHeader>

      {phase.kind !== "done" && (
        <ol className="flex flex-col gap-2" aria-live="polite">
          {STEPS.map((name, index) => {
            const state =
              phase.kind === "error"
                ? index < step
                  ? "done"
                  : "idle"
                : index < step
                  ? "done"
                  : index === step
                    ? "active"
                    : "idle";
            return (
              <li
                key={name}
                data-state={state}
                className={cn(
                  "flex items-center gap-2 text-sm",
                  state === "idle"
                    ? "text-muted-foreground"
                    : "text-foreground",
                )}
              >
                {state === "done" ? (
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : state === "active" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                {t(`admin.blog.autoSeo.steps.${name}`)}
              </li>
            );
          })}
        </ol>
      )}

      {phase.kind === "error" && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-foreground"
        >
          {t(seoSuggestionErrorKey(phase.error))}
        </p>
      )}

      {phase.kind === "done" && phase.filled.length > 0 && (
        <dl className="flex flex-col gap-2 text-sm">
          {phase.filled.map((fill) => (
            <div
              key={`${fill.field}:${fill.value}`}
              className="rounded-md border p-2.5"
            >
              <dt className="text-xs font-medium text-muted-foreground">
                {t(`admin.blog.autoSeo.fields.${fill.field}`)}
              </dt>
              <dd className="break-words text-foreground">{fill.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <DialogFooter className="gap-2 sm:gap-0">
        {phase.kind === "running" && (
          <Button type="button" variant="ghost" onClick={close}>
            {t("admin.blog.autoSeo.cancel")}
          </Button>
        )}
        {phase.kind === "error" && (
          <>
            <Button type="button" variant="ghost" onClick={close}>
              {t("admin.blog.autoSeo.cancel")}
            </Button>
            {phase.error?.code !== "BLOG_SEO_UNAVAILABLE" && (
              <Button type="button" variant="outline" onClick={run}>
                {t("admin.blog.seoAssistant.retry")}
              </Button>
            )}
            <Button type="button" onClick={publishNow}>
              {t("admin.blog.autoSeo.publishWithout")}
            </Button>
          </>
        )}
        {phase.kind === "done" && (
          <>
            <Button type="button" variant="outline" onClick={close}>
              {t("admin.blog.autoSeo.review")}
            </Button>
            <Button type="button" onClick={publishNow}>
              {t("admin.blog.autoSeo.publishNow")}
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  );
}
