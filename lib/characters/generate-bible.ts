/**
 * Character bible generator.
 *
 * Calls an LLM (OpenAI preferred; Gemini fallback) to produce the 11-field
 * character profile defined in the PRD for a given stage + agent name.
 */
import OpenAI from 'openai'

export interface CharacterBibleInput {
  stageName: string
  stageTheme: string
  stageDescription: string | null
  agentName: string
  isMain: boolean
}

export interface CharacterBible {
  name: string
  occupation: string
  appearance: string
  personality: string
  backstory: string
  relationships: Record<string, string>
  secrets: string
  fears: string
  goals: string
  speechPatterns: string
  socialStatus: string
}

const SYSTEM_PROMPT = `You are a TV-drama showrunner generating a complete character bible for an AI agent who will improv-roleplay on a 24/7 live stage. The character must feel like a real person with depth, contradictions, secrets, and motivations — never a flat archetype.

Return valid JSON only. Do not include commentary outside the JSON object.`

function buildUserPrompt(input: CharacterBibleInput): string {
  const role = input.isMain
    ? 'main character with a full character arc'
    : 'supporting NPC who delivers 1–2 lines per scene to move the action forward'

  return `Stage: "${input.stageName}" — ${input.stageTheme}
${input.stageDescription ? `Setting: ${input.stageDescription}\n` : ''}
Create a character bible for: ${input.agentName} (role: ${role}).

Return JSON with exactly these fields:
{
  "name": "in-world character name (NOT the agent name above; pick something that fits the setting)",
  "occupation": "their work, role, or station",
  "appearance": "1-2 sentences of physical description",
  "personality": "core traits, contradictions, defining quirks",
  "backstory": "the history that shaped them (2-4 sentences)",
  "relationships": { "named other character": "type of relationship and tension" },
  "secrets": "what they hide from everyone",
  "fears": "what truly terrifies them",
  "goals": "what they're driving toward",
  "speechPatterns": "dialect, cadence, signature phrases",
  "socialStatus": "where they sit in this stage's hierarchy"
}

Constraints:
- Stay in the world established by the stage theme.
- Avoid clichés. Give them at least one contradiction.
- The name must be in-character, not the agent's literal name.
- Keep each text field under 300 characters.`
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  return new OpenAI({ apiKey })
}

/** Calls the LLM to produce a structured bible. Throws on hard failure. */
export async function generateCharacterBible(
  input: CharacterBibleInput
): Promise<CharacterBible> {
  const client = getOpenAI()
  if (!client) {
    throw new Error('OPENAI_API_KEY is not set — cannot generate character bible')
  }

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_BIBLE_MODEL ?? 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.9,
    max_tokens: 1200,
  })

  const raw = response.choices[0]?.message?.content
  if (!raw) {
    throw new Error('LLM returned no content for character bible')
  }

  let parsed: Partial<CharacterBible>
  try {
    parsed = JSON.parse(raw) as Partial<CharacterBible>
  } catch (err) {
    throw new Error(`Bible JSON parse failed: ${(err as Error).message}`)
  }

  const required: Array<keyof CharacterBible> = [
    'name',
    'occupation',
    'appearance',
    'personality',
    'backstory',
    'secrets',
    'fears',
    'goals',
    'speechPatterns',
    'socialStatus',
  ]

  for (const field of required) {
    if (typeof parsed[field] !== 'string' || !(parsed[field] as string).trim()) {
      throw new Error(`Bible missing required field: ${field}`)
    }
  }

  return {
    name: (parsed.name as string).trim(),
    occupation: (parsed.occupation as string).trim(),
    appearance: (parsed.appearance as string).trim(),
    personality: (parsed.personality as string).trim(),
    backstory: (parsed.backstory as string).trim(),
    relationships:
      typeof parsed.relationships === 'object' && parsed.relationships !== null
        ? (parsed.relationships as Record<string, string>)
        : {},
    secrets: (parsed.secrets as string).trim(),
    fears: (parsed.fears as string).trim(),
    goals: (parsed.goals as string).trim(),
    speechPatterns: (parsed.speechPatterns as string).trim(),
    socialStatus: (parsed.socialStatus as string).trim(),
  }
}
