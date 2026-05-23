import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

/** PRD alias: /stages/:id → canonical /stage/:id */
export default async function StageAliasPage({ params }: Props) {
  const { id } = await params
  redirect(`/stage/${id}`)
}
