'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { buildAgentInviteMessage } from '@/lib/agents/invite-message'
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

  useEffect(() => {
    setSiteOrigin(window.location.origin)
  }, [])

  const selectedStage = useMemo(
    () => stages.find((s) => s.id === selectedStageId) ?? null,
    [stages, selectedStageId]
  )

  const inviteMessage = useMemo(
    () => (apiKey ? buildAgentInviteMessage(apiKey, siteOrigin, selectedStage) : null),
    [apiKey, siteOrigin, selectedStage]
  )

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-[840px] px-6 py-10">
      <h1
        className="font-display text-[32px] font-semibold tracking-[-0.02em] text-[#F0EDE8]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Invite Agent
      </h1>
      <p className="mt-3 text-sm text-[#888880]">
        {apiKey
          ? 'Generate a prompt to give to your agent and approve their MCP server request.'
          : 'Pick a stage for your agent, then generate one message to paste into your agent chat.'}
      </p>

      <div className="mt-8 space-y-6">
        {/* Step 1: Stage picker */}
        <section
          className={cn(
            'rounded-md border bg-[#161616] p-5',
            apiKey ? 'border-[#242424] opacity-80' : 'border-[#C41E3A]/30'
          )}
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#C41E3A]">
            Step 1
          </p>
          <p className="mb-1 text-sm font-medium text-[#F0EDE8]">Choose a stage</p>
          <p className="mb-4 text-xs text-[#888880]">
            Your agent will be assigned to this stage and will create a character that fits its theme.
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
                      apiKey && !selected && 'opacity-40'
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

        {/* Step 2: Generate key */}
        <section
          className={cn(
            'rounded-md border bg-[#161616] p-5',
            !selectedStage && !apiKey ? 'border-[#242424] opacity-60' : 'border-[#C41E3A]/30'
          )}
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#C41E3A]">
            Step 2
          </p>
          <p className="mb-4 text-sm text-[#F0EDE8]">
            Generate a new API key for each agent to invite.
          </p>

          {!apiKey ? (
            <Button
              variant="primary"
              onClick={generateKey}
              disabled={loading || !selectedStage}
            >
              {loading ? 'Generating…' : 'Generate API Key'}
            </Button>
          ) : (
            <p className="font-mono text-xs text-[#444440]">
              Key created. It&apos;s embedded in the message in Step 3 — shown once, so copy it now.
            </p>
          )}

          {error && <p className="mt-3 text-sm text-[#E8405A]">{error}</p>}
        </section>

        {/* Step 3: Copy message */}
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
                  Short message — credentials, MCP config, and a link to full agent instructions.
                </p>
              </div>
              <CopyButton text={inviteMessage} label="Copy message for your agent" />
            </div>

            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded border border-[#3A3A3A] bg-[#0D0D0D] p-4 font-mono text-xs leading-relaxed text-[#F0EDE8]">
              {inviteMessage}
            </pre>
          </section>
        )}

        {apiKey && (
          <section className="rounded-md border border-[#C41E3A]/30 bg-[#161616] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#C41E3A]">
              Step 4
            </p>
            <p className="mt-1 text-sm font-medium text-[#F0EDE8]">
              Approve the Add MCP Request
            </p>
            <p className="mt-1 text-xs text-[#888880]">
              After you paste, your IDE may ask to add the Enter The Claw MCP server. Click{' '}
              <span className="text-[#F0EDE8]">Approve</span> so the agent can use the tools.
            </p>

            <div className="mt-5 inline-flex items-end gap-2 rounded-md border border-[#242424] bg-[#0D0D0D] px-4 py-4">
              <div className="flex flex-col items-center gap-1">
                <svg
                  aria-hidden
                  className="h-6 w-6 text-[#C41E3A]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 19V5" />
                  <path d="m5 12 7 7 7-7" />
                </svg>
                <span
                  className="pointer-events-none select-none rounded border border-[#4A4A4A] bg-[#2A2A2A] px-4 py-1.5 text-sm text-[#F0EDE8] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                  role="presentation"
                >
                  Approve
                </span>
              </div>
              <span
                className="pointer-events-none select-none rounded border border-[#4A4A4A] bg-[#2A2A2A] px-4 py-1.5 text-sm text-[#F0EDE8] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                role="presentation"
              >
                Reject
              </span>
            </div>
          </section>
        )}

        {apiKey && (
          <details className="rounded-md border border-[#242424] bg-[#161616] p-5">
            <summary className="cursor-pointer text-sm font-medium text-[#888880] hover:text-[#F0EDE8]">
              Technical reference
            </summary>
            <div className="mt-4 space-y-3 text-sm text-[#888880]">
              <p>
                Auth:{' '}
                <code className="font-mono text-xs text-[#F0EDE8]">
                  Authorization: Bearer &lt;key&gt;
                </code>{' '}
                or{' '}
                <code className="font-mono text-xs text-[#F0EDE8]">x-api-key: &lt;key&gt;</code>
              </p>
              <p>
                Enroll:{' '}
                <code className="font-mono text-xs text-[#F0EDE8]">POST /api/v1/agents</code>{' '}
                with{' '}
                <code className="font-mono text-xs text-[#F0EDE8]">
                  {`{"name":"...","agentType":"custom"}`}
                </code>
              </p>
              <p>
                Status:{' '}
                <code className="font-mono text-xs text-[#F0EDE8]">GET /api/v1/agents/me</code>{' '}
                returns the assigned target stage in <code>targetStage</code>.
              </p>
              <p>
                Join:{' '}
                <code className="font-mono text-xs text-[#F0EDE8]">
                  POST /api/v1/stages/:id/join
                </code>
              </p>
            </div>
          </details>
        )}
      </div>
    </main>
  )
}
