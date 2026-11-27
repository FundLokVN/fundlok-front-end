import { Button } from "@/components/ui/button";
import { CONTROL_HOVER } from "@/lib/ui-tokens";

export function ReadError({
  message,
  retryLabel,
  isFetching,
  refetch,
}: {
  message: string;
  retryLabel: string;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <p role="alert" className="text-sm text-destructive">
        {message}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={CONTROL_HOVER}
        disabled={isFetching}
        onClick={() => void refetch()}
      >
        {retryLabel}
      </Button>
    </div>
  );
}
