import {
  Activity,
  BadgeCheck,
  BookOpen,
  Briefcase,
  Building2,
  ChartNoAxesCombined,
  Download,
  Printer,
  FileCheck2,
  FileText,
  Gauge,
  GitCompareArrows,
  GraduationCap,
  Grid3x3,
  Inbox,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  ListOrdered,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldAlert,
  Sprout,
  Target,
  TriangleAlert,
  UserCog,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'

/**
 * Peta nama ikon → komponen. `lib/navigasi.ts` menyimpan ikon sebagai string
 * supaya modul itu tetap bebas dependensi React dan bisa dipakai di mana saja.
 */
const PETA_IKON: Record<string, LucideIcon> = {
  LayoutDashboard,
  Inbox,
  Users,
  BadgeCheck,
  GraduationCap,
  Grid3x3,
  GitCompareArrows,
  Target,
  ListOrdered,
  FileCheck2,
  Sprout,
  RefreshCw,
  ListChecks,
  Gauge,
  Building2,
  Briefcase,
  TriangleAlert,
  ShieldAlert,
  ChartNoAxesCombined,
  FileText,
  Download,
  Printer,
  UserCog,
  UserRound,
  KeyRound,
  Activity,
  BookOpen,
  ScrollText,
  Settings,
}

export function IkonNav({ nama, className }: { nama: string; className?: string }) {
  const Ikon = PETA_IKON[nama] ?? LayoutDashboard
  return <Ikon className={className} />
}
