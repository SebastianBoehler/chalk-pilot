interface StatusPillProps {
  label: string;
  status: "ready" | "waiting" | "error";
}

const colors = {
  ready: "bg-success",
  waiting: "bg-muted",
  error: "bg-danger",
};

export function StatusPill({ label, status }: StatusPillProps) {
  return (
    <span className="border-border bg-surface inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold">
      <span className={`size-2 rounded-full ${colors[status]}`} />
      {label}
    </span>
  );
}
