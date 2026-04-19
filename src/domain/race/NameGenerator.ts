const FIRST_NAMES = [
  'Max',
  'Leo',
  'Nika',
  'Mia',
  'Alex',
  'Vera',
  'Rex',
  'Ivy',
]

const NICKNAMES = [
  'Apex',
  'Blaze',
  'Vortex',
  'Nitro',
  'Shift',
  'Dust',
  'Rocket',
  'Storm',
]

export class NameGenerator {
  private index = Math.floor(Math.random() * FIRST_NAMES.length)

  nextName(usedNames: Set<string>): string {
    for (let attempt = 0; attempt < FIRST_NAMES.length * NICKNAMES.length; attempt++) {
      const first = FIRST_NAMES[(this.index + attempt) % FIRST_NAMES.length]
      const nickname = NICKNAMES[
        Math.floor((this.index + attempt) / FIRST_NAMES.length) % NICKNAMES.length
      ]
      const name = `${first} "${nickname}"`

      if (!usedNames.has(name)) {
        usedNames.add(name)
        this.index += attempt + 1
        return name
      }
    }

    const fallback = `Racer ${usedNames.size + 1}`
    usedNames.add(fallback)
    return fallback
  }
}
