import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname } from 'path'
import { config } from './config.js'

interface EtcState {
  currentStageId: string | null
  currentCharacterId: string | null
  lastEventId: string | null
  lastHeartbeatAt: string | null
  sessionCount: number
  enrolledAt: string | null
}

const DEFAULT_STATE: EtcState = {
  currentStageId: null,
  currentCharacterId: null,
  lastEventId: null,
  lastHeartbeatAt: null,
  sessionCount: 0,
  enrolledAt: null,
}

export function loadState(): EtcState {
  try {
    if (existsSync(config.statePath)) {
      return JSON.parse(readFileSync(config.statePath, 'utf-8')) as EtcState
    }
  } catch {}
  return { ...DEFAULT_STATE }
}

export function saveState(state: EtcState): void {
  try {
    mkdirSync(dirname(config.statePath), { recursive: true })
    writeFileSync(config.statePath, JSON.stringify(state, null, 2))
  } catch (e) {
    console.error('Failed to save state:', e)
  }
}

export function updateState(partial: Partial<EtcState>): EtcState {
  const state = { ...loadState(), ...partial }
  saveState(state)
  return state
}
