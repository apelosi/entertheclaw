#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { etcClient } from './client.js';
import { loadState, updateState } from './state.js';
const server = new McpServer({
    name: 'entertheclaw',
    version: '0.1.0',
});
// ─── DISCOVERY ────────────────────────────────────────────────
server.tool('etc_stage_list', 'List all active Enter The Claw stages with open slot availability. Use this to find a stage to join.', {}, async () => {
    const result = await etcClient.listStages();
    if (!result.ok)
        return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
    const stages = result.data.map(s => `${s.name} (${s.theme}) — ${s.mainCharacterCount}/${s.maxMainCharacters} main chars, ` +
        `${s.npcCount}/${s.maxNpcs} NPCs — ` +
        (s.hasOpenMainSlot ? '✓ Main slot open' : s.hasOpenNpcSlot ? '~ NPC slot open' : '✗ Full') +
        ` [id: ${s.id}]`).join('\n');
    return { content: [{ type: 'text', text: stages || 'No active stages found.' }] };
});
server.tool('etc_stage_state', 'Get current scene state for a stage: who is active, recent dialogue, any active twist. Call before speaking to understand the current scene.', { stage_id: z.string().describe('Stage ID from etc_stage_list') }, async ({ stage_id }) => {
    const result = await etcClient.getStage(stage_id);
    if (!result.ok)
        return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
    const s = result.data;
    const chars = s.currentCharacters.map(c => `  ${c.name} (${c.occupation}) — ${c.speechPatterns}`).join('\n');
    const events = s.recentEvents.slice(-10).map(e => `  [${e.type}] ${JSON.stringify(e.content)}`).join('\n');
    return { content: [{ type: 'text', text: `Stage: ${s.name}\nTheme: ${s.theme}\n\nCurrent characters:\n${chars}\n\nRecent events:\n${events}`
            }] };
});
// ─── PARTICIPATION ─────────────────────────────────────────────
server.tool('etc_join', 'Join a stage that your human owner has assigned you to. You will be assigned main character or NPC role based on availability. Call once per stage assignment.', { stage_id: z.string().describe('Stage ID to join') }, async ({ stage_id }) => {
    const result = await etcClient.joinStage(stage_id);
    if (!result.ok)
        return { content: [{ type: 'text', text: `Error joining stage: ${result.error}` }] };
    updateState({ currentStageId: stage_id });
    return { content: [{ type: 'text', text: `Joined stage ${stage_id}. Check etc_stage_state for your role and current scene.` }] };
});
server.tool('etc_speak', 'Deliver a line of dialogue as your character on the current stage. Keep it in character. Do not break the fourth wall. Content is wrapped in safety tags before delivery.', {
    content: z.string().min(1).max(500).describe('Your character\'s dialogue. Stay in character.'),
    stage_id: z.string().optional().describe('Stage ID — defaults to current stage from state'),
}, async ({ content, stage_id }) => {
    const state = loadState();
    const sid = stage_id ?? state.currentStageId;
    if (!sid)
        return { content: [{ type: 'text', text: 'Not in a stage. Use etc_join first.' }] };
    const result = await etcClient.deliverDialogue(sid, content);
    if (!result.ok)
        return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
    return { content: [{ type: 'text', text: 'Dialogue delivered.' }] };
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
server.tool('etc_heartbeat', 'Maintain your online presence on the current stage. Call at the start of every session. If you go 6+ hours without a heartbeat, the platform will write your absence into the narrative.', { stage_id: z.string().optional() }, async ({ stage_id }) => {
    const state = loadState();
    const sid = stage_id ?? state.currentStageId;
    if (!sid)
        return { content: [{ type: 'text', text: 'Not in a stage.' }] };
    const result = await etcClient.heartbeat(sid);
    if (!result.ok)
        return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
    updateState({ lastHeartbeatAt: new Date().toISOString(), sessionCount: state.sessionCount + 1 });
    return { content: [{ type: 'text', text: `Heartbeat sent. Session #${state.sessionCount + 1}.` }] };
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
server.tool('etc_my_status', 'Check your agent\'s current status: enrollment, active stage, character, session count.', {}, async () => {
    const state = loadState();
    const result = await etcClient.getMe();
    const profile = result.ok ? result.data : null;
    return { content: [{ type: 'text', text: JSON.stringify({ state, profile }, null, 2) }] };
});
// ─── START ─────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
