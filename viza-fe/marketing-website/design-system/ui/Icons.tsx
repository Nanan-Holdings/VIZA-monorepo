import type { SVGProps } from "react";

/** Line icons drawn on a 24px grid, stroke follows currentColor. Decorative unless given a title by the caller. */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const ChevronRight = (p: IconProps) => <Svg strokeWidth={2.5} {...p}><polyline points="9 18 15 12 9 6" /></Svg>;
export const ChevronDown = (p: IconProps) => <Svg strokeWidth={2.5} {...p}><polyline points="6 9 12 15 18 9" /></Svg>;
export const ArrowRight = (p: IconProps) => <Svg {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Svg>;
export const ArrowLeft = (p: IconProps) => <Svg {...p}><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></Svg>;
export const ArrowDown = (p: IconProps) => <Svg {...p}><path d="M12 5v14" /><path d="m18 13-6 6-6-6" /></Svg>;
export const ArrowUp = (p: IconProps) => <Svg {...p}><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></Svg>;
export const Plus = (p: IconProps) => <Svg {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>;
export const Minus = (p: IconProps) => <Svg {...p}><path d="M5 12h14" /></Svg>;
export const Check = (p: IconProps) => <Svg strokeWidth={2.5} {...p}><polyline points="20 6 9 17 4 12" /></Svg>;
export const Phone = (p: IconProps) => <Svg {...p}><path d="M3 5a2 2 0 0 1 2-2h3l2 5-2 1a12 12 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A18 18 0 0 1 3 5z" /></Svg>;
export const Mail = (p: IconProps) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></Svg>;
export const Pin = (p: IconProps) => <Svg {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></Svg>;
export const Chat = (p: IconProps) => <Svg {...p}><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" /></Svg>;
export const Globe = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15 15 0 0 1 0 20" /><path d="M12 2a15 15 0 0 0 0 20" /></Svg>;
export const Search = (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
export const User = (p: IconProps) => <Svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Svg>;
export const Shield = (p: IconProps) => <Svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></Svg>;
export const Clock = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Svg>;
export const Doc = (p: IconProps) => <Svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M8 13h8" /><path d="M8 17h5" /></Svg>;
export const Building = (p: IconProps) => <Svg {...p}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></Svg>;
export const Languages = (p: IconProps) => <Svg {...p}><path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" /></Svg>;
export const Tag = (p: IconProps) => <Svg {...p}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" /><circle cx="7" cy="7" r="1.5" /></Svg>;
export const Compass = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="10" /><polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9 16.2 7.8" /></Svg>;
export const Menu = (p: IconProps) => <Svg {...p}><path d="M4 8h16" /><path d="M8 16h12" /></Svg>;
export const Close = (p: IconProps) => <Svg {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Svg>;
export const Grid = (p: IconProps) => <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></Svg>;
export const MapIcon = (p: IconProps) => <Svg {...p}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></Svg>;
export const Sort = (p: IconProps) => <Svg {...p}><path d="M3 6h18M6 12h12M10 18h4" /></Svg>;
export const Bolt = (p: IconProps) => <Svg {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></Svg>;
export const Calendar = (p: IconProps) => <Svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></Svg>;
export const Info = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></Svg>;
