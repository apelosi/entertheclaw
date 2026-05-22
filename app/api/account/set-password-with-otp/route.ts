import { getServerSession } from '@/lib/auth/get-server-session'
import { callNeonAuthUpstream } from '@/lib/auth/neon-auth-upstream'
import {
  validateNewPassword,
  validatePasswordConfirm,
} from '@/lib/auth/password'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { data: session } = await getServerSession()
  const email = session?.user?.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    otp?: string
    password?: string
    confirmPassword?: string
  } | null

  const otp = body?.otp?.trim() ?? ''
  if (!otp) {
    return NextResponse.json({ error: 'Verification code is required.' }, { status: 400 })
  }

  const password = body?.password ?? ''
  const passwordError = validateNewPassword(password)
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 })
  }

  const confirmError = validatePasswordConfirm(password, body?.confirmPassword ?? '')
  if (confirmError) {
    return NextResponse.json({ error: confirmError }, { status: 400 })
  }

  const upstream = await callNeonAuthUpstream(
    'email-otp/reset-password',
    {
      method: 'POST',
      body: { email, otp, password },
    },
    request,
  )
  const data = await upstream.json().catch(() => ({}))
  return NextResponse.json(data, { status: upstream.status })
}
