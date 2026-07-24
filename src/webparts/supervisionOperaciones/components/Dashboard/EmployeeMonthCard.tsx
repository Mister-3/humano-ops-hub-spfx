import * as React from 'react';
import {
  Icon,
  Persona,
  PersonaSize,
  Stack,
  Text
} from '@fluentui/react';

import type { IKudoMedal } from './KudoMedals';
import styles from './EmployeeMonthCard.module.scss';

export interface IEmployeeMonthCardProps {
  agenteNombre: string;
  conceptoKudo: string;
  dedicatoria: string;
  medals: ReadonlyArray<IKudoMedal>;
  mesAno: string;
  puntosTotales: number;
  previewLabel?: string;
}

const formatPoints = (value: number): string => value.toLocaleString(
  'es-DO',
  {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }
);

export const EmployeeMonthCard: React.FC<IEmployeeMonthCardProps> = ({
  agenteNombre,
  conceptoKudo,
  dedicatoria,
  medals,
  mesAno,
  puntosTotales,
  previewLabel
}) => (
  <Stack className={styles.card} tokens={{ childrenGap: 18 }}>
    {previewLabel ? (
      <Text className={styles.previewLabel}>{previewLabel}</Text>
    ) : null}

    <Text className={styles.title}>
      🏆 Empleado del Mes - {mesAno}
    </Text>

    <Stack
      className={styles.identityRow}
      horizontal
      verticalAlign="center"
      tokens={{ childrenGap: 20 }}
    >
      <Persona
        hidePersonaDetails
        size={PersonaSize.size100}
        text={agenteNombre}
      />
      <Stack className={styles.identityContent} tokens={{ childrenGap: 6 }}>
        <Text className={styles.agentName}>{agenteNombre}</Text>
        <Text className={styles.concept}>{conceptoKudo}</Text>
        <Text className={styles.score}>
          Puntaje Total: <strong>{formatPoints(puntosTotales)}</strong>
        </Text>
      </Stack>
    </Stack>

    <Stack tokens={{ childrenGap: 8 }}>
      <Text className={styles.sectionLabel}>
        Medallas de Kudos del período
      </Text>
      {medals.length > 0 ? (
        <div className={styles.medalRow}>
          {medals.map((medal) => (
            <span
              className={styles.medal}
              key={medal.attribute}
              title={`${medal.points} puntos en ${medal.attribute}`}
            >
              <Icon
                className={styles.medalIcon}
                iconName={medal.iconName}
              />
              <span className={styles.medalText}>{medal.attribute}</span>
              <span className={styles.medalCount}>×{medal.count}</span>
            </span>
          ))}
        </div>
      ) : (
        <Text className={styles.emptyMedals}>
          No hay medallas registradas para este período.
        </Text>
      )}
    </Stack>

    {dedicatoria.trim() ? (
      <Stack className={styles.dedication} tokens={{ childrenGap: 5 }}>
        <Text className={styles.sectionLabel}>
          💬 Palabras de Reconocimiento:
        </Text>
        <Text className={styles.dedicationText}>
          “{dedicatoria.trim()}”
        </Text>
      </Stack>
    ) : null}
  </Stack>
);

export default EmployeeMonthCard;
