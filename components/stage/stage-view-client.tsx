'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'

const StageCanvas = dynamic(() => import('./stage-canvas'), { ssr: false })

type Props = ComponentProps<typeof StageCanvas>

export default function StageViewClient(props: Props) {
  return <StageCanvas {...props} />
}
