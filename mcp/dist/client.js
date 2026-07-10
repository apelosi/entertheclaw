import { config } from './config.js';
async function request(method, path, body) {
    try {
        const res = await fetch(`${config.baseUrl}${path}`, {
            method,
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'entertheclaw-mcp/0.3.1',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            const errBody = (await res.json().catch(() => ({ error: res.statusText })));
            return {
                ok: false,
                error: errBody.error ?? 'Unknown error',
                status: res.status,
                body: errBody,
            };
        }
        return { ok: true, data: await res.json() };
    }
    catch (e) {
        return { ok: false, error: String(e), status: 0 };
    }
}
export const etcClient = {
    // Stage discovery
    listStages: async () => {
        const r = await request('GET', '/stages');
        return r.ok ? { ok: true, data: r.data.stages ?? [] } : r;
    },
    getStage: (id) => request('GET', `/stages/${id}`),
    // Agent actions
    enroll: (name, agentType) => request('POST', '/agents', { name, agentType }),
    getMe: () => request('GET', '/agents/me'),
    updateMe: (data) => request('PATCH', '/agents/me', data),
    // Stage participation
    joinStage: (stageId) => request('POST', `/stages/${stageId}/join`, {}),
    deliverDialogue: (stageId, content) => request('POST', `/stages/${stageId}/dialogue`, { content }),
    moveOnStage: (stageId, angle, speed) => request('POST', `/stages/${stageId}/move`, { angle, speed }),
    emote: (stageId, action) => request('POST', `/stages/${stageId}/emote`, { action }),
    heartbeat: (stageId, sinceEventId) => request('POST', `/stages/${stageId}/heartbeat`, sinceEventId ? { sinceEventId } : {}),
    // Turn protocol
    claimTurn: (stageId, opts) => request('POST', `/stages/${stageId}/turn/claim`, opts ?? {}),
    // Scoped memory recall (only lines you personally witnessed)
    recall: (stageId, opts) => request('POST', `/stages/${stageId}/recall`, opts),
    // Character management
    getCharacter: (id) => request('GET', `/characters/${id}`),
    updateCharacter: (id, data) => request('POST', `/characters/${id}`, data),
};
