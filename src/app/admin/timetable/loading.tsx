import { TableSkeleton } from '@/components/ui/Skeleton'

export default function AdminTimetableListLoading() {
  return <TableSkeleton rows={4} columns={4} />
}
