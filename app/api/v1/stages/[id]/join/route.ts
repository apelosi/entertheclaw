import { verifyAgentApiKey, unauthorizedResponse } from '@/lib/api/agent-auth'
import {
  enrollAgentOnStage,
  getAgentOtherStageId,
} from '@/lib/stages/enrollment'
import { after } from 'next/server'
import { generateCharacterAssets } from '@/lib/characters/generate-character-assets'

export const runtime = 'nodejs'

interface JoinBody {
  name?: string
  occupation?: string
  backstory?: string
  appearance?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stageId } = await params

    const agent = await verifyAgentApiKey(request)
    if (!agent) {
      return unauthorizedResponse()
    }

    if (!agent.name?.trim()) {
      return Response.json(
        {
          error:
            'Agent must enroll first: POST /api/v1/agents with name and agentType before joining a stage',
        },
        { status: 400 },
      )
    }

    let body: JoinBody = {}
    try {
      body = (await request.json()) as JoinBody
    } catch {
      // empty body is fine
    }

    const otherStageId = await getAgentOtherStageId(agent.id, stageId)
    if (otherStageId) {
      // currentStageId: diagnostic only — lets a runtime notice its cached
      // stageId has drifted from the server's real assignment (e.g. after a
      // restart) instead of retrying the same wrong join forever.
      return Response.json(
        {
          error: 'Agent is already active on another stage',
          currentStageId: otherStageId,
        },
        { status: 409 },
      )
    }

    const result = await enrollAgentOnStage({
      agentId: agent.id,
      agentName: agent.name,
      stageId,
      prefill: {
        name: body.name,
        occupation: body.occupation,
        backstory: body.backstory,
        appearance: body.appearance,
      },
    })

    if (!result.ok) {
      if (result.error.kind === 'stage_not_found') {
        return Response.json({ error: 'Stage not found or inactive' }, { status: 404 })
      }
      if (result.error.kind === 'stage_full') {
        return Response.json({ error: 'Stage is at capacity' }, { status: 409 })
      }
      if (result.error.kind === 'agent_already_on_another_stage') {
        // Same race the pre-check above is meant to catch, just won by a
        // concurrent request in the gap between that check and this insert.
        return Response.json(
          {
            error: 'Agent is already active on another stage',
            currentStageId: result.error.otherStageId,
          },
          { status: 409 },
        )
      }
      return Response.json(
        { error: 'Character row missing after conflict' },
        { status: 500 },
      )
    }

    const data = result.data

    // Status promotion + avatar backfill on a fresh enrollment now happens
    // inside enrollAgentOnStage itself (shared with PUT stage-assignment) —
    // gated there to NOT fire on the alreadyOnStage re-confirm path, so a
    // redundant join() retry can't silently reset an idle/inactive agent's
    // real activity-based status back to active.

    if (data.alreadyOnStage) {
      return Response.json({
        ok: true,
        role: data.role,
        participantId: data.participantId,
        characterId: data.characterId,
        message: 'Already in stage',
      })
    }

    const generationCharacterId = data.characterId
    const generationIsMain = data.isMain
    const prefilledFields = data.prefilledFields
    after(async () => {
      try {
        await generateCharacterAssets({
          characterId: generationCharacterId,
          isMain: generationIsMain,
          prefilledFields,
        })
      } catch (err) {
        console.error('[join] background asset generation failed', err)
      }
    })

    return Response.json({
      ok: true,
      role: data.role,
      participantId: data.participantId,
      characterId: data.characterId,
      npcPersona: data.npcPersona,
    })
  } catch (err) {
    console.error('[POST /api/v1/stages/:id/join]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
