import * as React from 'react';
import {
  Shimmer,
  ShimmerElementType,
  type IShimmerElement
} from '@fluentui/react';

import styles from './SkeletonLoader.module.scss';

export interface ISkeletonLoaderProps {
  cardCount?: number;
  label: string;
  rowCount?: number;
  showHero?: boolean;
}

const CARD_SHIMMER_ELEMENTS: IShimmerElement[] = [
  {
    height: 36,
    type: ShimmerElementType.circle
  },
  {
    type: ShimmerElementType.gap,
    width: 12
  },
  {
    height: 12,
    type: ShimmerElementType.line,
    width: '65%'
  }
];

const ROW_SHIMMER_ELEMENTS: IShimmerElement[] = [
  {
    height: 12,
    type: ShimmerElementType.line,
    width: '24%'
  },
  {
    type: ShimmerElementType.gap,
    width: '8%'
  },
  {
    height: 12,
    type: ShimmerElementType.line,
    width: '30%'
  },
  {
    type: ShimmerElementType.gap,
    width: '8%'
  },
  {
    height: 12,
    type: ShimmerElementType.line,
    width: '30%'
  }
];

const getSafeCount = (value: number | undefined, fallback: number): number => {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(12, Math.max(1, Math.floor(value)));
};

export const SkeletonLoader: React.FC<ISkeletonLoaderProps> = ({
  cardCount,
  label,
  rowCount,
  showHero = false
}) => {
  const cardIndexes = Array.from(
    { length: getSafeCount(cardCount, 3) },
    (_, index) => index
  );
  const rowIndexes = Array.from(
    { length: getSafeCount(rowCount, 5) },
    (_, index) => index
  );

  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className={styles.skeletonLoader}
      role="status"
    >
      <span className={styles.screenReaderText}>{label}</span>

      <div className={styles.heading}>
        <Shimmer width="38%" />
        <Shimmer width="62%" />
      </div>

      {showHero && (
        <div className={styles.hero}>
          <Shimmer width="30%" />
          <Shimmer width="48%" />
          <Shimmer width="72%" />
        </div>
      )}

      <div className={styles.cardGrid}>
        {cardIndexes.map((index) => (
          <div className={styles.card} key={`skeleton-card-${index}`}>
            <Shimmer shimmerElements={CARD_SHIMMER_ELEMENTS} width="100%" />
            <Shimmer width="52%" />
            <Shimmer width="78%" />
          </div>
        ))}
      </div>

      <div className={styles.table}>
        <Shimmer width="28%" />
        {rowIndexes.map((index) => (
          <div className={styles.row} key={`skeleton-row-${index}`}>
            <Shimmer shimmerElements={ROW_SHIMMER_ELEMENTS} width="100%" />
          </div>
        ))}
      </div>
    </section>
  );
};

export default SkeletonLoader;
