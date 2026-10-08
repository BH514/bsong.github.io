export interface Choice {
  readonly id: string;
  readonly text: string;
  readonly label: string;
  readonly weight: number;
  readonly next?: DecisionNode;
}

export interface DecisionNode {
  readonly id: string;
  readonly choices: readonly Choice[];
}

export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly prompt: string;
  readonly root: DecisionNode;
  readonly rulePath: readonly string[];
}

interface Piece {
  readonly id: string;
  readonly text: string;
  readonly label: string;
}

interface StoryRecipe {
  id: string;
  name: string;
  prompt: string;
  adjectives: readonly Choice[];
  objects: readonly Piece[];
  endings: readonly Piece[];
  objectWeights: readonly (readonly number[])[];
  endingWeights: readonly (readonly number[])[];
  rulePath: readonly string[];
}

function weightAt(matrix: readonly (readonly number[])[], row: number, column: number): number {
  const weight = matrix[row]?.[column];
  if (weight === undefined) throw new Error('A story transition is missing its probability weight.');
  return weight;
}

function makeStory(recipe: StoryRecipe): Scenario {
  const endings = recipe.objects.map((object, objectIndex): DecisionNode => ({
    id: `${recipe.id}-${object.id}-ending`,
    choices: recipe.endings.map((ending, endingIndex) => ({
      ...ending,
      weight: weightAt(recipe.endingWeights, objectIndex, endingIndex),
    })),
  }));

  return {
    id: recipe.id,
    name: recipe.name,
    prompt: recipe.prompt,
    rulePath: recipe.rulePath,
    root: {
      id: `${recipe.id}-start`,
      choices: recipe.adjectives.map((adjective, adjectiveIndex) => ({
        ...adjective,
        next: {
          id: `${recipe.id}-${adjective.id}-object`,
          choices: recipe.objects.map((object, objectIndex) => {
            const next = endings[objectIndex];
            if (!next) throw new Error('A story object is missing its ending choices.');
            return {
              ...object,
              weight: weightAt(recipe.objectWeights, adjectiveIndex, objectIndex),
              next,
            };
          }),
        },
      })),
    },
  };
}

export const SCENARIOS: readonly Scenario[] = [
  makeStory({
    id: 'robot',
    name: 'The tiny robot',
    prompt: 'The tiny robot discovered a',
    adjectives: [
      { id: 'glowing', text: 'glowing', label: 'glowing', weight: 55 },
      { id: 'hidden', text: 'hidden', label: 'hidden', weight: 30 },
      { id: 'forgotten', text: 'forgotten', label: 'forgotten', weight: 15 },
    ],
    objects: [
      { id: 'garden', text: 'garden', label: 'garden' },
      { id: 'portal', text: 'portal', label: 'portal' },
      { id: 'key', text: 'key', label: 'key' },
    ],
    endings: [
      { id: 'city', text: 'beneath the city.', label: 'city' },
      { id: 'clouds', text: 'above the clouds.', label: 'clouds' },
      { id: 'stars', text: 'between the stars.', label: 'stars' },
    ],
    objectWeights: [[50, 30, 20], [30, 20, 50], [20, 25, 55]],
    endingWeights: [[55, 30, 15], [20, 30, 50], [60, 25, 15]],
    rulePath: ['hidden', 'key', 'city'],
  }),
  makeStory({
    id: 'ocean',
    name: 'Beneath the surface',
    prompt: 'The diver stumbled upon a',
    adjectives: [
      { id: 'shimmering', text: 'shimmering', label: 'shimmering', weight: 50 },
      { id: 'silent', text: 'silent', label: 'silent', weight: 35 },
      { id: 'sunken', text: 'sunken', label: 'sunken', weight: 15 },
    ],
    objects: [
      { id: 'palace', text: 'palace', label: 'palace' },
      { id: 'garden', text: 'garden', label: 'garden' },
      { id: 'doorway', text: 'doorway', label: 'doorway' },
    ],
    endings: [
      { id: 'reef', text: 'inside a coral reef.', label: 'reef' },
      { id: 'whale', text: 'beside a sleeping whale.', label: 'whale' },
      { id: 'blue', text: 'beyond the blue.', label: 'blue' },
    ],
    objectWeights: [[55, 30, 15], [25, 50, 25], [40, 15, 45]],
    endingWeights: [[60, 25, 15], [45, 40, 15], [15, 25, 60]],
    rulePath: ['silent', 'garden', 'reef'],
  }),
  makeStory({
    id: 'space',
    name: 'Beyond the last star',
    prompt: 'Beyond the last star, we found a',
    adjectives: [
      { id: 'drifting', text: 'drifting', label: 'drifting', weight: 60 },
      { id: 'secret', text: 'secret', label: 'secret', weight: 25 },
      { id: 'sleeping', text: 'sleeping', label: 'sleeping', weight: 15 },
    ],
    objects: [
      { id: 'planet', text: 'planet', label: 'planet' },
      { id: 'station', text: 'station', label: 'station' },
      { id: 'library', text: 'library', label: 'library' },
    ],
    endings: [
      { id: 'time', text: 'at the edge of time.', label: 'time' },
      { id: 'moon', text: 'behind a violet moon.', label: 'moon' },
      { id: 'stars', text: 'where the stars begin.', label: 'stars' },
    ],
    objectWeights: [[55, 30, 15], [20, 50, 30], [35, 20, 45]],
    endingWeights: [[55, 30, 15], [25, 55, 20], [25, 20, 55]],
    rulePath: ['secret', 'station', 'moon'],
  }),
];
