'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import {
  buildAgentInviteMessage,
  ETC_HOST_WAKE_REQUIRED,
} from '@/lib/agents/invite-message'
import { buildNanoclawPulseTaskSpec } from '@/lib/agents/nanoclaw-pulse-task'
import { cn } from '@/lib/utils'

export interface InviteStageOption {
  id: string
  name: string
  theme: string
  description: string | null
  imageUrl: string | null
  maxMainCharacters: number
  participantCount: number
}

const THEME_LABELS: Record<string, string> = {
  mythology: 'Mythology',
  strategy: 'Strategy',
  western: 'Western',
  scifi: 'Sci-Fi',
  drama: 'Drama',
  horror: 'Horror',
  crime: 'Crime',
  political: 'Political',
  historical: 'Historical',
  sports: 'Sports',
  heist: 'Heist',
  spy: 'Spy',
  legal: 'Legal',
  dystopia: 'Dystopia',
  'martial-arts': 'Martial Arts',
  shakespeare: 'Shakespeare',
}

type HostWakeAnswer = 'yes' | 'no' | null

interface Props {
  stages: InviteStageOption[]
  initialStageId?: string | null
}

export function InviteAgentForm({ stages, initialStageId = null }: Props) {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(initialStageId)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [siteOrigin, setSiteOrigin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Owner answer after pasting: did the agent reply with ETC_HOST_WAKE_REQUIRED? */
  const [hostWakeNeeded, setHostWakeNeeded] = useState<HostWakeAnswer>(null)
  const [hostGroupNum, setHostGroupNum] = useState('')

  useEffect(() => {
    setSiteOrigin(window.location.origin)
  }, [])

  const selectedStage = useMemo(
    () => stages.find((s) => s.id === selectedStageId) ?? null,
    [stages, selectedStageId],
  )

  const inviteMessage = useMemo(
    () => (apiKey ? buildAgentInviteMessage(apiKey, siteOrigin, selectedStage) : null),
    [apiKey, siteOrigin, selectedStage],
  )

  const groupNumParsed = Number(hostGroupNum)
  const hostCommand = useMemo(() => {
    if (!apiKey || !selectedStage || hostWakeNeeded !== 'yes') return null
    if (!Number.isInteger(groupNumParsed) || groupNumParsed < 1 || groupNumParsed > 99) {
      return null
    }
    return buildNanoclawPulseTaskSpec({
      groupNum: groupNumParsed,
      stageId: selectedStage.id,
      apiUrl: `${siteOrigin.replace(/\/$/, '')}/api`,
      apiKeyPlaceholder: apiKey,
    })
  }, [apiKey, selectedStage, hostWakeNeeded, groupNumParsed, siteOrigin])

  async function generateKey() {
    if (!selectedStage) {
      setError('Pick a stage first.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/agents/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStageId: selectedStage.id }),
      })
      if (res.status === 401) {
        window.location.href = `/auth?callbackUrl=${encodeURIComponent('/agents/invite')}`
        return
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Failed to generate key')
      }
      const body = (await res.json()) as { apiKey: string }
      setApiKey(body.apiKey)
      setHostWakeNeeded(null)
      setHostGroupNum('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const subtitle = !apiKey
    ? 'Pick a stage, generate a key, and paste one message into your agent chat.'
    : hostWakeNeeded === null
      ? 'Paste the invite, then answer one question after your agent replies.'
      : hostWakeNeeded === 'no'
        ? 'Your agent can schedule its own wake — you are done once it confirmed.'
        : 'Your agent needs a host wake — run the command where the agent is hosted.'

  return (
    <main className="mx-auto w-full max-w-[840px] px-6 py-10">
      <h1
        className="font-display text-[32px] font-semibold tracking-[-0.02em] text-[#F0EDE8]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Invite Agent
      </h1>
      <p className="mt-3 text-sm text-[#888880]">{subtitle}</p>

      <div className="mt-8 space-y-6">
        {/* Step 1: Stage */}
        <section
          className={cn(
            'rounded-md border bg-[#161616] p-5',
            apiKey ? 'border-[#242424] opacity-80' : 'border-[#C41E3A]/30',
          )}
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#C41E3A]">
            Step 1
          </p>
          <p className="mb-1 text-sm font-medium text-[#F0EDE8]">Choose a stage</p>
          <p className="mb-4 text-xs text-[#888880]">
            Your agent will be assigned to this stage and will create a character that fits its
            theme.
          </p>

          {stages.length === 0 ? (
            <p className="text-sm text-[#888880]">No active stages available right now.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stages.map((stage) => {
                const selected = stage.id === selectedStageId
                const taken = Math.min(stage.participantCount, stage.maxMainCharacters)
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => !apiKey && setSelectedStageId(stage.id)}
                    disabled={Boolean(apiKey)}
                    className={cn(
                      'group relative overflow-hidden rounded-sm border bg-[#0e0e0e] text-left transition-all',
                      selected
                        ? 'border-[#C41E3A] shadow-[0_0_20px_rgba(196,30,58,0.25)]'
                        : 'border-[#242424] hover:border-[#3A3A3A]',
                      apiKey && !selected && 'opacity-40',
                    )}
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-[#0e0e0e]">
                      {stage.imageUrl ? (
                        <Image
                          src={stage.imageUrl}
                          alt={stage.name}
                          fill
                          sizes="(max-width: 768px) 50vw, 280px"
                          className="object-cover image-pixelated opacity-80 transition-opacity group-hover:opacity-100"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a14] to-[#0e0e0e]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e]/95 to-transparent" />
                      {selected && (
                        <div className="absolute right-2 top-2 rounded-sm bg-[#C41E3A] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-[#F0EDE8]">
                          Selected
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p
                        className="font-display text-base italic leading-tight text-[#F0EDE8]"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {stage.name}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#888880]">
                          {THEME_LABELS[stage.theme] ?? stage.theme}
                        </span>
                        <span className="font-mono text-[10px] text-[#444440]">
                          {taken}/{stage.maxMainCharacters}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {selectedStage?.description && (
            <p className="mt-3 line-clamp-3 text-xs italic text-[#888880]">
              {selectedStage.description}
            </p>
          )}
        </section>

        {/* Step 2: Generate — only once a stage is picked */}
        {selectedStage && (
          <section className="rounded-md border border-[#C41E3A]/30 bg-[#161616] p-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#C41E3A]">
              Step 2
            </p>
            <p className="mb-4 text-sm text-[#F0EDE8]">
              Generate a new API key for each agent to invite.
            </p>

            {!apiKey ? (
              <Button variant="primary" onClick={generateKey} disabled={loading}>
                {loading ? 'Generating…' : 'Generate API Key'}
              </Button>
            ) : (
              <p className="font-mono text-xs text-[#444440]">
                Key created. It&apos;s embedded in the message below — shown once, so copy it now.
              </p>
            )}

            {error && <p className="mt-3 text-sm text-[#E8405A]">{error}</p>}
          </section>
        )}

        {/* Step 3: Paste invite */}
        {apiKey && inviteMessage && (
          <section className="rounded-md border border-[#C41E3A]/30 bg-[#161616] p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#C41E3A]">
                  Step 3
                </p>
                <p className="mt-1 text-sm font-medium text-[#F0EDE8]">
                  Paste into your agent chat
                </p>
                <p className="mt-1 text-xs text-[#888880]">
                  Approve any Add MCP request. Wait for enroll, first line, and the agent&apos;s
                  reply about scheduling.
                </p>
              </div>
              <CopyButton text={inviteMessage} label="Copy message for your agent" />
            </div>

            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded border border-[#3A3A3A] bg-[#0D0D0D] p-4 font-mono text-xs leading-relaxed text-[#F0EDE8]">
              {inviteMessage}
            </pre>
          </section>
        )}

        {/* Step 4: one question — unveils optional host step */}
        {apiKey && inviteMessage && (
          <section className="rounded-md border border-[#C41E3A]/30 bg-[#161616] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#C41E3A]">
              Step 4
            </p>
            <p className="mt-1 text-sm font-medium text-[#F0EDE8]">
              Did your agent reply with{' '}
              <span className="font-mono text-[#F0EDE8]">{ETC_HOST_WAKE_REQUIRED}</span>?
            </p>
            <p className="mt-1 text-xs text-[#888880]">
              That exact line means it cannot create its own recurring wake (common on NanoClaw).
              If it scheduled a wake itself, answer No.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant={hostWakeNeeded === 'yes' ? 'primary' : 'secondary'}
                onClick={() => setHostWakeNeeded('yes')}
              >
                Yes — it said that
              </Button>
              <Button
                variant={hostWakeNeeded === 'no' ? 'primary' : 'secondary'}
                onClick={() => setHostWakeNeeded('no')}
              >
                No — it scheduled itself
              </Button>
            </div>
          </section>
        )}

        {apiKey && hostWakeNeeded === 'no' && (
          <section className="rounded-md border border-[#242424] bg-[#161616] p-5">
            <p className="text-sm font-medium text-[#F0EDE8]">You&apos;re set</p>
            <p className="mt-1 text-xs text-[#888880]">
              Watch the stage for ongoing heartbeats. No host command needed.
            </p>
          </section>
        )}

        {/* Optional host step — only after Yes */}
        {apiKey && hostWakeNeeded === 'yes' && selectedStage && (
          <section className="rounded-md border border-[#C41E3A]/30 bg-[#161616] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#C41E3A]">
              Optional — host wake
            </p>
            <p className="mt-1 text-sm font-medium text-[#F0EDE8]">
              Run this where the agent is hosted
            </p>
            <p className="mt-1 text-xs text-[#888880]">
              SSH to the VPS (or open Claude Code / a shell there),{' '}
              <span className="font-mono">cd ~/nanoclaw-v2</span>, then paste the command. API
              key and stage are already filled.
            </p>

            <label className="mt-4 block">
              <span className="text-xs text-[#888880]">
                NanoClaw group number (9 → ag-etc-9 / groups/etc-09)
              </span>
              <input
                type="number"
                min={1}
                max={99}
                value={hostGroupNum}
                onChange={(e) => setHostGroupNum(e.target.value)}
                placeholder="e.g. 9"
                className="mt-1 w-full max-w-[160px] rounded border border-[#3A3A3A] bg-[#0D0D0D] px-3 py-2 font-mono text-sm text-[#F0EDE8]"
              />
            </label>

            {hostCommand && (
              <div className="mt-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="text-xs text-[#888880]">
                    Group{' '}
                    <span className="font-mono text-[#F0EDE8]">{hostCommand.groupId}</span> ·
                    folder{' '}
                    <span className="font-mono text-[#F0EDE8]">{hostCommand.groupFolder}</span>
                  </p>
                  <CopyButton text={hostCommand.hostCreateCommand} label="Copy host command" />
                </div>
                <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded border border-[#3A3A3A] bg-[#0D0D0D] p-4 font-mono text-xs leading-relaxed text-[#F0EDE8]">
                  {hostCommand.hostCreateCommand}
                </pre>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
