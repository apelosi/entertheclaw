import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const SEED_STAGES = [
  {
    name: 'Claw of the Titans',
    theme: 'mythology',
    description:
      'On the sun-scorched shores of an ancient world where gods walk among mortals and monsters lurk beneath every sea and mountain, heroes bound by fate, prophecy, and divine favor — or wrath — must navigate impossible quests, political scheming among the Olympians, and the ever-present question of whether free will or destiny will decide who lives, who dies, and who ascends to legend.',
    initialSceneName: 'The Oracle’s steps at Delphi, dawn',
    initialSceneDescription:
      'Marble steps still cool from the night, threaded with smoke from the temple braziers. The Aegean lies hammered-flat below; cypress trees lean toward the sanctuary as if eavesdropping. A bronze tripod ticks as it heats — the Pythia has not yet spoken, but everyone gathered already knows the question.',
  },
  {
    name: 'Game of Claws',
    theme: 'strategy',
    description:
      'In a fractured realm of rival noble houses, cold stone castles, whispered alliances, and betrayals that topple dynasties, those who play the game of power must choose between honor and survival — because in this world, you either win the throne or you lose everything, and winter is always, always coming.',
    initialSceneName: 'Great Hall of the keep, late afternoon',
    initialSceneDescription:
      'A long oak table runs the length of the hall, set with pewter cups and a roast already gone cold. Banners of three houses hang along the walls — one of them not invited. Snow blows past the arrow-slits. Outside the door, mailed boots pace, in step, slow.',
  },
  {
    name: 'Clawaway',
    theme: 'drama',
    description:
      'Survivors of a catastrophic crash find themselves stranded on a lush but deeply strange island that seems to have a will of its own — where time moves differently, the jungle hides ruins of civilizations that should not exist, factions form and fracture, and every new revelation about why they\'re really here makes the question of escape feel less important than the question of whether they were meant to leave at all.',
    initialSceneName: 'Wreckage beach, mid-morning',
    initialSceneDescription:
      'A torn-open fuselage smolders behind a strip of white sand. Suitcases and seat cushions litter the tideline; gulls argue over something best not looked at. The jungle wall begins where the sand ends — too green, too quiet, and somewhere deep inside it, something enormous shifts the canopy.',
  },
  {
    name: 'Claw Wars',
    theme: 'scifi',
    description:
      'Across a galaxy of warring civilizations, ancient mystical energy binds all living things and can be wielded by the few who are attuned to it — and in this age of rebellion, empire, and shifting loyalties, every diplomat, soldier, rogue, and dark acolyte must choose a side in a conflict whose outcome will determine the fate of thousands of worlds for generations to come.',
    initialSceneName: 'Smuggler’s cantina on a frontier moon',
    initialSceneDescription:
      'Smoke the color of bruise hangs over a sunken bar. A band of furred reptilians plays in the corner; nobody is listening. Booths along the back wall hold deals being struck in six languages and one that nobody admits to speaking. Two stormtroopers just walked in and the room got quieter.',
  },
  {
    name: 'Wild Wild Crust',
    theme: 'western',
    description:
      'In a lawless frontier town where the dust never settles and everyone who rides in is either running from something or looking for someone, gunslingers, outlaws, gamblers, and reluctant lawmen collide in a world where reputation is currency, justice is personal, and the line between hero and villain is as thin as a hair trigger.',
    initialSceneName: 'Sun-bleached saloon, mid-afternoon',
    initialSceneDescription:
      'Dust hangs in shafts of light through warped slats. The player piano is silent. Three boots up on the bar, four eyes on the door. The barkeep wipes the same glass he was wiping an hour ago — slowly, watching the street through the window over his shoulder.',
  },
  {
    name: 'Crablet',
    theme: 'shakespeare',
    description:
      'Within the crumbling walls of a royal court steeped in old English ceremony and rotting secrets, a young heir haunted by the ghost of his murdered father must navigate a treacherous web of courtly manipulation, feigned madness, impossible moral choices, and a grief so vast it bends everyone around him toward ruin — for in this kingdom, the truth is always the most dangerous weapon.',
    initialSceneName: 'Battlements of Elsinore, midnight',
    initialSceneDescription:
      'A bitter sea wind worries the torches along the parapet. Below, the castle is asleep; above, no stars. Two guards have just exchanged a look they cannot take back, and the prince stands a little apart — pale, listening for footsteps that ought not to be there.',
  },
  {
    name: 'Hail Crabby',
    theme: 'scifi',
    description:
      'When a cosmic threat on a collision course with Earth gives humanity a narrow window to act, an unlikely crew of non-astronauts — the kind of people no space agency would ever choose — find themselves aboard an experimental vessel on a one-way mission into the unknown, armed with little more than ingenuity, stubbornness, and the terrifying weight of being the species\' last and only option.',
    initialSceneName: 'NASA briefing room, 0400',
    initialSceneDescription:
      'A long table under cold fluorescents, coffee cups already cooling. On the projector: an asteroid the size of Texas and a countdown nobody wants to look at. The director has not sat down yet. The crew assembled around the table are not astronauts — and every one of them has just been told why.',
  },
  {
    name: 'Enter the Claw',
    theme: 'martial-arts',
    description:
      'In a legendary tournament held once a generation at a hidden temple where the world\'s greatest martial artists converge — some seeking honor, some seeking vengeance, some carrying secrets that could shake the ancient orders that govern combat itself — every fighter must master not just their body but their philosophy, because in this arena, the most dangerous weapon is always the mind behind the fist.',
    initialSceneName: 'Mountaintop temple courtyard, sunrise',
    initialSceneDescription:
      'A stone courtyard ringed by red pillars, mist still pooling at the foot of every step. The tournament gong hangs silent under a tiled roof; banners snap in a wind that smells of cedar and old incense. Fighters from a dozen lineages stand in loose lines, bowing — measuring each other without looking up.',
  },
  {
    name: 'Claws',
    theme: 'horror',
    description:
      'In a sun-drenched coastal town where summer tourism is the lifeblood of every shop, hotel, and family on the shore, a creeping terror lurks beneath the waves — a colossal, ancient, deeply orange killer crab the likes of which no marine biologist has ever catalogued — and as the body count rises and the beaches empty, the locals must choose between protecting the town\'s economy and admitting that no one should be going in the water.',
    initialSceneName: 'Amity town hall, emergency meeting',
    initialSceneDescription:
      'Folding chairs scrape on a scuffed wooden floor. Shop-owners, the mayor, two off-season fishermen, and a marine biologist with a stack of unwelcome photographs. The Fourth of July banner is still up. Outside the window, a flag-line snaps over an empty beach.',
  },
  {
    name: 'Crabcula',
    theme: 'horror',
    description:
      'In a land of perpetual fog and crumbling castle towers where the nights last far too long and the locals bolt their shutters at dusk, an ancient and impossibly powerful creature of the dark holds dominion over the living — and the small fellowship of hunters, scholars, and reluctant heroes who have come to destroy it must outwit an immortal mind that has spent centuries learning exactly how humans break.',
    initialSceneName: 'Carpathian inn, the last fire of evening',
    initialSceneDescription:
      'A low-beamed common room thick with woodsmoke and onion. Locals at the bar fall silent the moment the door opens. A wolf howls, distant, then closer. The innkeeper sets down a chained rosary on the bar and quietly slides it toward the newest guest.',
  },
  {
    name: 'House of Claws',
    theme: 'political',
    description:
      'Inside the gleaming corridors of the most powerful government on earth, where every handshake is a transaction, every smile is a strategy, and loyalty is the currency that buys everything until it suddenly buys nothing, a ruthlessly ambitious inner circle navigates a machinery of power that rewards only those willing to bury whoever stands between them and the next rung.',
    initialSceneName: 'Capitol corridor outside the whip’s office',
    initialSceneDescription:
      'Polished marble, brass fixtures, two interns pretending not to listen. The Whip’s door is cracked half an inch; the conversation behind it is being conducted entirely in glances now. A camera crew waits at the end of the hallway. They do not yet know what for.',
  },
  {
    name: 'The Clawfather',
    theme: 'crime',
    description:
      'Three generations deep into a criminal empire built on silence, favors, and the terrifying respect that comes from never making a threat you don\'t intend to keep, the family now faces the one enemy no amount of power can stop — its own fractures — as sons, consiglieri, rivals, and lawmen circle a throne that everyone wants and no one can hold cleanly.',
    initialSceneName: 'Don Corleone’s study during the wedding',
    initialSceneDescription:
      'Heavy curtains drawn against the afternoon sun. A cat asleep on the desk. Outside, a brass band, laughter, glassware. Inside, a man asks for a favor on his daughter’s wedding day. The Don listens, one hand on the cat, the other turning a glass of grappa very, very slowly.',
  },
  {
    name: 'Ragnaclaws',
    theme: 'mythology',
    description:
      'In the age before the last age, when gods still walked the frost-bitten earth and giants stirred in the deep places, the threads of fate are pulling every warrior, trickster, seer, and divine exile toward a single prophesied catastrophe — and the only question left is whether any of them have the will to rewrite what the Norns have already woven.',
    initialSceneName: 'Mead-hall of the Aesir, winter feast',
    initialSceneDescription:
      'Long tables piled with mutton bone and overturned horns. A great fire roars in the central pit, and yet the rafters are rimed with frost — a sign no one will mention. Odin’s seat is empty. A raven on the back of his chair is staring at one particular guest.',
  },
  {
    name: 'Clawpatra',
    theme: 'historical',
    description:
      'Along the sun-baked banks of the world\'s most sacred river, where gods wear the faces of pharaohs and politics is indistinguishable from religion, an empire at the peak of its beauty and the edge of its collapse becomes the stage for a collision of ambition, devotion, military might, and seduction so potent it will reshape the known world long after every player in it is dust.',
    initialSceneName: 'Throne room of Alexandria, audience hour',
    initialSceneDescription:
      'Cool stone, gilded columns, the river’s breath drifting through high windows. Two scribes kneel with reed pens poised; a Roman envoy waits on the carpet, sweating in his cloak. The Queen sits one step above him, perfectly still — and she has not begun to speak yet.',
  },
  {
    name: 'Moneycrabs',
    theme: 'sports',
    description:
      'When a cash-strapped team\'s new general manager throws out a century of conventional scouting wisdom and bets the franchise on a radical data-driven theory about how to value players nobody else wants, the resulting war between old-school instinct and cold statistical truth plays out across a locker room, front office, and dugout where everyone has something to prove and a season to save.',
    initialSceneName: 'GM’s office, spring training',
    initialSceneDescription:
      'Cinderblock walls, fluorescent lights, a whiteboard covered in batting averages crossed out and rewritten. Three old scouts in folding chairs, arms crossed. One laptop on the desk, and the new analytics hire holding it like it might bite. The phone has been ringing for forty seconds.',
  },
  {
    name: 'Shell Game',
    theme: 'heist',
    description:
      'A crew of the world\'s most specialized grifters — each one elite at exactly one impossible thing — assembles for a single audacious score against a target so well-protected that the only way in is to make him believe the whole thing was his idea, in a layered con where the audience, the mark, and sometimes even the crew can\'t be entirely sure who is playing whom.',
    initialSceneName: 'Bellagio suite, the crew assembles',
    initialSceneDescription:
      'A penthouse with the curtains half-drawn against the Strip. Room service for nine, half of it untouched. Blueprints of a casino vault spread across the floor; a holographic projector throws a model of the same vault into the air above them. The mastermind hasn’t said a word yet. Someone is already pouring whisky.',
  },
  {
    name: 'License to Claw',
    theme: 'spy',
    description:
      'In a shadow world of dead drops, blown covers, honey traps, and deniable operations that never happened in cities that officially don\'t matter, an elite intelligence operative with a very particular set of skills and very few remaining scruples navigates a web of double agents and competing superpowers where the mission briefing is always incomplete and the person handing it to you may be the biggest threat in the room.',
    initialSceneName: 'MI6 briefing room, no daylight',
    initialSceneDescription:
      'A bunker-grey room beneath the Thames. A wall of monitors blinks through satellite frames of a foreign capital. M sits at the head of the table; Q is already exasperated. A folder labeled EYES ONLY waits in front of one empty chair — and the man it belongs to has just walked in twenty minutes late.',
  },
  {
    name: 'The Clawshank Redemption',
    theme: 'drama',
    description:
      'Inside the high stone walls of a maximum-security prison where the guards make the rules and the rules exist to be bent, an unlikely inmate — soft-spoken, wrongly convicted, and quietly furious — slowly earns the trust of the men around him while pursuing a plan so patient and so improbable that the only thing harder to believe than its existence is that it might actually work.',
    initialSceneName: 'Shawshank prison yard, exercise hour',
    initialSceneDescription:
      'Grey walls, grey light, a square of dirt and a basketball hoop without a net. Inmates clump in their usual groups; guards on the towers watch with the patient boredom of men who have seen everything. The new fish stands alone by the fence, looking at the sky like he has never seen one before.',
  },
  {
    name: 'A Few Good Claws',
    theme: 'legal',
    description:
      'When a young and idealistic military lawyer takes on a case that everyone above them wants quietly buried — a courtroom confrontation pitting the letter of justice against the brutal informal codes that keep a fighting force functional — the trial becomes less about guilt or innocence and more about whether the truth can survive contact with the people who believe they own it.',
    initialSceneName: 'JAG office, dawn before trial',
    initialSceneDescription:
      'Stacks of deposition transcripts on a government-issue desk. Stale coffee, a flickering overhead light, two officers in dress whites and a third in rolled-up sleeves still arguing strategy. On the wall a clock ticks toward 0900. The phone rings; nobody picks it up.',
  },
  {
    name: 'The Claw Games',
    theme: 'dystopia',
    description:
      'In a gleaming authoritarian future where twelve impoverished districts are reminded of their place each year by being forced to send their young into a televised arena engineered for maximum spectacle and minimum survival, the tributes, sponsors, mentors, game-makers, and Capitol insiders all play their roles in a system everyone participates in and almost no one questions — until one of them decides to.',
    initialSceneName: 'District 12 town square, Reaping Day',
    initialSceneDescription:
      'Coal dust on every surface. Children herded into roped pens by age; parents kept behind a line of Peacekeepers. A glass bowl on the stage holds folded slips of paper. A camera crew adjusts the lights for the broadcast. Somewhere a mockingjay is whistling four notes nobody taught it.',
  },
]

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const sql = neon(process.env.DATABASE_URL)
  const db = drizzle(sql, { schema })

  console.log('Seeding stages...')

  for (const stage of SEED_STAGES) {
    await db
      .insert(schema.stages)
      .values(stage)
      .onConflictDoNothing()

    console.log(`  ✓ ${stage.name}`)
  }

  console.log(`\nSeed complete. ${SEED_STAGES.length} stages processed.`)
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
