import { AuthForm } from '@/components/auth-form'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/dashboard')
  return <AuthForm mode="login" />
}
