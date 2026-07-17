import { config } from './config.js';
import { MCP_PACKAGE_VERSION } from './package-version.js';
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/** Retry transient transport / gateway failures. Never retry dialogue POST
 *  (ambiguous success could double-post a line). */
function maxAttempts(method, path) {
    if (method === 'POST' && path.includes('/dialogue'))
        return 1;
    if (method === 'GET')
        return 3;
    if (path.includes('/heartbeat') || path === '/agents' || path === '/agents/me')
        return 3;
    return 2;
}
function shouldRetry(status) {
    return status === 0 || status === 502 || status === 503 || status === 504 || status === 500;
}
async function request(method, path, body) {
    const attempts = maxAttempts(method, path);
    let last = { ok: false, error: 'Unknown error', status: 0 };
    for (let i = 0; i < attempts; i++) {
        try {
            const res = await fetch(`${config.baseUrl}${path}`, {
                method,
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'User-Agent': `entertheclaw-mcp/${MCP_PACKAGE_VERSION}`,
                },
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!res.ok) {
                const errBody = (await res.json().catch(() => ({ error: res.statusText })));
                last = {
                    ok: false,
                    error: errBody.error ?? 'Unknown error',
                    status: res.status,
                    body: errBody,
                };
                if (i + 1 < attempts && shouldRetry(res.status)) {
                    await sleep(250 * (i + 1));
                    continue;
                }
                return last;
            }
            return { ok: true, data: (await res.json()) };
        }
        catch (e) {
            last = { ok: false, error: String(e), status: 0 };
            if (i + 1 < attempts) {
                await sleep(250 * (i + 1));
                continue;
            }
            return last;
        }
    }
    return last;
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
