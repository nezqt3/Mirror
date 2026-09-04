import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "clock"
  | "insights"
  | "character"
  | "settings"
  | "play"
  | "stop"
  | "check"
  | "alert"
  | "chevronDown"
  | "target"
  | "battery"
  | "bolt"
  | "shield"
  | "sparkles"
  | "refresh";

const paths: Record<IconName, React.JSX.Element> = {
  home: <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />,
  clock: <path d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  insights: <path d="M4 20V10m6 10V4m6 16v-7m4 7V8" />,
  character: <path d="M12 3 4.5 7.2v9.6L12 21l7.5-4.2V7.2Zm0 5v8m-3-5.5h6" />,
  settings: <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2-1.2L14.6 3h-4l-.4 2.7a8 8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2 1.2l.4 2.7h4l.4-2.7a8 8 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c0-.4.1-.8.1-1.2Z" />,
  play: <path d="m8 5 11 7-11 7Z" />,
  stop: <path d="M7 7h10v10H7z" />,
  check: <path d="m5 12 4 4L19 6" />,
  alert: <path d="M12 8v5m0 3.5v.1M10.3 4.5 2.8 18a2 2 0 0 0 1.8 3h14.8a2 2 0 0 0 1.8-3L13.7 4.5a2 2 0 0 0-3.4 0Z" />,
  chevronDown: <path d="m7 10 5 5 5-5" />,
  target: <path d="M12 3a9 9 0 1 0 9 9m-4 0a5 5 0 1 1-5-5m0 5 9-9m-5 0h5v5" />,
  battery: <path d="M4 7h14v10H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Zm14 3h3v4h-3M7 10v4m3-4v4" />,
  bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7Z" />,
  shield: <path d="M12 3 5 6v5c0 4.7 2.8 8.2 7 10 4.2-1.8 7-5.3 7-10V6Zm-3 9 2 2 4-5" />,
  sparkles: <path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3Zm6 10 .8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8ZM6 14l.8 2.2L9 17l-2.2.8L6 20l-.8-2.2L3 17l2.2-.8Z" />,
  refresh: <path d="M20 7v5h-5m4.2 3a8 8 0 1 1-1.4-8.7L20 8" />
};

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number | string;
}

export function Icon({ name, size = 18, className = "", ...props }: IconProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`ui-icon ${className}`.trim()}
      aria-hidden={props["aria-label"] ? undefined : true}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
