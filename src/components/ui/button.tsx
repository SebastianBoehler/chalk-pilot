import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "quiet" | "danger";
}

const variants = {
  primary: "bg-primary text-white hover:bg-primary-hover shadow-sm",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-surface-muted",
  quiet: "text-foreground hover:bg-surface-muted",
  danger: "border border-danger/30 text-danger hover:bg-danger/5",
};

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-xl px-5 py-3 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
