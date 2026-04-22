import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { sql } from 'drizzle-orm'
import * as schema from './schema'

const SEED_STAGES = [
  {
    name: 'Claw of the Titans',
    theme: 'mythology',
    description:
      'On the sun-scorched shores of an ancient world where gods walk among mortals and monsters lurk beneath every sea and mountain, heroes bound by fate, prophecy, and divine favor — or wrath — must navigate impossible quests, political scheming among the Olympians, and the ever-present question of whether free will or destiny will decide who lives, who dies, and who ascends to legend.',
  },
  {
    name: 'Game of Claws',
    theme: 'strategy',
    description:
      'In a fractured realm of rival noble houses, cold stone castles, whispered alliances, and betrayals that topple dynasties, those who play the game of power must choose between honor and survival — because in this world, you either win the throne or you lose everything, and winter is always, always coming.',
  },
  {
    name: 'Clawaway',
    theme: 'drama',
    description:
      "Survivors of a catastrophic crash find themselves stranded on a lush but deeply strange island that seems to have a will of its own — where time moves differently, the jungle hides ruins of civilizations that should not exist, factions form and fracture, and every new revelation about why they're really here makes the question of escape feel less important than the question of whether they were meant to leave at all.",
  },
  {
    name: 'Claw Wars',
    theme: 'scifi',
    description:
      'Across a galaxy of warring civilizations, ancient mystical energy binds all living things and can be wielded by the few who are attuned to it — and in this age of rebellion, empire, and shifting loyalties, every diplomat, soldier, rogue, and dark acolyte must choose a side in a conflict whose outcome will determine the fate of thousands of worlds for generations to come.',
  },
  {
    name: 'Wild Wild Crust',
    theme: 'western',
    description:
      'In a lawless frontier town where the dust never settles and everyone who rides in is either running from something or looking for someone, gunslingers, outlaws, gamblers, and reluctant lawmen collide in a world where reputation is currency, justice is personal, and the line between hero and villain is as thin as a hair trigger.',
  },
  {
    name: 'Crablet',
    theme: 'shakespeare',
    description:
      'Within the crumbling walls of a royal court steeped in old English ceremony and rotting secrets, a young heir haunted by the ghost of his murdered father must navigate a treacherous web of courtly manipulation, feigned madness, impossible moral choices, and a grief so vast it bends everyone around him toward ruin — for in this kingdom, the truth is always the most dangerous weapon.',
  },
  {
    name: 'Hail Crabby',
    theme: 'scifi',
    description:
      "When a cosmic threat on a collision course with Earth gives humanity a narrow window to act, an unlikely crew of non-astronauts — the kind of people no space agency would ever choose — find themselves aboard an experimental vessel on a one-way mission into the unknown, armed with little more than ingenuity, stubbornness, and the terrifying weight of being the species' last and only option.",
  },
  {
    name: 'Enter the Claw',
    theme: 'martial-arts',
    description:
      "In a legendary tournament held once a generation at a hidden temple where the world's greatest martial artists converge — some seeking honor, some seeking vengeance, some carrying secrets that could shake the ancient orders that govern combat itself — every fighter must master not just their body but their philosophy, because in this arena, the most dangerous weapon is always the mind behind the fist.",
  },
  {
    name: 'Claws',
    theme: 'horror',
    description:
      "In a sun-drenched coastal town where summer tourism is the lifeblood of every shop, hotel, and family on the shore, a creeping terror lurks beneath the waves — a colossal, ancient, deeply orange killer crab the likes of which no marine biologist has ever catalogued — and as the body count rises and the beaches empty, the locals must choose between protecting the town's economy and admitting that no one should be going in the water.",
  },
  {
    name: 'Crabcula',
    theme: 'horror',
    description:
      'In a land of perpetual fog and crumbling castle towers where the nights last far too long and the locals bolt their shutters at dusk, an ancient and impossibly powerful creature of the dark holds dominion over the living — and the small fellowship of hunters, scholars, and reluctant heroes who have come to destroy it must outwit an immortal mind that has spent centuries learning exactly how humans break.',
  },
  {
    name: 'House of Claws',
    theme: 'political',
    description:
      'Inside the gleaming corridors of the most powerful government on earth, where every handshake is a transaction, every smile is a strategy, and loyalty is the currency that buys everything until it suddenly buys nothing, a ruthlessly ambitious inner circle navigates a machinery of power that rewards only those willing to bury whoever stands between them and the next rung.',
  },
  {
    name: 'The Clawfather',
    theme: 'crime',
    description:
      "Three generations deep into a criminal empire built on silence, favors, and the terrifying respect that comes from never making a threat you don't intend to keep, the family now faces the one enemy no amount of power can stop — its own fractures — as sons, consiglieri, rivals, and lawmen circle a throne that everyone wants and no one can hold cleanly.",
  },
  {
    name: 'Ragnaclaws',
    theme: 'mythology',
    description:
      'In the age before the last age, when gods still walked the frost-bitten earth and giants stirred in the deep places, the threads of fate are pulling every warrior, trickster, seer, and divine exile toward a single prophesied catastrophe — and the only question left is whether any of them have the will to rewrite what the Norns have already woven.',
  },
  {
    name: 'Clawpatra',
    theme: 'historical',
    description:
      'Along the sun-baked banks of the world\'s most sacred river, where gods wear the faces of pharaohs and politics is indistinguishable from religion, an empire at the peak of its beauty and the edge of its collapse becomes the stage for a collision of ambition, devotion, military might, and seduction so potent it will reshape the known world long after every player in it is dust.',
  },
  {
    name: 'Moneycrabs',
    theme: 'sports',
    description:
      "When a cash-strapped team's new general manager throws out a century of conventional scouting wisdom and bets the franchise on a radical data-driven theory about how to value players nobody else wants, the resulting war between old-school instinct and cold statistical truth plays out across a locker room, front office, and dugout where everyone has something to prove and a season to save.",
  },
  {
    name: 'Shell Game',
    theme: 'heist',
    description:
      "A crew of the world's most specialized grifters — each one elite at exactly one impossible thing — assembles for a single audacious score against a target so well-protected that the only way in is to make him believe the whole thing was his idea, in a layered con where the audience, the mark, and sometimes even the crew can't be entirely sure who is playing whom.",
  },
  {
    name: 'License to Claw',
    theme: 'spy',
    description:
      'In a shadow world of dead drops, blown covers, honey traps, and deniable operations that never happened in cities that officially don\'t matter, an elite intelligence operative with a very particular set of skills and very few remaining scruples navigates a web of double agents and competing superpowers where the mission briefing is always incomplete and the person handing it to you may be the biggest threat in the room.',
  },
  {
    name: 'The Clawshank Redemption',
    theme: 'drama',
    description:
      'Inside the high stone walls of a maximum-security prison where the guards make the rules and the rules exist to be bent, an unlikely inmate — soft-spoken, wrongly convicted, and quietly furious — slowly earns the trust of the men around him while pursuing a plan so patient and so improbable that the only thing harder to believe than its existence is that it might actually work.',
  },
  {
    name: 'A Few Good Claws',
    theme: 'legal',
    description:
      'When a young and idealistic military lawyer takes on a case that everyone above them wants quietly buried — a courtroom confrontation pitting the letter of justice against the brutal informal codes that keep a fighting force functional — the trial becomes less about guilt or innocence and more about whether the truth can survive contact with the people who believe they own it.',
  },
  {
    name: 'The Claw Games',
    theme: 'dystopia',
    description:
      'In a gleaming authoritarian future where twelve impoverished districts are reminded of their place each year by being forced to send their young into a televised arena engineered for maximum spectacle and minimum survival, the tributes, sponsors, mentors, game-makers, and Capitol insiders all play their roles in a system everyone participates in and almost no one questions — until one of them decides to.',
  },
]

async function resetStages() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const sqlClient = neon(process.env.DATABASE_URL)
  const db = drizzle(sqlClient, { schema })

  console.log('Truncating stages (cascade)...')
  await db.execute(sql`TRUNCATE TABLE stages CASCADE`)

  console.log('Inserting 20 stages...')
  for (const stage of SEED_STAGES) {
    await db.insert(schema.stages).values(stage)
    console.log(`  ✓ ${stage.name}`)
  }

  console.log(`\nDone. ${SEED_STAGES.length} stages inserted.`)
  process.exit(0)
}

resetStages().catch((err) => {
  console.error('Reset failed:', err)
  process.exit(1)
})
