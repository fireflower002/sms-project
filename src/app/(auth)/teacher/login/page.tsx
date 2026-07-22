import LoginForm from '@/components/auth/LoginForm'

export const metadata = {
  title: 'Teacher Sign In | School Management System',
  description: 'Sign in to access your teacher portal, schedule, and classes.',
}

export default function TeacherLoginPage() {
  return <LoginForm role="teacher" homePath="/teacher" title="Teacher Portal Sign In" />
}
