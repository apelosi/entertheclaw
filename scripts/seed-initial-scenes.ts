/**
 * Backfill `stages.initial_scene_name` and `stages.initial_scene_description`
 * for the 20 seeded stages. Safe to re-run; updates rows matched by name.
 *
 * Run with: `bun run db:seed-scenes`
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import { stages } from '../lib/db/schema'

interface SceneSeed {
  name: string
  initialSceneName: string
  initialSceneDescription: string
}

const SCENES: SceneSeed[] = [
  {
    name: 'Claw of the Titans',
    initialSceneName: 'The Oracle’s steps at Delphi, dawn',
    initialSceneDescription:
      'Marble steps still cool from the night, threaded with smoke from the temple braziers. The Aegean lies hammered-flat below; cypress trees lean toward the sanctuary as if eavesdropping. A bronze tripod ticks as it heats — the Pythia has not yet spoken, but everyone gathered already knows the question.',
  },
  {
    name: 'Game of Claws',
    initialSceneName: 'Great Hall of the keep, late afternoon',
    initialSceneDescription:
      'A long oak table runs the length of the hall, set with pewter cups and a roast already gone cold. Banners of three houses hang along the walls — one of them not invited. Snow blows past the arrow-slits. Outside the door, mailed boots pace, in step, slow.',
  },
  {
    name: 'Clawaway',
    initialSceneName: 'Wreckage beach, mid-morning',
    initialSceneDescription:
      'A torn-open fuselage smolders behind a strip of white sand. Suitcases and seat cushions litter the tideline; gulls argue over something best not looked at. The jungle wall begins where the sand ends — too green, too quiet, and somewhere deep inside it, something enormous shifts the canopy.',
  },
  {
    name: 'Claw Wars',
    initialSceneName: 'Smuggler’s cantina on a frontier moon',
    initialSceneDescription:
      'Smoke the color of bruise hangs over a sunken bar. A band of furred reptilians plays in the corner; nobody is listening. Booths along the back wall hold deals being struck in six languages and one that nobody admits to speaking. Two stormtroopers just walked in and the room got quieter.',
  },
  {
    name: 'Wild Wild Crust',
    initialSceneName: 'Sun-bleached saloon, mid-afternoon',
    initialSceneDescription:
      'Dust hangs in shafts of light through warped slats. The player piano is silent. Three boots up on the bar, four eyes on the door. The barkeep wipes the same glass he was wiping an hour ago — slowly, watching the street through the window over his shoulder.',
  },
  {
    name: 'Crablet',
    initialSceneName: 'Battlements of Elsinore, midnight',
    initialSceneDescription:
      'A bitter sea wind worries the torches along the parapet. Below, the castle is asleep; above, no stars. Two guards have just exchanged a look they cannot take back, and the prince stands a little apart — pale, listening for footsteps that ought not to be there.',
  },
  {
    name: 'Hail Crabby',
    initialSceneName: 'NASA briefing room, 0400',
    initialSceneDescription:
      'A long table under cold fluorescents, coffee cups already cooling. On the projector: an asteroid the size of Texas and a countdown nobody wants to look at. The director has not sat down yet. The crew assembled around the table are not astronauts — and every one of them has just been told why.',
  },
  {
    name: 'Enter the Claw',
    initialSceneName: 'Mountaintop temple courtyard, sunrise',
    initialSceneDescription:
      'A stone courtyard ringed by red pillars, mist still pooling at the foot of every step. The tournament gong hangs silent under a tiled roof; banners snap in a wind that smells of cedar and old incense. Fighters from a dozen lineages stand in loose lines, bowing — measuring each other without looking up.',
  },
  {
    name: 'Claws',
    initialSceneName: 'Amity town hall, emergency meeting',
    initialSceneDescription:
      'Folding chairs scrape on a scuffed wooden floor. Shop-owners, the mayor, two off-season fishermen, and a marine biologist with a stack of unwelcome photographs. The Fourth of July banner is still up. Outside the window, a flag-line snaps over an empty beach.',
  },
  {
    name: 'Crabcula',
    initialSceneName: 'Carpathian inn, the last fire of evening',
    initialSceneDescription:
      'A low-beamed common room thick with woodsmoke and onion. Locals at the bar fall silent the moment the door opens. A wolf howls, distant, then closer. The innkeeper sets down a chained rosary on the bar and quietly slides it toward the newest guest.',
  },
  {
    name: 'House of Claws',
    initialSceneName: 'Capitol corridor outside the whip’s office',
    initialSceneDescription:
      'Polished marble, brass fixtures, two interns pretending not to listen. The Whip’s door is cracked half an inch; the conversation behind it is being conducted entirely in glances now. A camera crew waits at the end of the hallway. They do not yet know what for.',
  },
  {
    name: 'The Clawfather',
    initialSceneName: 'Don Corleone’s study during the wedding',
    initialSceneDescription:
      'Heavy curtains drawn against the afternoon sun. A cat asleep on the desk. Outside, a brass band, laughter, glassware. Inside, a man asks for a favor on his daughter’s wedding day. The Don listens, one hand on the cat, the other turning a glass of grappa very, very slowly.',
  },
  {
    name: 'Ragnaclaws',
    initialSceneName: 'Mead-hall of the Aesir, winter feast',
    initialSceneDescription:
      'Long tables piled with mutton bone and overturned horns. A great fire roars in the central pit, and yet the rafters are rimed with frost — a sign no one will mention. Odin’s seat is empty. A raven on the back of his chair is staring at one particular guest.',
  },
  {
    name: 'Clawpatra',
    initialSceneName: 'Throne room of Alexandria, audience hour',
    initialSceneDescription:
      'Cool stone, gilded columns, the river’s breath drifting through high windows. Two scribes kneel with reed pens poised; a Roman envoy waits on the carpet, sweating in his cloak. The Queen sits one step above him, perfectly still — and she has not begun to speak yet.',
  },
  {
    name: 'Moneycrabs',
    initialSceneName: 'GM’s office, spring training',
    initialSceneDescription:
      'Cinderblock walls, fluorescent lights, a whiteboard covered in batting averages crossed out and rewritten. Three old scouts in folding chairs, arms crossed. One laptop on the desk, and the new analytics hire holding it like it might bite. The phone has been ringing for forty seconds.',
  },
  {
    name: 'Shell Game',
    initialSceneName: 'Bellagio suite, the crew assembles',
    initialSceneDescription:
      'A penthouse with the curtains half-drawn against the Strip. Room service for nine, half of it untouched. Blueprints of a casino vault spread across the floor; a holographic projector throws a model of the same vault into the air above them. The mastermind hasn’t said a word yet. Someone is already pouring whisky.',
  },
  {
    name: 'License to Claw',
    initialSceneName: 'MI6 briefing room, no daylight',
    initialSceneDescription:
      'A bunker-grey room beneath the Thames. A wall of monitors blinks through satellite frames of a foreign capital. M sits at the head of the table; Q is already exasperated. A folder labeled EYES ONLY waits in front of one empty chair — and the man it belongs to has just walked in twenty minutes late.',
  },
  {
    name: 'The Clawshank Redemption',
    initialSceneName: 'Shawshank prison yard, exercise hour',
    initialSceneDescription:
      'Grey walls, grey light, a square of dirt and a basketball hoop without a net. Inmates clump in their usual groups; guards on the towers watch with the patient boredom of men who have seen everything. The new fish stands alone by the fence, looking at the sky like he has never seen one before.',
  },
  {
    name: 'A Few Good Claws',
    initialSceneName: 'JAG office, dawn before trial',
    initialSceneDescription:
      'Stacks of deposition transcripts on a government-issue desk. Stale coffee, a flickering overhead light, two officers in dress whites and a third in rolled-up sleeves still arguing strategy. On the wall a clock ticks toward 0900. The phone rings; nobody picks it up.',
  },
  {
    name: 'The Claw Games',
    initialSceneName: 'District 12 town square, Reaping Day',
    initialSceneDescription:
      'Coal dust on every surface. Children herded into roped pens by age; parents kept behind a line of Peacekeepers. A glass bowl on the stage holds folded slips of paper. A camera crew adjusts the lights for the broadcast. Somewhere a mockingjay is whistling four notes nobody taught it.',
  },
]

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const sql = neon(process.env.DATABASE_URL)
  const db = drizzle(sql)

  console.log(`Backfilling initial scenes for ${SCENES.length} stages…`)

  let updated = 0
  let missing = 0
  for (const s of SCENES) {
    const result = await db
      .update(stages)
      .set({
        initialSceneName: s.initialSceneName,
        initialSceneDescription: s.initialSceneDescription,
      })
      .where(eq(stages.name, s.name))
      .returning({ id: stages.id })

    if (result.length === 0) {
      console.log(`  · ${s.name} — not in DB (skip)`)
      missing++
    } else {
      console.log(`  ✓ ${s.name}`)
      updated += result.length
    }
  }

  console.log(`\nDone. Updated ${updated} row(s); ${missing} stage(s) not present.`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed-scenes failed:', err)
  process.exit(1)
})
