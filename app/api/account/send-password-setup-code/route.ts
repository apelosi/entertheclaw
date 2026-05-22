import { getServerSession } from '@/lib/auth/get-server-session'
import { callNeonAuthUpstream } from '@/lib/auth/neon-auth-upstream'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { data: session } = await getServerSession()
  const email = session?.user?.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const upstream = await callNeonAuthUpstream(
    'forget-password/email-otp',
    {
      method: 'POST',
      body: { email },
    },
    request,
  )
  const data = await upstream.json().catch(() => ({}))
  return NextResponse.json(data, { status: upstream.status })
}
