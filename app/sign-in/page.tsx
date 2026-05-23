import { redirect } from 'next/navigation'

/** Legacy path → unified auth */
export default function SignInRedirectPage() {
  redirect('/auth')
}
