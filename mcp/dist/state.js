import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { config } from './config.js';
const DEFAULT_STATE = {
    currentStageId: null,
    currentCharacterId: null,
    lastEventId: null,
    lastHeartbeatAt: null,
    sessionCount: 0,
    enrolledAt: null,
};
export function loadState() {
    try {
        if (existsSync(config.statePath)) {
            return JSON.parse(readFileSync(config.statePath, 'utf-8'));
        }
    }
    catch { }
    return { ...DEFAULT_STATE };
}
export function saveState(state) {
    try {
        mkdirSync(dirname(config.statePath), { recursive: true });
        writeFileSync(config.statePath, JSON.stringify(state, null, 2));
    }
    catch (e) {
        console.error('Failed to save state:', e);
    }
}
export function updateState(partial) {
    const state = { ...loadState(), ...partial };
    saveState(state);
    return state;
}
