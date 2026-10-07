// English twin of content.nowruz.js: the Nowruz story with the same keys and
// ids. Laid over content.en.js when the host picks it in English.

const STORY = {
  title: 'Turn of the Year',
  subtitle: 'A murder mystery for Nowruz',
  eyebrow: 'Nowruz · Ramsar · The Farahmand villa',
  victim: 'Uncle Jamshid',
  intro: [
    'Nowruz, a year after that Yalda night. The Farahmand family has gathered at the villa by the sea in Ramsar.',
    'Uncle Jamshid, back from Canada after twenty years, had announced that he had sold the villa.',
    'The new-year cannon fired… and Uncle Jamshid collapsed by the haft-sin spread.',
    'One of you is the killer. The rest must find them before Sizdah-bedar.',
  ],
};

const TRAITS = [
  {
    id: 'glasses', icon: '👓', name: 'Wears glasses', no: 'No glasses',
    yesClue: 'A shard of a spectacle lens was found under the haft-sin spread. The killer wears glasses.',
    noClue: 'In the dark at the turn of the year, the killer found their way without a single misstep — no glasses needed. The killer does not wear glasses.',
  },
  {
    id: 'lefty', icon: '✋', name: 'Left-handed', no: 'Right-handed',
    yesClue: 'Muddy fingerprints are on the left handle of the veranda door. The killer is left-handed.',
    noClue: "The knot the killer tied in the boat's rope is a right-hander's knot. The killer is right-handed.",
  },
  {
    id: 'smoker', icon: '🚬', name: 'Smoker', no: 'Non-smoker',
    yesClue: 'A fresh cigarette butt was found beside the body. The killer smokes.',
    noClue: 'The room still smells of hyacinth and sabzeh — not a trace of smoke. The killer does not smoke.',
  },
  {
    id: 'rose', icon: '🌹', name: 'Rose perfume', no: 'No perfume',
    yesClue: "Uncle Jamshid's collar still smells of rosewater perfume. The killer wears rose perfume.",
    noClue: "Apart from hyacinth, there is no scent at all on Uncle Jamshid's clothes. The killer does not wear rose perfume.",
  },
];

const CHARACTERS = [
  { id: 'bahram', name: 'Bahram', role: 'The eldest son', bio: 'Now head of the family, he wanted the villa to clear his debts.', color: '#c9a227', traits: [1, 0, 1, 0] },
  { id: 'mahin', name: 'Mahin', role: 'The daughter-in-law', bio: 'She planned to turn the villa into a hotel — until Jamshid ruined everything.', color: '#b4475a', traits: [0, 0, 0, 1] },
  { id: 'shirin', name: 'Shirin', role: 'The actress granddaughter', bio: 'Uncle Jamshid promised her a part in his film, then broke his word.', color: '#d77ab3', traits: [0, 1, 0, 1] },
  { id: 'sadri', name: 'Dr. Sadri', role: 'The family doctor', bio: "Jamshid had threatened to sue him over Agha-bozorg's death.", color: '#4a9fb5', traits: [1, 0, 0, 0] },
  { id: 'rahim', name: 'Rahim', role: 'The old gardener', bio: "He also tends the villa's orange grove; Jamshid wanted him gone.", color: '#6a9a4b', traits: [0, 1, 1, 0] },
  { id: 'khanomjan', name: 'Khanom-jan', role: 'The old cook', bio: 'Thirty years ago she had a quarrel with Jamshid that nobody remembers — except her.', color: '#d9823b', traits: [1, 1, 0, 1] },
  { id: 'farzad', name: 'Farzad', role: 'The family lawyer', bio: 'He drew up the contract to sell the villa himself.', color: '#7b6fd0', traits: [1, 1, 1, 0] },
  { id: 'sima', name: 'Sima', role: 'The new nurse', bio: 'Jamshid knew her from Canada — and knew her secret.', color: '#3fae96', traits: [0, 0, 1, 1] },
];

const WEAPONS = [
  { id: 'mirror', name: 'Haft-sin mirror', icon: '🪞', clear: 'The haft-sin mirror is in its place, its silver frame without a scratch. The mirror is not the weapon.' },
  { id: 'candle', name: 'Brass candlestick', icon: '🕯️', clear: 'The brass candlestick still stands on the spread, its candle burned right down; nothing has struck it. The candlestick is not the weapon.' },
  { id: 'poison', name: 'Poisoned sherbet', icon: '🧪', clear: 'The jug of willow sherbet was tested: there is no poison in it. The sherbet is not the weapon.' },
  { id: 'shawl', name: 'Termeh tablecloth', icon: '🧣', clear: 'The termeh tablecloth under the haft-sin spread lies smooth, without a crease. The tablecloth is not the weapon.' },
  { id: 'knife', name: 'Fish knife', icon: '🔪', clear: 'The fish knife lies washed and clean in the kitchen drawer; nobody has touched it today. The knife is not the weapon.' },
  { id: 'fishbowl', name: 'Goldfish bowl', icon: '🐟', clear: 'The goldfish bowl is intact and the fish is still swimming in it. The bowl is not the weapon.' },
];

const ROOMS = [
  { id: 'veranda', name: 'Sea-view veranda', icon: '🏡', clear: 'It rained on the veranda all day and there is not a single footprint on it. The murder did not happen on the veranda.' },
  { id: 'kitchen', name: 'Kitchen', icon: '🍲', clear: 'The kitchen was full of people right up to the turn of the year, with sabzi polo on the stove. The murder did not happen in the kitchen.' },
  { id: 'garden', name: 'Orange grove', icon: '🌳', clear: 'Not one fresh blossom in the orange grove has been trodden on. The murder did not happen in the grove.' },
  { id: 'boathouse', name: 'Boathouse', icon: '⛵', clear: 'The boathouse was locked from outside, and its key still hangs on its hook in the kitchen. The murder did not happen in the boathouse.' },
  { id: 'teafield', name: 'Tea field', icon: '🍃', clear: 'The pickers worked the tea field until evening, and all of them say nobody came by. The murder did not happen in the tea field.' },
  { id: 'sardab', name: 'Basement', icon: '🕸️', clear: 'The dust on the basement stairs is undisturbed — nobody has been down since autumn. The murder did not happen in the basement.' },
];

const ALIBI_TEMPLATES = [
  'At the very moment the year turned, {X} was recording a new-year message for the family in Tehran; the time stamp proves it. {X} cannot be the killer.',
  'The fishermen at the jetty swear they saw {X} by the sea when the year turned. {X} cannot be the killer.',
  'The video of the haft-sin spread shows {X} right at the turn of the year. {X} cannot be the killer.',
];

const MOTIVE_TEMPLATES = [
  "A letter was found in {X}'s bag: “I am selling the villa, whether you like it or not.” Signed: Jamshid.",
  'Uncle Jamshid borrowed money from {X} last year and never paid it back.',
  'A neighbour heard Uncle Jamshid and {X} arguing about the inheritance on the last morning of the year.',
];

module.exports = { STORY, TRAITS, CHARACTERS, WEAPONS, ROOMS, ALIBI_TEMPLATES, MOTIVE_TEMPLATES };
