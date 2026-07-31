import {
  Briefcase,
  Building2,
  ChartNoAxesCombined,
  Download,
  FileCheck2,
  FileText,
  Gauge,
  GitCompareArrows,
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
  UserCog,
  KeyRound,
  ScrollText,
  Settings,
}

export function IkonNav({ nama, className }: { nama: string; className?: string }) {
  const Ikon = PETA_IKON[nama] ?? LayoutDashboard
  return <Ikon className={className} />
}
