export interface IKudoMedalSource {
  Atributo?: string;
  Puntos?: number;
}

export interface IKudoMedal {
  attribute: string;
  iconName: string;
  count: number;
  points: number;
}

interface IKudoMedalDefinition {
  attribute: string;
  iconName: string;
}

const normalizeAttribute = (value: string): string => value
  .trim()
  .replace(/\s+/g, ' ')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase();

const MEDAL_DEFINITIONS: ReadonlyArray<IKudoMedalDefinition> = [
  { attribute: 'Empatía', iconName: 'Heart' },
  { attribute: 'Agilidad', iconName: 'LightningBolt' },
  { attribute: 'Pensamiento digital', iconName: 'Devices3' },
  { attribute: 'Orientado al negocio', iconName: 'Briefcase' },
  { attribute: 'Resolución de problemas', iconName: 'Lightbulb' },
  { attribute: 'Trabajo en equipo', iconName: 'Group' }
];

export const getKudoMedalDefinition = (
  attribute?: string
): IKudoMedalDefinition => {
  const trimmedAttribute = attribute?.trim() || '';
  const normalizedAttribute = normalizeAttribute(trimmedAttribute);
  const knownDefinition = MEDAL_DEFINITIONS.find(
    (definition) =>
      normalizeAttribute(definition.attribute) === normalizedAttribute
  );

  return knownDefinition || {
    attribute: trimmedAttribute || 'Reconocimiento',
    iconName: 'Trophy'
  };
};

export const buildKudoMedals = (
  kudos: ReadonlyArray<IKudoMedalSource>
): IKudoMedal[] => {
  const accumulated: { [key: string]: IKudoMedal } = {};

  kudos.forEach((kudo) => {
    const definition = getKudoMedalDefinition(kudo.Atributo);
    const key = normalizeAttribute(definition.attribute);
    const points = typeof kudo.Puntos === 'number' &&
      Number.isFinite(kudo.Puntos)
      ? kudo.Puntos
      : 0;

    if (!accumulated[key]) {
      accumulated[key] = {
        ...definition,
        count: 0,
        points: 0
      };
    }

    accumulated[key].count += 1;
    accumulated[key].points += points;
  });

  return Object.keys(accumulated)
    .map((key) => accumulated[key])
    .sort((first, second) => (
      second.count - first.count ||
      second.points - first.points ||
      first.attribute.localeCompare(second.attribute)
    ));
};
