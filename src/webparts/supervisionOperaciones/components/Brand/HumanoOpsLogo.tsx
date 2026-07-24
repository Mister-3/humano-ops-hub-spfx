import * as React from 'react';

export interface IHumanoOpsLogoProps {
  className?: string;
  size?: number;
}

/**
 * Isotipo de Humano Ops Hub: representa personas conectadas por un pulso
 * operativo. Está diseñado para mantener contraste sobre superficies oscuras.
 */
export const HumanoOpsLogo: React.FC<IHumanoOpsLogoProps> = ({
  className,
  size = 42
}) => {
  const resolvedSize = size > 0 ? size : 42;

  return (
    <svg
      aria-label="Humano Ops Hub: personas y pulso operativo"
      className={className}
      height={resolvedSize}
      role="img"
      viewBox="0 0 48 48"
      width={resolvedSize}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Humano Ops Hub</title>
      <rect
        fill="#121214"
        height="44"
        rx="12"
        stroke="#2f2f36"
        strokeWidth="1.5"
        width="44"
        x="2"
        y="2"
      />

      <circle cx="18" cy="15.5" fill="#00a4ef" r="4" />
      <circle cx="30.5" cy="14.5" fill="#0078d4" r="3.5" />
      <path
        d="M10.5 28.2c.8-5.2 3.6-8.1 7.5-8.1 3.6 0 6.2 2.3 7.2 6.7"
        fill="none"
        opacity=".88"
        stroke="#00a4ef"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M25.4 25.2c1-4 2.8-6.2 5.4-6.2 3.3 0 5.4 2.6 6.1 7"
        fill="none"
        opacity=".78"
        stroke="#0078d4"
        strokeLinecap="round"
        strokeWidth="3"
      />

      <path
        d="M7 31h7.2l3.2-5.1 4.4 11.2 5.1-15.8 4.1 9.7h10"
        fill="none"
        stroke="#00a4ef"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
      <circle cx="41" cy="31" fill="#0078d4" r="1.8" />
    </svg>
  );
};
