'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { STAGE_IMAGE_CLASS, STAGE_IMAGE_SCRIM_CLASS } from '@/components/stage/stage-image-styles'

interface StageCardThumbnailProps {
  imageUrl?: string
  name: string
  gradient: string
  hero?: boolean
}

export function StageCardThumbnail({
  imageUrl,
  name,
  gradient,
  hero = false,
}: StageCardThumbnailProps) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(imageUrl) && !failed

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-[#0e0e0e]',
        hero ? 'aspect-[16/9]' : 'aspect-video'
      )}
    >
      {showImage ? (
        <>
          <Image
            src={imageUrl!}
            alt={`${name} stage`}
            fill
            className={cn(
              STAGE_IMAGE_CLASS,
              'transition-all duration-700 group-hover:scale-[1.03] group-hover:opacity-100'
            )}
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            onError={() => setFailed(true)}
          />
          <div className={STAGE_IMAGE_SCRIM_CLASS} />
        </>
      ) : (
        <div className={cn('absolute inset-0 bg-gradient-to-br opacity-25', gradient)} />
      )}
    </div>
  )
}
