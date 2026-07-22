import LoginForm from '@/components/auth/LoginForm'

export default function AdminLoginPage() {
  return <LoginForm role="admin" homePath="/admin" title="Admin Sign In" />
}
