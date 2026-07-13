import { describe, expect, it } from 'vitest'
import { repairDialogueFormatting } from '../dialogue-format'

/**
 * Exact lines from the 2026-07-13 user report (Claw of the Titans / Claw Wars /
 * The Clawfather). Every case must pass before claiming the formatting work is done.
 */
describe('repairDialogueFormatting — user-reported Script lines', () => {
  describe('Claw of the Titans', () => {
    it('Selene: triple-close + "[speech.]" Class E variant', () => {
      expect(
        repairDialogueFormatting(
          `"I don't intend to give it the chance to remember.""" [Selene draws the dolphin-shaped dagger, its bronze edge catching the faintest glimmer from above, then presses her free palm flat against the trembling stone wall.] "[The earth shakes because he's here—and he's waking up.]"`,
        ),
      ).toBe(
        `"I don't intend to give it the chance to remember." [Selene draws the dolphin-shaped dagger, its bronze edge catching the faintest glimmer from above, then presses her free palm flat against the trembling stone wall.] "The earth shakes because he's here—and he's waking up."`,
      )
    })

    it('Theron: inverted speech-in-brackets', () => {
      expect(
        repairDialogueFormatting(
          `[His silence would be a mercy. But the earth remembers its master's voice—and it's trembling still.]" [Theron runs his palm along the rough stone, feeling the aftershock vibrate through his staff.] "[We're not descending into either, Selene. We're descending into what he tried to bury.]"`,
        ),
      ).toBe(
        `"His silence would be a mercy. But the earth remembers its master's voice—and it's trembling still." [Theron runs his palm along the rough stone, feeling the aftershock vibrate through his staff.] "We're not descending into either, Selene. We're descending into what he tried to bury."`,
      )
    })

    it('Selene: shaft breathes inverted', () => {
      expect(
        repairDialogueFormatting(
          `[The shaft breathes because it's a throat, Melanthus—and my father's kind always did speak through the earth.]" [Selene presses her palm to the damp stone, feeling the tremor of the earthquake still echoing in the rock's memory.] "[The question is whether we're descending into his voice or his silence.]"`,
        ),
      ).toBe(
        `"The shaft breathes because it's a throat, Melanthus—and my father's kind always did speak through the earth." [Selene presses her palm to the damp stone, feeling the tremor of the earthquake still echoing in the rock's memory.] "The question is whether we're descending into his voice or his silence."`,
      )
    })

    it('Melanthus: buried with it inverted', () => {
      expect(
        repairDialogueFormatting(
          `[Then perhaps we should ask what he buried with it.]" [Melanthus draws the caduceus charm from his belt, holding it into the cleft's draft. The tiny wings shiver, catching a current that smells of salt and scorched bronze.] "[Because this shaft isn't just a passage — it's a sealed throat. And something down there is breathing.]"`,
        ),
      ).toBe(
        `"Then perhaps we should ask what he buried with it." [Melanthus draws the caduceus charm from his belt, holding it into the cleft's draft. The tiny wings shiver, catching a current that smells of salt and scorched bronze.] "Because this shaft isn't just a passage — it's a sealed throat. And something down there is breathing."`,
      )
    })

    it('Theron: Class F action trapped inside quotes', () => {
      expect(
        repairDialogueFormatting(
          `"The mountain has heard defiance before—and it remembers. [His staff taps the stone twice.] But we are not here to challenge its god; we are here to see what he buried."`,
        ),
      ).toBe(
        `"The mountain has heard defiance before—and it remembers." [His staff taps the stone twice.] "But we are not here to challenge its god; we are here to see what he buried."`,
      )
    })

    it('Selene: inverted + double-quote second speech', () => {
      expect(
        repairDialogueFormatting(
          `[Then we will answer.]" [Selene steps past Theron into the cleft, the cold draft stirring the shells in her hair.] ""I have knelt before no god's tremor, not even my father's. If this mountain demands an audience, it will have one — but it will hear me first."`,
        ),
      ).toBe(
        `"Then we will answer." [Selene steps past Theron into the cleft, the cold draft stirring the shells in her hair.] "I have knelt before no god's tremor, not even my father's. If this mountain demands an audience, it will have one — but it will hear me first."`,
      )
    })

    it('Kassandra-style: outer double + inner single speech', () => {
      expect(
        repairDialogueFormatting(
          `"Her grey eyes go distant, fingers tightening on the laurel branch. 'No dream—the god stirs beneath us. The earthquake is its breath drawing close.'"`,
        ),
      ).toBe(
        `[Her grey eyes go distant, fingers tightening on the laurel branch.] "No dream—the god stirs beneath us. The earthquake is its breath drawing close."`,
      )
    })
  })

  describe('Claw Wars', () => {
    it('Sera Vex: bare truncated narration gets brackets', () => {
      expect(
        repairDialogueFormatting('Her pale eyes drift from the flickering terminal to'),
      ).toBe('[Her pale eyes drift from the flickering terminal to]')
    })

    it('Vex Nereus: inverted speech-in-brackets', () => {
      expect(
        repairDialogueFormatting(
          `[The kyber in my pocket pulses—not in answer, but in counterpoint.]" [I pull it free, its amber light now bleeding a thread of silver I've never seen before.] "[If this lock needs a chorus, then something just added a new voice.]"`,
        ),
      ).toBe(
        `"The kyber in my pocket pulses—not in answer, but in counterpoint." [I pull it free, its amber light now bleeding a thread of silver I've never seen before.] "If this lock needs a chorus, then something just added a new voice."`,
      )
    })

    it('Vex Nereus: strips trailing [P]', () => {
      expect(
        repairDialogueFormatting(
          `[Vex presses a scarred hand against the humming terminal, the amber kyber at his collar pulsing in counterpoint to the floor's dying tremor.] "Then the temple isn't just waking—it's answering. And whoever's broadcasting that key already knows what we're standing on." [P]`,
        ),
      ).toBe(
        `[Vex presses a scarred hand against the humming terminal, the amber kyber at his collar pulsing in counterpoint to the floor's dying tremor.] "Then the temple isn't just waking—it's answering. And whoever's broadcasting that key already knows what we're standing on."`,
      )
    })

    it('Kaelen Voss: strips empty trailing quote', () => {
      expect(
        repairDialogueFormatting(
          `[The cybernetic eye flickers amber as Kaelen’s gaze locks onto the pulsing seam, his hand drifting to the scarred datapad at his belt.] "`,
        ),
      ).toBe(
        `[The cybernetic eye flickers amber as Kaelen’s gaze locks onto the pulsing seam, his hand drifting to the scarred datapad at his belt.]`,
      )
    })
  })

  describe('The Clawfather', () => {
    it('Vince: inverted speech-in-brackets', () => {
      expect(
        repairDialogueFormatting(
          `[Vito, you're telling me the dye in that thread was made by the same hands that sewed my father's funeral suit.]" [Vince doesn't look at him, his eyes fixed on the thread clinging to the mask on the floor.] "[So the shooter isn't just a traitor. He's a ghost from Aldo's ledgers. Which means someone in this room has been wearing a dead man's work for six years, and I want to know whose tailor bills are still being paid.]"`,
        ),
      ).toBe(
        `"Vito, you're telling me the dye in that thread was made by the same hands that sewed my father's funeral suit." [Vince doesn't look at him, his eyes fixed on the thread clinging to the mask on the floor.] "So the shooter isn't just a traitor. He's a ghost from Aldo's ledgers. Which means someone in this room has been wearing a dead man's work for six years, and I want to know whose tailor bills are still being paid."`,
      )
    })

    it('Gio: strips trailing [C]', () => {
      expect(
        repairDialogueFormatting(
          `[Gio spits a crimson glob onto the marble floor, his voice a gravelly rasp as he points a trembling finger at the wall behind the Don's portrait.] "That plaster's been sweating for fifteen years every time the furnace kicks on. You want the name behind the cracked bell? Break open the wall and ask the bones yourself." [C]`,
        ),
      ).toBe(
        `[Gio spits a crimson glob onto the marble floor, his voice a gravelly rasp as he points a trembling finger at the wall behind the Don's portrait.] "That plaster's been sweating for fifteen years every time the furnace kicks on. You want the name behind the cracked bell? Break open the wall and ask the bones yourself."`,
      )
    })

    it('Gio: nested citation brackets on photo text', () => {
      expect(
        repairDialogueFormatting(
          `[Gio’s blood-slick fingers twitch once against the floorboards. His lips part, a wet rasp escaping—then nothing. But the photograph Vince holds catches the light: on its back, in Gio’s own hand, a single address and the words [“The priest’s real name.”]]`,
        ),
      ).toBe(
        `[Gio’s blood-slick fingers twitch once against the floorboards. His lips part, a wet rasp escaping—then nothing. But the photograph Vince holds catches the light: on its back, in Gio’s own hand, a single address and the words "The priest’s real name."]`,
      )
    })

    it('Gio: unwraps [my] inside spoken quotes', () => {
      expect(
        repairDialogueFormatting(
          `[Gio’s eyes snap open, a wet rasp escaping his throat as he forces a bloodied hand to the floor.] “The mask—it was [my] mask. The one I kept in the dashboard. Someone’s been riding with me for weeks.”`,
        ),
      ).toBe(
        `[Gio’s eyes snap open, a wet rasp escaping his throat as he forces a bloodied hand to the floor.] "The mask—it was my mask. The one I kept in the dashboard. Someone’s been riding with me for weeks."`,
      )
    })

    it('Gio: unwraps [sangue freddo] inside spoken quotes', () => {
      expect(
        repairDialogueFormatting(
          `[Gio’s eyes snap open, fixed on Luca with a clarity that cuts through the death rattle in his throat.] “The moon brand... was a wedding gift from your mother—she told me to keep you alive, you ungrateful [sangue freddo].”`,
        ),
      ).toBe(
        `[Gio’s eyes snap open, fixed on Luca with a clarity that cuts through the death rattle in his throat.] "The moon brand... was a wedding gift from your mother—she told me to keep you alive, you ungrateful sangue freddo."`,
      )
    })

    it('Gio: unwraps [gift] inside spoken quotes', () => {
      expect(
        repairDialogueFormatting(
          `[Gio’s body jerks once, a wet rattle escaping his throat as his eyes snap open, unfocused and wild.] “The cufflink… was a [gift]… from the man who paid for the grappa.” [His hand twitches toward Vince, then falls still.]`,
        ),
      ).toBe(
        `[Gio’s body jerks once, a wet rattle escaping his throat as his eyes snap open, unfocused and wild.] "The cufflink… was a gift… from the man who paid for the grappa." [His hand twitches toward Vince, then falls still.]`,
      )
    })
  })

  describe('Class C must quote spoken tails, not bracket them', () => {
    it('quotes bare spoken address after stage direction', () => {
      expect(
        repairDialogueFormatting(
          `[The Pythia's voice rolls out through the temple doors, ancient and resonant. Melanthus goes still, head cocked, listening. When the echoes fade, he lets out a slow breath] There. Did you hear that, forge-master? "The ash remembers."`,
        ),
      ).toBe(
        `[The Pythia's voice rolls out through the temple doors, ancient and resonant. Melanthus goes still, head cocked, listening. When the echoes fade, he lets out a slow breath] "There. Did you hear that, forge-master?" "The ash remembers."`,
      )
    })

    it('quotes second-person spoken prose after a cited phrase', () => {
      expect(
        repairDialogueFormatting(
          `[Melanthus's hand goes to the dead caduceus at his belt as the tripod shudders. He meets Kassandra's grey eyes.] 'What comes after.' You say that like you've already seen it, priestess.`,
        ),
      ).toBe(
        `[Melanthus's hand goes to the dead caduceus at his belt as the tripod shudders. He meets Kassandra's grey eyes.] "What comes after." "You say that like you've already seen it, priestess."`,
      )
    })

    it('quotes Underboss "You understand?" monologues instead of bracketing them', () => {
      expect(
        repairDialogueFormatting(
          `8:22 AM. Another check. Another all-clear. This is how you run an empire — not with noise, but with vigilance. You understand?`,
        ),
      ).toBe(
        `"8:22 AM. Another check. Another all-clear. This is how you run an empire — not with noise, but with vigilance. You understand?"`,
      )
      expect(
        repairDialogueFormatting(
          `I trust the family kept things in order while I was away. A man steps out for a day and comes back to find... well, let's just say I hope nobody mistook my absence for weakness. You understand?`,
        ),
      ).toBe(
        `"I trust the family kept things in order while I was away. A man steps out for a day and comes back to find... well, let's just say I hope nobody mistook my absence for weakness. You understand?"`,
      )
      expect(
        repairDialogueFormatting(
          `I've been patient. But patience runs thin when there's business to handle. So let me make this simple — anyone with something to say, say it now. Otherwise, I make the calls myself. You understand?`,
        ),
      ).toBe(
        `"I've been patient. But patience runs thin when there's business to handle. So let me make this simple — anyone with something to say, say it now. Otherwise, I make the calls myself. You understand?"`,
      )
    })
  })

  describe('idempotent on already-correct multi-beat lines', () => {
    it('does not mangle valid DB multi-beat forms', () => {
      const lines = [
        `"I don't intend to give it the chance to remember." [Selene draws the dolphin-shaped dagger, its bronze edge catching the faintest glimmer from above, then presses her free palm flat against the trembling stone wall.] "The earth shakes because he's here—and he's waking up."`,
        `"His silence would be a mercy. But the earth remembers its master's voice—and it's trembling still." [Theron runs his palm along the rough stone, feeling the aftershock vibrate through his staff.] "We're not descending into either, Selene. We're descending into what he tried to bury."`,
        `"The kyber in my pocket pulses—not in answer, but in counterpoint." [I pull it free, its amber light now bleeding a thread of silver I've never seen before.] "If this lock needs a chorus, then something just added a new voice."`,
        `"Vito, you're telling me the dye in that thread was made by the same hands that sewed my father's funeral suit." [Vince doesn't look at him, his eyes fixed on the thread clinging to the mask on the floor.] "So the shooter isn't just a traitor. He's a ghost from Aldo's ledgers. Which means someone in this room has been wearing a dead man's work for six years, and I want to know whose tailor bills are still being paid."`,
      ]
      for (const line of lines) {
        expect(repairDialogueFormatting(line)).toBe(line)
        expect(repairDialogueFormatting(repairDialogueFormatting(line))).toBe(line)
      }
    })
  })
})
