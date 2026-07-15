import type { ReactNode } from "react";

export type IconName =
  | "dashboard" | "report" | "swap" | "box" | "tag" | "plus" | "up" | "down"
  | "alert" | "edit" | "trash" | "x" | "chevL" | "chevR" | "dl" | "ul"
  | "search" | "check" | "logout";

const PATHS: Record<IconName, ReactNode> = {
  dashboard: <g><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></g>,
  report: <g><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></g>,
  swap: <g><path d="M7 4 L3 8 L7 12" /><path d="M3 8 H21" /><path d="M17 20 L21 16 L17 12" /><path d="M21 16 H3" /></g>,
  box: <g><path d="M21 8 L12 3 L3 8 v8 l9 5 9-5z" /><path d="M3 8 l9 5 9-5" /><path d="M12 13 v8" /></g>,
  tag: <g><path d="M20 12 l-8 8 -9-9 V3 h8z" /><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" /></g>,
  plus: <g><path d="M12 5v14M5 12h14" /></g>,
  up: <g><path d="M3 17 L9 11 L13 15 L21 7" /><path d="M15 7h6v6" /></g>,
  down: <g><path d="M3 7 L9 13 L13 9 L21 17" /><path d="M15 17h6v-6" /></g>,
  alert: <g><path d="M12 3 L22 20 H2 Z" /><path d="M12 9v5" /><circle cx="12" cy="17.5" r="0.9" fill="currentColor" stroke="none" /></g>,
  edit: <g><path d="M12 20h9" /><path d="M16.5 3.5 a2.1 2.1 0 0 1 3 3 L7 19 l-4 1 1-4z" /></g>,
  trash: <g><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /><path d="M10 11v6M14 11v6" /></g>,
  x: <g><path d="M18 6 L6 18 M6 6 l12 12" /></g>,
  chevL: <g><path d="M15 6 l-6 6 6 6" /></g>,
  chevR: <g><path d="M9 6 l6 6 -6 6" /></g>,
  dl: <g><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 21h16" /></g>,
  ul: <g><path d="M12 21V9" /><path d="M7 14l5-5 5 5" /><path d="M4 3h16" /></g>,
  search: <g><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></g>,
  check: <g><path d="M5 12l4 4 10-10" /></g>,
  logout: <g><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></g>,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
