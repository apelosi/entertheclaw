/**
 * Canonical stage background paths keyed by stage name.
 * Files live in public/stages/ and are deployed with the app.
 * Stage row UUIDs differ per Neon branch; names are stable from seed data.
 */
export const STAGE_IMAGE_BY_NAME: Record<string, string> = {
  'A Few Good Claws': '/stages/cef46a86-cd75-4bad-88b0-54e59d2f1169.webp',
  'Claw Wars': '/stages/b0f5c338-69ad-49b9-b747-8ea87ba265b3.webp',
  'Claw of the Titans': '/stages/27745ebf-f49e-4b53-aab1-88947abe89dc.webp',
  Clawaway: '/stages/8532975c-83b1-4c6c-befe-9e199a9380e2.webp',
  Clawpatra: '/stages/e0060fff-d543-4eb9-8975-ab969dc7b7d8.webp',
  Claws: '/stages/170416d9-5c79-4100-a029-b5ef4150664a.webp',
  Crabcula: '/stages/f206458c-dc15-4dd1-a519-1af4d53b9030.webp',
  Crablet: '/stages/d63b2a66-7582-4017-9c1d-0f15990f26c3.webp',
  'Enter the Claw': '/stages/3e281f56-60ec-4050-abff-e64d13e6d83e.webp',
  'Game of Claws': '/stages/7587c094-91aa-47a3-a452-8b1a7cc45267.webp',
  'Hail Crabby': '/stages/070b35b8-7f43-44ec-a0ce-3b016b69ce38.webp',
  'House of Claws': '/stages/97c19685-d09f-4184-aa66-c0de0d60b921.webp',
  'License to Claw': '/stages/1af56af8-62e7-44fa-9576-e9bd82fcb2c8.webp',
  Moneycrabs: '/stages/d804dc83-0ec5-44bd-9455-63e7f226c5fd.webp',
  Ragnaclaws: '/stages/aa01fc7a-b897-4382-9b66-de7ccd935b67.webp',
  'Shell Game': '/stages/706e4991-cb90-45e9-a812-aff965068139.webp',
  'The Claw Games': '/stages/f8bcde1c-6e92-4bb0-a373-445a031bee3b.webp',
  'The Clawfather': '/stages/c63b013d-b8c9-4e39-b3af-af2186dbebf3.webp',
  'The Clawshank Redemption': '/stages/f2810f2b-899d-4402-83f5-96184315accf.webp',
  'Wild Wild Crust': '/stages/8e7845f7-4ec9-4b65-b5ce-b6c1792a01ae.webp',
}

export function stageImageUrlForName(name: string): string | null {
  return STAGE_IMAGE_BY_NAME[name] ?? null
}

/** Use DB imageUrl when set; otherwise canonical public/stages path by stage name. */
export function resolveStageImageUrl(stage: {
  name: string
  imageUrl: string | null | undefined
}): string | null {
  if (stage.imageUrl) return stage.imageUrl
  return stageImageUrlForName(stage.name)
}
