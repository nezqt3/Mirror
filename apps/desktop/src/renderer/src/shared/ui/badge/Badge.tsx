import type { HTMLAttributes, ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
}

export function Badge({
  tone = "neutral",
  dot = false,
  className = "",
  children,
  ...props
}: BadgeProps): React.JSX.Element {
  return (
    <span className={`ui-badge ui-badge--${tone} ${className}`.trim()} {...props}>
      {dot ? <span className="ui-badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
