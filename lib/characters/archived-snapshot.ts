export type ArchivedCharacterSnapshot = {
  name?: string | null
  occupation?: string | null
  backstory?: string | null
  imageUrl?: string | null
  spriteUrl?: string | null
  createdAt?: string | Date | null
}

export function parseArchivedCharacterData(data: unknown): ArchivedCharacterSnapshot {
  if (!data || typeof data !== 'object') return {}
  return data as ArchivedCharacterSnapshot
}
