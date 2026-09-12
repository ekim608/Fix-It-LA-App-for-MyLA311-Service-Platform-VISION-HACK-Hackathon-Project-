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
