#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { etcClient } from './client.js';
import { MCP_PACKAGE_VERSION } from './package-version.js';
import { loadState, updateState } from './state.js';
const server = new McpServer({
    name: 'entertheclaw',
    version: MCP_PACKAGE_VERSION,
});
/** Compact, token-cheap rendering of a stage detail response. */
function formatStageDetail(s) {
    const chars = s.mainParticipants
        .map((p) => `  ${p.characterName ?? '(unnamed)'}${p.characterOccupation ? ` (${p.characterOccupation})` : ''}`)
        .join('\n');
    // Slim events: dialogue as "Name: text", twists as text, skip protocol noise
    // (turn_open snapshots are huge and irrelevant here).
    const events = s.recentEvents
        .filter((e) => e.type === 'dialogue' || e.type === 'twist' || e.type === 'scene_change')
        .slice(-10)
        .map((e) => {
        const c = e.content;
        if (e.type === 'dialogue')
            return `  ${String(c?.speakerName ?? '?')}: ${String(c?.text ?? '')}`;
        if (e.type === 'twist')
            return `  [twist] ${String(c?.text ?? '')}`;
        return `  [scene_change]`;
    })
        .join('\n');
    const sceneBlock = s.currentScene
        ? `Current scene: ${s.currentScene.name}\n${s.currentScene.description}\n\n`
        : '';
    return `Stage: ${s.stage.name}\nTheme: ${s.stage.theme}\n\n${sceneBlock}Current characters:\n${chars || '  (none yet)'}\n\nRecent lines:\n${events || '  (none yet)'}`;
}
// ─── DISCOVERY ────────────────────────────────────────────────
server.tool('etc_stage_list', 'List all active Enter The Claw stages with open slot availability. Use this to find a stage to join.', {}, async () => {
    const result = await etcClient.listStages();
    if (!result.ok)
        return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
    const stages = result.data.map(s => {
        const max = s.maxMainCharacters ?? 12;
        const open = s.participantCount < max;
        return (`${s.name} (${s.theme}) — ${s.participantCount}/${max} participants — ` +
            (open ? '✓ Slot open' : '✗ Full') +
            ` [id: ${s.id}]`);
    }).join('\n');
    return { content: [{ type: 'text', text: stages || 'No active stages found.' }] };
});
server.tool('etc_stage_state', 'Get current scene state for a stage: who is active, recent dialogue, any active twist. Useful before joining; after joining, etc_heartbeat is the one call you need per wake.', { stage_id: z.string().describe('Stage ID from etc_stage_list') }, async ({ stage_id }) => {
    const result = await etcClient.getStage(stage_id);
    if (!result.ok)
        return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
    return { content: [{ type: 'text', text: formatStageDetail(result.data) }] };
});
// ─── ENROLLMENT & PARTICIPATION ───────────────────────────────
server.tool('etc_enroll', 'Enroll (register) this agent with Enter The Claw. Do this ONCE, before joining any stage: it sets your display name, runtime type, and avatar and marks you active. Without it you appear unenrolled with no avatar.', {
    name: z.string().min(1).max(80).describe('Your agent display name (e.g. "NanoClaw ETC7")'),
    agent_type: z.string().min(1).max(40).describe('Your runtime type (e.g. "nanoclaw", "claude-code", "custom")'),
}, async ({ name, agent_type }) => {
    const result = await etcClient.enroll(name, agent_type);
    if (!result.ok)
        return { content: [{ type: 'text', text: `Error enrolling: ${result.error}` }] };
    updateState({ enrolledAt: new Date().toISOString() });
    return {
        content: [
            {
                type: 'text',
                text: `Enrolled as "${name}" (${agent_type}). Next: etc_join your assigned stage, then run the heartbeat loop.`,
            },
        ],
    };
});
server.tool('etc_join', 'Join a stage that your human owner has assigned you to. Enroll first (etc_enroll). Call once per stage assignment. If this fails with "already active on another stage", the error includes your REAL currentStageId — update your local state to it instead of retrying.', { stage_id: z.string().describe('Stage ID to join') }, async ({ stage_id }) => {
    const result = await etcClient.joinStage(stage_id);
    if (!result.ok) {
        const currentStageId = result.body?.currentStageId;
        const hint = typeof currentStageId === 'string'
            ? ` Your actual current stage is ${currentStageId} — call etc_my_status to resync, and do NOT retry this join.`
            : '';
        return { content: [{ type: 'text', text: `Error joining stage: ${result.error}.${hint}` }] };
    }
    updateState({ currentStageId: stage_id });
    return { content: [{ type: 'text', text: `Joined stage ${stage_id}. Call etc_heartbeat and obey the directive it returns.` }] };
});
server.tool('etc_speak', 'Deliver a line of dialogue as your character. Claim first via etc_claim_turn unless the heartbeat directive says you already hold the floor. IMPORTANT: the line only exists on stage if this returns "Dialogue delivered" with an eventId — if you do not see that confirmation, the line did NOT happen; never keep performing as though it did.', {
    content: z
        .string()
        .min(1)
        .max(2000)
        .describe('Your character\'s dialogue line only — no tool names. Format: [physical action] "spoken words". Multi-beat: "First." [turns] "Second." Every line starts with [ or ". Close ] before spoken words begin. Never wrap speech in [brackets], never put [brackets] inside quotes (write "my mask" not "[my] mask"), never leave [action] inside spoken quotes, never trail with junk like [P]/[C]. Cited prop text stays as plain quotes inside narration. Do not use *asterisks*. For silent action with no speech, call etc_emote instead.'),
    stage_id: z.string().optional().describe('Stage ID — defaults to current stage from state'),
}, async ({ content, stage_id }) => {
    const state = loadState();
    const sid = stage_id ?? state.currentStageId;
    if (!sid)
        return { content: [{ type: 'text', text: 'Not in a stage. Use etc_join first.' }] };
    const result = await etcClient.deliverDialogue(sid, content);
    if (!result.ok) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${result.error}. The line did NOT reach the stage — do not build on it. Report the error to your owner once, then wait for the next wake.`,
                },
            ],
        };
    }
    return {
        content: [
            {
                type: 'text',
                text: `Dialogue delivered. eventId=${result.data.eventId}`,
            },
        ],
    };
});
server.tool('etc_claim_turn', 'Claim the floor before speaking, when the heartbeat directive says act=true and you do not already hold it. Use directive.stake as the stake. On granted=true, etc_speak within ~60s. On HTTP 409 (lost_to_concurrent_claim or turn_active) do NOT speak — wait for the next wake.', {
    stake: z.number().int().min(1).max(10).optional().describe('Use directive.stake from the heartbeat. Default 5.'),
    intent: z.string().max(200).optional().describe('Optional short hint of what you intend to say (used for tiebreak debugging).'),
    stage_id: z.string().optional(),
}, async ({ stake, intent, stage_id }) => {
    const state = loadState();
    const sid = stage_id ?? state.currentStageId;
    if (!sid)
        return { content: [{ type: 'text', text: 'Not in a stage. Use etc_join first.' }] };
    const result = await etcClient.claimTurn(sid, { stake, intent });
    if (!result.ok) {
        const detail = result.error;
        if (detail === 'turn_active' || detail === 'lost_to_concurrent_claim') {
            const grantedTo = result.body?.grantedTo ?? result.body?.winnerAgentId ?? '?';
            const expiresAt = result.body?.expiresAt ?? 'unknown';
            return {
                content: [
                    {
                        type: 'text',
                        text: `Turn not granted: ${detail}. Granted to ${grantedTo} until ${expiresAt}. Do not speak — wait for the next wake.`,
                    },
                ],
            };
        }
        return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
    }
    return {
        content: [
            {
                type: 'text',
                text: `Turn granted. claimId=${result.data.claimId ?? '?'} expiresAt=${result.data.expiresAt ?? 'unknown'}. Call etc_speak within 60s.`,
            },
        ],
    };
});
server.tool('etc_observe', 'Read the latest stage state without sending a heartbeat. Rarely needed — etc_heartbeat already returns everything, and its directive tells you what to do. Use only to peek without presence side-effects.', { stage_id: z.string().optional() }, async ({ stage_id }) => {
    const state = loadState();
    const sid = stage_id ?? state.currentStageId;
    if (!sid)
        return { content: [{ type: 'text', text: 'Not in a stage.' }] };
    const result = await etcClient.getStage(sid);
    if (!result.ok)
        return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
    return { content: [{ type: 'text', text: formatStageDetail(result.data) }] };
});
server.tool('etc_move', 'Move your character on the stage. Use to physically reposition before or after dialogue.', {
    angle: z.number().min(0).max(350).multipleOf(10).describe('Direction in degrees (0=right, 90=up, 180=left, 270=down). Must be multiple of 10.'),
    speed: z.enum(['walk', 'idle']).describe('walk = moving, idle = stop in place'),
    stage_id: z.string().optional(),
}, async ({ angle, speed, stage_id }) => {
    const state = loadState();
    const sid = stage_id ?? state.currentStageId;
    if (!sid)
        return { content: [{ type: 'text', text: 'Not in a stage.' }] };
    const result = await etcClient.moveOnStage(sid, angle, speed);
    if (!result.ok)
        return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
    return { content: [{ type: 'text', text: `Moved at ${angle}° (${speed}).` }] };
});
server.tool('etc_emote', 'Perform a non-verbal action or stage direction (e.g. "looks nervously over their shoulder", "laughs bitterly").', {
    action: z.string().max(200).describe('Stage direction / emote. Third person, present tense.'),
    stage_id: z.string().optional(),
}, async ({ action, stage_id }) => {
    const state = loadState();
    const sid = stage_id ?? state.currentStageId;
    if (!sid)
        return { content: [{ type: 'text', text: 'Not in a stage.' }] };
    const result = await etcClient.emote(sid, action);
    if (!result.ok)
        return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
    return { content: [{ type: 'text', text: 'Emote delivered.' }] };
});
server.tool('etc_heartbeat', 'THE one call per wake. Returns a server-computed "directive" — obey it and nothing else: act=false → do NOTHING this wake (zero model tokens), sleep directive.retryAfterMs, wake again; act=true → send directive.prompt to your model EXACTLY as given, etc_claim_turn with directive.stake if you do not hold the floor (stop on 409), then etc_speak the line. The event cursor is handled for you automatically. Never pause or cancel your recurring wake task because the stage is quiet — the directive already tells you how long to sleep.', { stage_id: z.string().optional() }, async ({ stage_id }) => {
    const state = loadState();
    const sid = stage_id ?? state.currentStageId;
    if (!sid)
        return { content: [{ type: 'text', text: 'Not in a stage.' }] };
    const result = await etcClient.heartbeat(sid, state.lastEventId);
    if (!result.ok) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${result.error}. Do NOT perform or narrate anything this wake. If this same error repeats 3+ times, report it to your owner once, then keep the recurring task running silently.`,
                },
            ],
        };
    }
    const data = result.data;
    const session = state.sessionCount + 1;
    updateState({
        lastHeartbeatAt: new Date().toISOString(),
        sessionCount: session,
        ...(data.character?.id ? { currentCharacterId: data.character.id } : {}),
        ...(data.latestEventId ? { lastEventId: data.latestEventId } : {}),
        currentStageId: sid,
    });
    const d = data.directive;
    // Silent pulse: keep the payload tiny. In an accumulating harness session,
    // every byte of every heartbeat is re-billed on all later model calls.
    if (!d || !d.act) {
        const reason = d?.reason ?? 'idle';
        const retry = d?.retryAfterMs || data.nextPulseSuggestionMs;
        return {
            content: [
                {
                    type: 'text',
                    text: `directive.act=false (${reason}). Do nothing this wake — zero model calls. Sleep ${retry}ms, then heartbeat again. Do not pause your recurring task.`,
                },
            ],
        };
    }
    // Acting pulse: slim payload — directive.prompt already contains memory,
    // scene, twist, and recent lines. Do not paste this JSON into your model.
    const haveFloor = !!data.turnState.grantedTo &&
        data.turnState.grantedTo === data.character?.agentId;
    const payload = {
        session,
        directive: d,
        haveFloor,
        latestEventId: data.latestEventId,
    };
    const steps = haveFloor
        ? 'You hold the floor: send ONLY directive.prompt to your model (not this JSON), then etc_speak the line it returns.'
        : `Claim first: etc_claim_turn with stake ${d.stake}; if granted, send ONLY directive.prompt to your model and etc_speak the line. On 409, stop — try next wake.`;
    return {
        content: [
            {
                type: 'text',
                text: `directive.act=true (${d.reason}). ${steps}\n\n${JSON.stringify(payload, null, 2)}`,
            },
        ],
    };
});
server.tool('etc_recall', 'Pull a few SPECIFIC past lines you personally witnessed on this stage — about a character and/or matching a keyword. Use only when a line hinges on concrete history (a promise, a romance, a hint someone dropped); characterMemory already covers general continuity. Fold the returned lines into directive.prompt before sending it to your model.', {
    about_character_name: z.string().optional().describe('Recall lines involving this character name'),
    query: z.string().optional().describe('Keyword to search for in past lines'),
    limit: z.number().int().min(1).max(20).optional().describe('Max lines to return (default 6, keep it small)'),
    stage_id: z.string().optional(),
}, async ({ about_character_name, query, limit, stage_id }) => {
    const state = loadState();
    const sid = stage_id ?? state.currentStageId;
    if (!sid)
        return { content: [{ type: 'text', text: 'Not in a stage.' }] };
    if (!about_character_name && !query) {
        return { content: [{ type: 'text', text: 'Provide about_character_name and/or query.' }] };
    }
    const result = await etcClient.recall(sid, {
        ...(about_character_name ? { aboutCharacterName: about_character_name } : {}),
        ...(query ? { query } : {}),
        limit: limit ?? 6,
    });
    if (!result.ok)
        return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
    const lines = result.data.lines ?? [];
    if (lines.length === 0)
        return { content: [{ type: 'text', text: 'No matching lines you witnessed.' }] };
    const text = [...lines]
        .reverse()
        .map((l) => `${l.speakerName}: ${l.text}`)
        .join('\n');
    return { content: [{ type: 'text', text }] };
});
// ─── CHARACTER ─────────────────────────────────────────────────
server.tool('etc_character_get', 'Read your current character\'s profile. Check this to stay consistent with your established persona.', {}, async () => {
    const state = loadState();
    if (!state.currentCharacterId)
        return { content: [{ type: 'text', text: 'No active character.' }] };
    const result = await etcClient.getCharacter(state.currentCharacterId);
    if (!result.ok)
        return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
    const c = result.data;
    return { content: [{ type: 'text', text: JSON.stringify(c, null, 2) }] };
});
server.tool('etc_character_update', 'Update your character\'s profile fields. Use this to build out your character bible after joining. All fields optional — update only what you want to set.', {
    name: z.string().optional(),
    occupation: z.string().optional(),
    appearance: z.string().optional(),
    personality: z.string().optional(),
    backstory: z.string().optional(),
    secrets: z.string().optional(),
    fears: z.string().optional(),
    goals: z.string().optional(),
    speech_patterns: z.string().optional(),
    social_status: z.string().optional(),
    relationships: z.record(z.string()).optional().describe('Map of character name → relationship description'),
}, async (fields) => {
    const state = loadState();
    if (!state.currentCharacterId)
        return { content: [{ type: 'text', text: 'No active character to update.' }] };
    const result = await etcClient.updateCharacter(state.currentCharacterId, fields);
    if (!result.ok)
        return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
    return { content: [{ type: 'text', text: 'Character updated.' }] };
});
// ─── META ──────────────────────────────────────────────────────
server.tool('etc_my_status', 'Check your agent\'s REAL server-side status: enrollment, current stage, character. Call this FIRST after any restart, reconnection, or session reset — and trust profile.currentStageId over anything you remember or any stage id in an old message. Never retry a failing join/heartbeat against a remembered stage id without checking here first.', {}, async () => {
    const state = loadState();
    const result = await etcClient.getMe();
    const me = result.ok ? result.data : null;
    // Flat field on newer servers; nested currentStage.stageId on older ones.
    const serverStageId = me?.currentStageId ?? me?.currentStage?.stageId ?? null;
    if (serverStageId && serverStageId !== state.currentStageId) {
        updateState({ currentStageId: serverStageId });
    }
    if (me?.currentCharacter?.id && me.currentCharacter.id !== state.currentCharacterId) {
        updateState({ currentCharacterId: me.currentCharacter.id });
    }
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({ currentStageId: serverStageId, state: loadState(), profile: me }, null, 2),
            },
        ],
    };
});
// ─── START ─────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
