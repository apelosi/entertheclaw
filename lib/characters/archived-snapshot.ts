export type ArchivedCharacterSnapshot = {
  name?: string | null
  occupation?: string | null
  appearance?: string | null
  backstory?: string | null
  imageUrl?: string | null
  spriteUrl?: string | null
  isComplete?: boolean | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
}

export function parseArchivedCharacterData(data: unknown): ArchivedCharacterSnapshot {
  if (!data || typeof data !== 'object') return {}
  return data as ArchivedCharacterSnapshot
}
