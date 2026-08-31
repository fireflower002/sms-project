import { TableSkeleton } from '@/components/ui/Skeleton'

export default function InventoryLoading() {
  return <TableSkeleton rows={6} columns={5} />
}
