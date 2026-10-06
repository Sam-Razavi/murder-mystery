// English twin of content.js: the same story, characters and items with the
// same ids, translated. The engine picks this bundle when the host sets the
// language to English. Keep the keys and ids in step with content.js.

const STORY = {
  title: 'The Last Feast',
  subtitle: 'A murder mystery for Yalda night',
  intro: [
    'Yalda night, the old Farahmand family mansion in Shiraz.',
    'Agha-bozorg, the family patriarch, invited everyone to hear his will read at midnight.',
    'The clock struck twelve… and Agha-bozorg was no longer breathing.',
    'One of you is the killer. The rest must find them before sunrise.',
  ],
};

const TRAITS = [
  {
    id: 'glasses', icon: '👓', name: 'Wears glasses', no: 'No glasses',
    yesClue: 'A shard of a spectacle lens was found under the body. The killer wears glasses.',
    noClue: 'The blows were precise and close-range — someone with sharp eyesight. The killer does not wear glasses.',
  },
  {
    id: 'lefty', icon: '✋', name: 'Left-handed', no: 'Right-handed',
    yesClue: 'The blow came from the left. The killer is left-handed.',
    noClue: 'Fingerprints on the door handle show it was closed with the right hand. The killer is right-handed.',
  },
  {
    id: 'smoker', icon: '🚬', name: 'Smoker', no: 'Non-smoker',
    yesClue: 'The sharp smell of tobacco still hangs over the scene. The killer smokes.',
    noClue: 'Not a speck of ash or whiff of tobacco at the scene. The killer does not smoke.',
  },
  {
    id: 'rose', icon: '🌹', name: 'Rose perfume', no: 'No perfume',
    yesClue: "Agha-bozorg's collar still smells of rosewater perfume. The killer wears rose perfume.",
    noClue: 'The guard dog found no perfume at all at the scene. The killer does not wear rose perfume.',
  },
];

const CHARACTERS = [
  { id: 'bahram', name: 'Bahram', role: 'The eldest son', bio: 'His textile factory has gone bankrupt and he needs the inheritance.', color: '#c9a227', traits: [1, 0, 1, 0] },
  { id: 'mahin', name: 'Mahin', role: 'The daughter-in-law', bio: 'She has had her eye on this mansion for years.', color: '#b4475a', traits: [0, 0, 0, 1] },
  { id: 'shirin', name: 'Shirin', role: 'The actress granddaughter', bio: 'Agha-bozorg had threatened to cut her out of the will.', color: '#d77ab3', traits: [0, 1, 0, 1] },
  { id: 'sadri', name: 'Dr. Sadri', role: 'The family doctor', bio: "He prescribed all of Agha-bozorg's medicine himself.", color: '#4a9fb5', traits: [1, 0, 0, 0] },
  { id: 'rahim', name: 'Rahim', role: 'The old gardener', bio: 'Forty years in this garden, and still owed back wages.', color: '#6a9a4b', traits: [0, 1, 1, 0] },
  { id: 'khanomjan', name: 'Khanom-jan', role: 'The old cook', bio: 'She knows every secret this house has.', color: '#d9823b', traits: [1, 1, 0, 1] },
  { id: 'farzad', name: 'Farzad', role: 'The family lawyer', bio: 'The only one who has read the will.', color: '#7b6fd0', traits: [1, 1, 1, 0] },
  { id: 'sima', name: 'Sima', role: 'The new nurse', bio: 'She arrived at the house only three months ago.', color: '#3fae96', traits: [0, 0, 1, 1] },
];

const WEAPONS = [
  { id: 'samovar', name: 'Brass samovar', icon: '🫖', clear: 'The brass samovar is still warm and brewing tea — not a dent or stain on it. The samovar is not the weapon.' },
  { id: 'knife', name: 'Fruit knife', icon: '🔪', clear: 'The fruit knife was found by the pomegranate bowl, with juice on it, not blood. The knife is not the weapon.' },
  { id: 'hafez', name: 'Book of Hafez', icon: '📖', clear: 'The book of Hafez lies open on its stand, its leather cover without a scratch. The book is not the weapon.' },
  { id: 'shawl', name: 'Termeh shawl', icon: '🧣', clear: 'The termeh shawl is folded in its chest without a single crease. The shawl is not the weapon.' },
  { id: 'poison', name: 'Rat poison', icon: '🧪', clear: 'The tin of rat poison in the storeroom is still sealed. The poison is not the weapon.' },
  { id: 'hookah', name: 'Crystal ghalyan', icon: '🪔', clear: 'The crystal ghalyan sits intact in the courtyard, its coal still glowing. The ghalyan is not the weapon.' },
];

const ROOMS = [
  { id: 'library', name: 'Library', icon: '📚', clear: 'The dust on the library floor is undisturbed — nobody has been in since afternoon. The murder did not happen in the library.' },
  { id: 'kitchen', name: 'Kitchen', icon: '🍲', clear: 'The kitchen was busy until midnight, with a pot of ash-reshteh on the stove. The murder did not happen in the kitchen.' },
  { id: 'howz', name: 'Pool house', icon: '⛲', clear: "The pool house was locked and its key was in Agha-bozorg's waistcoat pocket. The murder did not happen in the pool house." },
  { id: 'shahneshin', name: 'Shahneshin', icon: '🕯️', clear: 'Guests read Hafez fortunes in the shahneshin until late, never alone. The murder did not happen in the shahneshin.' },
  { id: 'sardab', name: 'Cellar', icon: '🕸️', clear: 'The cobwebs on the cellar stairs are intact — nobody went down tonight. The murder did not happen in the cellar.' },
  { id: 'garden', name: 'Pomegranate garden', icon: '🌳', clear: 'The fresh snow in the pomegranate garden has no footprints. The murder did not happen in the garden.' },
];

const ALIBI_TEMPLATES = [
  "From eleven until one, {X}'s voice is on the answering machine — on a long call to Tehran. {X} cannot be the killer.",
  'A taxi driver swears he drove {X} back from the corner pharmacy at midnight. {X} cannot be the killer.',
  'The family photographer took a picture of {X} by the Yalda spread at exactly midnight. {X} cannot be the killer.',
];

const MOTIVE_TEMPLATES = [
  "A letter was found in {X}'s coat pocket: “Tomorrow I cut you out of the will.” Signed: Agha-bozorg.",
  "Agha-bozorg's account book shows {X} owed him a large sum.",
  'A servant heard Agha-bozorg and {X} shouting at each other at ten o’clock.',
];

const NOTHING_FOUND = 'You searched everywhere, but found nothing new.';
const HALLWAY_NOTE = 'The room was empty — you found this in the hallway.';

const MISSIONS = [
  { id: 'suspicious', title: 'Innocent suspect', text: 'Get at least 2 votes in the final accusation.' },
  { id: 'guardian', title: 'Guardian angel', text: "Don't let {T} get a single vote in the final accusation.", needsTarget: true },
  { id: 'silent', title: 'Golden silence', text: 'Never show a clue on the TV.' },
  { id: 'herald', title: 'Town crier', text: 'Show at least 3 clues on the TV.' },
  { id: 'shadow', title: 'Shadow', text: 'Search the same room all three rounds.' },
  { id: 'unseen', title: 'Invisible', text: 'Never get pulled in for interrogation.' },
  { id: 'stubborn', title: 'Stubborn', text: 'Vote for the same person in both interrogations and the final accusation.' },
  { id: 'pointer', title: 'Pointing finger', text: 'Get {T} the most votes in one of the interrogations.', needsTarget: true },
];

const PHASE_TITLES = {
  lobby: 'Lobby',
  intro: 'That night',
  search: 'Search',
  discuss: 'Discussion',
  vote: 'Interrogation',
  spotlight: 'In the spotlight',
  final: 'Final accusation',
  reveal: 'The reveal',
  results: 'Results',
};

// ------------------------------------------------------------------
// Mode 2: Hand to Hand

const ITEMS_STORY = {
  title: 'Hand to Hand',
  subtitle: 'The knife changes hands. Who had it first?',
  intro: [
    'Yalda night at the Farahmand mansion. Around the spread, everyone is holding something.',
    'When the lights came back on, Agha-bozorg was no longer breathing.',
    'Whoever started the night holding a knife is a killer — but the knives have been changing hands ever since.',
    "It doesn't matter who holds a knife now. What matters is who had it first.",
  ],
};

const KNIFE = { id: 'knife', name: 'Knife', icon: '🔪' };
const ITEMS = [
  { id: 'glasses', name: 'Glasses', icon: '👓' },
  { id: 'tea', name: 'Glass of tea', icon: '🍵' },
  { id: 'hafez', name: 'Book of Hafez', icon: '📖' },
  { id: 'candle', name: 'Candle', icon: '🕯️' },
  { id: 'key', name: 'Cellar key', icon: '🔑' },
  { id: 'watermelon', name: 'Watermelon slice', icon: '🍉' },
  { id: 'tasbih', name: 'Prayer beads', icon: '📿' },
  { id: 'shawl', name: 'Termeh shawl', icon: '🧣' },
  { id: 'nuts', name: 'Bowl of nuts', icon: '🥜' },
  { id: 'phone', name: 'Phone', icon: '📱' },
  { id: 'nazar', name: 'Evil-eye charm', icon: '🧿' },
  { id: 'mirror', name: 'Hand mirror', icon: '🪞' },
  { id: 'grapes', name: 'Bunch of grapes', icon: '🍇' },
  { id: 'gift', name: 'Yalda gift', icon: '🎁' },
];

const SECRET_ACTIONS = {
  snoop: { name: 'Snoop', icon: '🕵️', text: "Secretly see what someone is holding right now." },
  swap: { name: 'Swap', icon: '🔄', text: 'Your item is exchanged with a random player’s item.' },
  steal: { name: 'Steal', icon: '🫳', text: "Take someone's item and leave yours in its place." },
  shuffle: { name: 'Shuffle', icon: '🔀', text: 'Exchange the items of two other players. Yours stays put.' },
};

const GOSSIP_QUESTIONS = [
  'Who has the most suspicious laugh?',
  'Who has eaten the most nuts tonight?',
  'Who lies most easily?',
  'If Agha-bozorg left everything to one person, who would it be?',
  'Who looks at their phone the most?',
  'Who is a little too calm tonight?',
  'Who is the best actor here?',
  'If the lights went out, who would scream first?',
  'Who would you never tell a secret?',
  'Who falls asleep first?',
  'Who swears on things the most?',
  'Who would win at hide-and-seek?',
  'Who could eat a whole watermelon alone?',
  'Who is trying hardest to look innocent?',
  'Who is the best detective here?',
  'Who apologises for no reason?',
  'Who gossips about everyone first?',
  'Who looks like they are hiding something?',
  'Whose Hafez fortune always comes out badly?',
  'Who drinks the most tea?',
  'If someone had the key to every door in the mansion, who would it be?',
  'Who never takes sides in a family fight?',
  'Who is always the last to leave a party?',
  'Who praised Agha-bozorg the most?',
];

const ITEM_PHASE_TITLES = {
  lobby: 'Lobby',
  intro: 'Nightfall',
  gossip: 'Gossip',
  gossipResult: 'Gossip results',
  discuss: 'Discussion',
  final: 'Final vote',
  reveal: 'The reveal',
  results: 'Results',
};

const MODES = [
  { id: 'classic', name: 'The Last Feast', text: "Search for clues, catch the killer's lies, and name the killer, the weapon and the room." },
  { id: 'items', name: 'Hand to Hand', text: 'Whoever starts with a knife is a killer. Items change hands in secret — trace the knife back to the start.' },
];

// Portraits are emoji keys shared with content.js (they are drawn by faces.js).
const { PORTRAITS } = require('./content');

module.exports = {
  STORY, TRAITS, CHARACTERS, WEAPONS, ROOMS,
  ALIBI_TEMPLATES, MOTIVE_TEMPLATES, NOTHING_FOUND, HALLWAY_NOTE,
  MISSIONS, PHASE_TITLES,
  ITEMS_STORY, KNIFE, ITEMS, SECRET_ACTIONS, GOSSIP_QUESTIONS, ITEM_PHASE_TITLES, MODES, PORTRAITS,
};
