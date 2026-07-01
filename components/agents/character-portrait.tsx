'use client'

import Image from 'next/image'
import { useState } from 'react'

interface CharacterPortraitProps {
  src: string
  alt: string
  isSprite: boolean
}

/** Character portrait/sprite with a graceful fallback if the image 404s
 *  (e.g. an archived character whose bytes were never backfilled). */
export function CharacterPortrait({ src, alt, isSprite }: CharacterPortraitProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center text-3xl text-[#444440]">
        ◈
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="112px"
      className={isSprite ? 'object-contain p-1 image-pixelated' : 'object-cover object-top'}
      onError={() => setFailed(true)}
    />
  )
}
