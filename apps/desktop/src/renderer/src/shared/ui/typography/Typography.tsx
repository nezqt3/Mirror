import { createElement, type HTMLAttributes, type ReactNode } from "react";

export type HeadingLevel = 1 | 2 | 3;
export type HeadingSize = "display" | "title" | "section";

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel;
  size?: HeadingSize;
  children: ReactNode;
}

export function Heading({
  level = 1,
  size = "display",
  className = "",
  children,
  ...props
}: HeadingProps): React.JSX.Element {
  return createElement(
    `h${level}`,
    { className: `ui-heading ui-heading--${size} ${className}`.trim(), ...props },
    children
  );
}

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: "p" | "span";
  tone?: "primary" | "secondary" | "muted";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export function Text({
  as = "p",
  tone = "secondary",
  size = "md",
  className = "",
  children,
  ...props
}: TextProps): React.JSX.Element {
  return createElement(
    as,
    { className: `ui-text ui-text--${tone} ui-text--${size} ${className}`.trim(), ...props },
    children
  );
}

export interface EyebrowProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

export function Eyebrow({ className = "", children, ...props }: EyebrowProps): React.JSX.Element {
  return (
    <p className={`ui-eyebrow ${className}`.trim()} {...props}>
      {children}
    </p>
  );
}
