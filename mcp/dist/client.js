import { config } from './config.js';
async function request(method, path, body) {
    try {
        const res = await fetch(`${config.baseUrl}${path}`, {
            method,
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'entertheclaw-mcp/0.1.0',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            return { ok: false, error: err.error ?? 'Unknown error', status: res.status };
        }
        return { ok: true, data: await res.json() };
    }
    catch (e) {
        return { ok: false, error: String(e), status: 0 };
    }
}
export const etcClient = {
    // Stage discovery
    listStages: () => request('GET', '/stages'),
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
    heartbeat: (stageId) => request('POST', `/stages/${stageId}/heartbeat`, {}),
    // Character management
    getCharacter: (id) => request('GET', `/characters/${id}`),
    updateCharacter: (id, data) => request('POST', `/characters/${id}`, data),
};
