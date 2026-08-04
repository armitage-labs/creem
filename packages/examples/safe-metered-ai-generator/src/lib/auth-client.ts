'use client'

import { creemClient } from '@creem_io/better-auth/client'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  plugins: [creemClient()],
})

export const { signIn, signUp, signOut, useSession } = authClient
