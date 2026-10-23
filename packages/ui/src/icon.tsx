import {
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  Copy,
  Download,
  ExternalLink,
  Flag,
  Gamepad2,
  House,
  Info,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  type LucideIcon,
  Menu,
  Mic,
  Music,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Pin,
  Plus,
  Reply,
  RotateCw,
  Search,
  Share2,
  Sparkles,
  SunMoon,
  Ticket,
  Trash2,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react';

// Lucide (ISC licence): one consistent stroke set, the one most product teams use, so a new
// icon never has to be drawn by hand. Names here are ours, so screens never import Lucide.
const icons = {
  chevron: ChevronDown,
  check: Check,
  close: X,
  plus: Plus,
  pin: Pin,
  attach: Paperclip,
  sidebar: PanelLeft,
  panelClose: PanelLeftClose,
  panelOpen: PanelLeftOpen,
  theme: SunMoon,
  signout: LogOut,
  overview: LayoutDashboard,
  projects: LayoutGrid,
  team: Users,
  film: Clapperboard,
  music: Music,
  books: BookOpen,
  podcasts: Mic,
  games: Gamepad2,
  shows: Ticket,
  search: Search,
  arrowUp: ArrowUp,
  sparkles: Sparkles,
  flag: Flag,
  trash: Trash2,
  help: CircleHelp,
  menu: Menu,
  back: ArrowLeft,
  home: House,
  copy: Copy,
  export: Download,
  share: Share2,
  details: Info,
  external: ExternalLink,
  reply: Reply,
  retry: RotateCw,
  warning: TriangleAlert,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

/**
 * A stroke icon at 18px by default. Decorative: the label next to it carries the meaning.
 * `filled` fills the shape, for a state such as a pinned pin.
 */
export function Icon({
  name,
  className,
  filled,
}: {
  name: IconName;
  className?: string;
  filled?: boolean;
}) {
  const Glyph = icons[name];
  return (
    <Glyph
      aria-hidden
      strokeWidth={1.75}
      fill={filled ? 'currentColor' : 'none'}
      className={`size-[18px] shrink-0 ${className ?? ''}`}
    />
  );
}
