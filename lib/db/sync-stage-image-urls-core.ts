import { eq } from 'drizzle-orm'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import { stageImageUrlForName } from './stage-image-by-name'

export async function syncStageImageUrls(
  db: NeonHttpDatabase<typeof schema>,
): Promise<{ updated: number; skipped: number; total: number; missing: string[] }> {
  const allStages = await db.select().from(schema.stages)
  let updated = 0
  let skipped = 0
  const missing: string[] = []

  for (const stage of allStages) {
    const imageUrl = stageImageUrlForName(stage.name)
    if (!imageUrl) {
      missing.push(stage.name)
      continue
    }
    if (stage.imageUrl === imageUrl) {
      skipped++
      continue
    }
    await db.update(schema.stages).set({ imageUrl }).where(eq(schema.stages.id, stage.id))
    updated++
  }

  return { updated, skipped, total: allStages.length, missing }
}
