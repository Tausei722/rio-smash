import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Send,
  Mic,
  MicOff,
  Lock,
  Shield,
  User,
  Settings,
  Menu,
  X,
  Swords,
  BookOpen,
  BookText,
  Bot,
  Zap,
  Star,
  Volume2,
  VolumeX,
  Trophy,
  Handshake,
  Scissors,
  Gamepad2,
  Check,
  CircleCheck,
  Square,
  SquareCheck,
  Users,
  Speech,
  LogOut,
  Trash2,
  Play,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  type LucideProps,
} from 'lucide-react-native';
import { ICON, type IconSize } from '../theme/icon';

// name → Lucide コンポーネント。増やすときはここに1行足すだけ。
// 仕様: docs/spec-icon-system.md
const MAP = {
  back: ArrowLeft,
  next: ArrowRight,
  send: Send,
  caretDown: ChevronDown,
  caretLeft: ChevronLeft,
  caretRight: ChevronRight,
  mic: Mic,
  micOff: MicOff,
  lock: Lock,
  admin: Shield,
  profile: User,
  settings: Settings,
  menu: Menu,
  close: X,
  battle: Swords,
  words: BookOpen,
  book: BookText,
  ai: Bot,
  power: Zap,
  premium: Star,
  sound: Volume2,
  soundOff: VolumeX,
  win: Trophy,
  draw: Handshake,
  trim: Scissors,
  replay: Gamepad2,
  play: Play,
  stop: Square,
  check: Check,
  checkCircle: CircleCheck,
  checkboxOn: SquareCheck,
  checkboxOff: Square,
  family: Users,
  speak: Speech,
  logout: LogOut,
  deleteAccount: Trash2,
} as const;

export type IconName = keyof typeof MAP;

type Props = {
  name: IconName;
  size?: IconSize | number;
  color?: string;
  fill?: string;
  accessibilityLabel?: string;
} & Omit<LucideProps, 'size' | 'color'>;

export function Icon({
  name,
  size = 'lg',
  color = '#111',
  accessibilityLabel,
  ...rest
}: Props) {
  const Cmp = MAP[name];
  const px = typeof size === 'number' ? size : ICON.size[size];
  return (
    <Cmp
      size={px}
      color={color}
      strokeWidth={ICON.stroke}
      accessibilityLabel={accessibilityLabel}
      {...rest}
    />
  );
}
