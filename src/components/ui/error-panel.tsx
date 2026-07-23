import { Button } from "./button";

interface ErrorPanelProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorPanel({
  title,
  message,
  actionLabel,
  onAction,
}: ErrorPanelProps) {
  return (
    <div
      className="border-danger/30 bg-danger/5 rounded-2xl border p-5"
      role="alert"
    >
      <p className="text-danger font-semibold">{title}</p>
      <p className="text-muted mt-1">{message}</p>
      {actionLabel && onAction && (
        <Button
          className="mt-4"
          onClick={onAction}
          type="button"
          variant="danger"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
