import { createElement, type HTMLAttributes, type ReactNode } from "react";

export type SurfaceVariant = "card" | "subtle" | "raised";
export type SurfaceElement = "div" | "section" | "article";

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: SurfaceElement;
  variant?: SurfaceVariant;
  interactive?: boolean;
  children: ReactNode;
}

export function Surface({
  as = "div",
  variant = "card",
  interactive = false,
  className = "",
  children,
  ...props
}: SurfaceProps): React.JSX.Element {
  const classes = [
    "ui-surface",
    `ui-surface--${variant}`,
    interactive ? "ui-surface--interactive" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return createElement(as, { className: classes, ...props }, children);
}
