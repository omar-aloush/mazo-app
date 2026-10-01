import React from 'react';
import {
  Target,
  MessageCircle,
  ClipboardList,
  Sparkles,
  Sun,
  Heart,
  Mountain,
  Clock,
  Flame,
  Star,
  Battery,
  Shield,
  Sprout,
  Lightbulb,
  Dumbbell,
  PersonStanding,
  TrendingUp,
  Palette,
  Coins,
  BookOpen,
  Inbox,
  Calendar,
  Scale,
  Sunrise,
  Building2,
  Brain,
  Zap,
  Trophy,
  Feather,
  Handshake,
  Rocket,
  Award,
  Gem,
  Drama,
  Eye,
  Compass,
  GraduationCap,
  type LucideIcon,
} from 'lucide-react-native';

const ICON_MAP: Record<string, LucideIcon> = {
  target: Target,
  'message-circle': MessageCircle,
  'clipboard-list': ClipboardList,
  sparkles: Sparkles,
  sun: Sun,
  heart: Heart,
  mountain: Mountain,
  clock: Clock,
  flame: Flame,
  star: Star,
  battery: Battery,
  shield: Shield,
  sprout: Sprout,
  lightbulb: Lightbulb,
  dumbbell: Dumbbell,
  'person-standing': PersonStanding,
  'trending-up': TrendingUp,
  palette: Palette,
  coins: Coins,
  'book-open': BookOpen,
  inbox: Inbox,
  calendar: Calendar,
  scale: Scale,
  sunrise: Sunrise,
  'building-2': Building2,
  brain: Brain,
  zap: Zap,
  trophy: Trophy,
  butterfly: Feather,
  handshake: Handshake,
  rocket: Rocket,
  feather: Feather,
  award: Award,
  gem: Gem,
  drama: Drama,
  eye: Eye,
  compass: Compass,
  'graduation-cap': GraduationCap,
};

interface IconRendererProps {
  name: string;
  size?: number;
  color?: string;
}

export const IconRenderer: React.FC<IconRendererProps> = ({ name, size = 20, color = '#6366F1' }) => {
  const IconComponent = ICON_MAP[name];
  if (!IconComponent) {
    return <Sparkles size={size} color={color} />;
  }
  return <IconComponent size={size} color={color} />;
};

export const getIconComponent = (name: string): LucideIcon => {
  return ICON_MAP[name] || Sparkles;
};

export default IconRenderer;
