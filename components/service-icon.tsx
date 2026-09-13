import {
  Sofa,
  Trash2,
  WashingMachine,
  Tv,
  SprayCan,
  Construction,
  Lightbulb,
  PawPrint,
  Tent,
  CircleHelp,
  Bug,
  Accessibility,
  TriangleAlert,
  CircleParking,
  HardHat,
  Bike,
  Container,
  BusFront,
  TrafficCone,
  Droplets,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  Sofa,
  Trash2,
  WashingMachine,
  Tv,
  SprayCan,
  Construction,
  Lightbulb,
  PawPrint,
  Tent,
  CircleHelp,
  Bug,
  Accessibility,
  TriangleAlert,
  CircleParking,
  HardHat,
  Bike,
  Container,
  BusFront,
  TrafficCone,
  Droplets,
  MessageSquare,
}

export function ServiceIcon({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const Icon = ICONS[name] ?? CircleHelp
  return <Icon className={className} aria-hidden="true" />
}
