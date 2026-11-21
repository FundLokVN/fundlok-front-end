import type { TocEntry } from "@/lib/blog/render";
import { cn } from "@/lib/utils";

/**
 * Jump links to the post's H2/H3 headings. The ids come from the same walk
 * of the document that gave the headings theirs (lib/blog/render.tsx), and
 * anchored headings listed like this are what Google can show as "jump to"
 * links under the result.
 */
export function TableOfContents({
  entries,
  title,
}: {
  entries: TocEntry[];
  title: string;
}) {
  return (
    <nav
      aria-labelledby="blog-toc-title"
      className="rounded-xl border bg-card p-5"
      data-testid="blog-toc"
    >
      <p
        id="blog-toc-title"
        className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {title}
      </p>
      <ol className="mt-3 space-y-2 text-sm">
        {entries.map((entry) => (
          <li key={entry.id} className={cn(entry.level === 3 && "pl-4")}>
            <a
              href={`#${entry.id}`}
              className="text-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
