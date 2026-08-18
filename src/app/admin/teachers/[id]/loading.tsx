import { TableSkeleton } from '@/components/ui/Skeleton'

export default function TeacherDetailLoading() {
  return <TableSkeleton rows={5} columns={4} />
}
