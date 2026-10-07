// Story content for the screens, in both languages: { fa: {...}, en: {...} },
// plus every classic story's bundle: { stories: { nowruz: { fa, en } } }.
// Each screen picks ALL.stories[state.story][state.lang] (Z.bundleFor).
// Used by server.js and the screen tests.
const C = require('./content');
const CE = require('./content.en');
const { STORIES } = require('./game');

function screenContent(joinUrl) {
  const bundle = (L) => ({
    story: L.STORY, traits: L.TRAITS, characters: L.CHARACTERS,
    weapons: L.WEAPONS, rooms: L.ROOMS, phaseTitles: L.PHASE_TITLES, hallwayNote: L.HALLWAY_NOTE, joinUrl,
    modes: L.MODES, itemsStory: L.ITEMS_STORY, items: [L.KNIFE, ...L.ITEMS], knifeId: L.KNIFE.id,
    secretActions: L.SECRET_ACTIONS, itemPhaseTitles: L.ITEM_PHASE_TITLES, portraits: L.PORTRAITS,
  });
  return {
    fa: bundle(C),
    en: bundle(CE),
    stories: Object.fromEntries(Object.entries(STORIES).map(([id, L]) => [id, { fa: bundle(L.fa), en: bundle(L.en) }])),
  };
}

module.exports = { screenContent };
