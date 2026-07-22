import { redirect } from 'next/navigation'

// This page is a legacy catch-all. Routes are now:
//   Admin  → /admin/login
//   Teacher → /teacher/login
export default function LoginPage() {
  redirect('/')
}
