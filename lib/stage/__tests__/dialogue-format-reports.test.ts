import { describe, expect, it } from 'vitest'
import { repairDialogueFormatting } from '../dialogue-format'

/**
 * Regression corpus from production lines reported 2026-07-13.
 * Inputs are raw history (DB) values unless noted as mangled display forms.
 */
describe('repairDialogueFormatting — 2026-07-13 production reports', () => {
  it('does not mangle valid multi-beat quoted speech (Theron / Vince / Vex / Selene)', () => {
    const lines = [
      `"His silence would be a mercy. But the earth remembers its master's voice—and it's trembling still." [Theron runs his palm along the rough stone, feeling the aftershock vibrate through his staff.] "We're not descending into either, Selene. We're descending into what he tried to bury."`,
      `"The shaft breathes because it's a throat, Melanthus—and my father's kind always did speak through the earth." [Selene presses her palm to the damp stone, feeling the tremor of the earthquake still echoing in the rock's memory.] "The question is whether we're descending into his voice or his silence."`,
      `"Then perhaps we should ask what he buried with it." [Melanthus draws the caduceus charm from his belt, holding it into the cleft's draft. The tiny wings shiver, catching a current that smells of salt and scorched bronze.] "Because this shaft isn't just a passage — it's a sealed throat. And something down there is breathing."`,
      `"Then we will answer." [Selene steps past Theron into the cleft, the cold draft stirring the shells in her hair.] "I have knelt before no god's tremor, not even my father's. If this mountain demands an audience, it will have one — but it will hear me first."`,
      `"The kyber in my pocket pulses—not in answer, but in counterpoint." [I pull it free, its amber light now bleeding a thread of silver I've never seen before.] "If this lock needs a chorus, then something just added a new voice."`,
      `"Vito, you're telling me the dye in that thread was made by the same hands that sewed my father's funeral suit." [Vince doesn't look at him, his eyes fixed on the thread clinging to the mask on the floor.] "So the shooter isn't just a traitor. He's a ghost from Aldo's ledgers. Which means someone in this room has been wearing a dead man's work for six years, and I want to know whose tailor bills are still being paid."`,
      `"I don't intend to give it the chance to remember." [Selene draws the dolphin-shaped dagger, its bronze edge catching the faintest glimmer from above, then presses her free palm flat against the trembling stone wall.] "The earth shakes because he's here—and he's waking up."`,
    ]
    for (const line of lines) {
      expect(repairDialogueFormatting(line)).toBe(line)
    }
  })

  it('reverses inverted speech-in-brackets mangling (Class E)', () => {
    const mangled =
      `[His silence would be a mercy. But the earth remembers its master's voice—and it's trembling still.]" [Theron runs his palm along the rough stone, feeling the aftershock vibrate through his staff.] "[We're not descending into either, Selene. We're descending into what he tried to bury.]"`
    expect(repairDialogueFormatting(mangled)).toBe(
      `"His silence would be a mercy. But the earth remembers its master's voice—and it's trembling still." [Theron runs his palm along the rough stone, feeling the aftershock vibrate through his staff.] "We're not descending into either, Selene. We're descending into what he tried to bury."`,
    )
  })

  it('splits stage direction trapped inside spoken quotes (Class F)', () => {
    expect(
      repairDialogueFormatting(
        '"The mountain has heard defiance before—and it remembers. [His staff taps the stone twice.] But we are not here to challenge its god; we are here to see what he buried."',
      ),
    ).toBe(
      '"The mountain has heard defiance before—and it remembers." [His staff taps the stone twice.] "But we are not here to challenge its god; we are here to see what he buried."',
    )
  })

  it('converts outer-double + inner-single speech wraps', () => {
    expect(
      repairDialogueFormatting(
        `"Her grey eyes go distant, fingers tightening on the laurel branch. 'No dream—the god stirs beneath us. The earthquake is its breath drawing close.'"`,
      ),
    ).toBe(
      '[Her grey eyes go distant, fingers tightening on the laurel branch.] "No dream—the god stirs beneath us. The earthquake is its breath drawing close."',
    )
  })

  it('brackets bare truncated stage direction', () => {
    expect(repairDialogueFormatting('Her pale eyes drift from the flickering terminal to')).toBe(
      '[Her pale eyes drift from the flickering terminal to]',
    )
  })

  it('strips trailing single-letter garbage (P / C)', () => {
    expect(
      repairDialogueFormatting(
        `[Vex presses a scarred hand against the humming terminal, the amber kyber at his collar pulsing in counterpoint to the floor's dying tremor.] "Then the temple isn't just waking—it's answering. And whoever's broadcasting that key already knows what we're standing on." P`,
      ),
    ).toBe(
      `[Vex presses a scarred hand against the humming terminal, the amber kyber at his collar pulsing in counterpoint to the floor's dying tremor.] "Then the temple isn't just waking—it's answering. And whoever's broadcasting that key already knows what we're standing on."`,
    )
    expect(
      repairDialogueFormatting(
        `[Gio spits a crimson glob onto the marble floor, his voice a gravelly rasp as he points a trembling finger at the wall behind the Don's portrait.] "That plaster's been sweating for fifteen years every time the furnace kicks on. You want the name behind the cracked bell? Break open the wall and ask the bones yourself." C`,
      ),
    ).toBe(
      `[Gio spits a crimson glob onto the marble floor, his voice a gravelly rasp as he points a trembling finger at the wall behind the Don's portrait.] "That plaster's been sweating for fifteen years every time the furnace kicks on. You want the name behind the cracked bell? Break open the wall and ask the bones yourself."`,
    )
  })

  it('strips empty trailing quotes after stage direction', () => {
    expect(
      repairDialogueFormatting(
        '[The cybernetic eye flickers amber as Kaelen’s gaze locks onto the pulsing seam, his hand drifting to the scarred datapad at his belt.] "',
      ),
    ).toBe(
      '[The cybernetic eye flickers amber as Kaelen’s gaze locks onto the pulsing seam, his hand drifting to the scarred datapad at his belt.]',
    )
  })

  it('unwraps nested citation brackets inside stage direction', () => {
    expect(
      repairDialogueFormatting(
        '[Gio’s blood-slick fingers twitch once against the floorboards. His lips part, a wet rasp escaping—then nothing. But the photograph Vince holds catches the light: on its back, in Gio’s own hand, a single address and the words [“The priest’s real name.”]]',
      ),
    ).toBe(
      '[Gio’s blood-slick fingers twitch once against the floorboards. His lips part, a wet rasp escaping—then nothing. But the photograph Vince holds catches the light: on its back, in Gio’s own hand, a single address and the words "The priest’s real name."]',
    )
  })

  it('unwraps curly-quoted emphasis brackets including multi-word phrases', () => {
    expect(
      repairDialogueFormatting(
        '[Gio’s eyes snap open, a wet rasp escaping his throat as he forces a bloodied hand to the floor.] “The mask—it was [my] mask. The one I kept in the dashboard. Someone’s been riding with me for weeks.”',
      ),
    ).toBe(
      '[Gio’s eyes snap open, a wet rasp escaping his throat as he forces a bloodied hand to the floor.] "The mask—it was my mask. The one I kept in the dashboard. Someone’s been riding with me for weeks."',
    )
    expect(
      repairDialogueFormatting(
        '[Gio’s eyes snap open, fixed on Luca with a clarity that cuts through the death rattle in his throat.] “The moon brand... was a wedding gift from your mother—she told me to keep you alive, you ungrateful [sangue freddo].”',
      ),
    ).toBe(
      '[Gio’s eyes snap open, fixed on Luca with a clarity that cuts through the death rattle in his throat.] "The moon brand... was a wedding gift from your mother—she told me to keep you alive, you ungrateful sangue freddo."',
    )
    expect(
      repairDialogueFormatting(
        '[Gio’s body jerks once, a wet rattle escaping his throat as his eyes snap open, unfocused and wild.] “The cufflink… was a [gift]… from the man who paid for the grappa.” [His hand twitches toward Vince, then falls still.]',
      ),
    ).toBe(
      '[Gio’s body jerks once, a wet rattle escaping his throat as his eyes snap open, unfocused and wild.] "The cufflink… was a gift… from the man who paid for the grappa." [His hand twitches toward Vince, then falls still.]',
    )
  })

  it('converts single-quoted speech after stage direction and strips outer junk', () => {
    expect(
      repairDialogueFormatting(
        `"[Sera's palm flares brighter, amber energy rippling up his arm as he shoves harder against the grate, the hum from below climbing to a keen.] 'The listening post went dark before the Purge because whatever's down there ate that signal. We're not opening a door—we're waking something that's been waiting for us to knock.'"`,
      ),
    ).toBe(
      `[Sera's palm flares brighter, amber energy rippling up his arm as he shoves harder against the grate, the hum from below climbing to a keen.] "The listening post went dark before the Purge because whatever's down there ate that signal. We're not opening a door—we're waking something that's been waiting for us to knock."`,
    )
    expect(
      repairDialogueFormatting(
        '“[Kassandra’s eyes silver over as another tremor shudders through the stone.] ‘The hammer is not inert—it resonates with the quake. Pyros, your predecessor forged it from the same ore as the Titan’s claw. It calls to its kin.’”',
      ),
    ).toBe(
      '[Kassandra’s eyes silver over as another tremor shudders through the stone.] "The hammer is not inert—it resonates with the quake. Pyros, your predecessor forged it from the same ore as the Titan’s claw. It calls to its kin."',
    )
  })
})
