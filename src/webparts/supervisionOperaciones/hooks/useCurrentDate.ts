import * as React from 'react';

const isSameCalendarDay = (first: Date, second: Date): boolean => (
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate()
);

/**
 * Mantiene vigentes las reglas de negocio basadas en el día incluso cuando
 * Humano Ops Hub permanece abierto durante el cambio de fecha.
 */
const useCurrentDate = (): Date => {
  const [currentDate, setCurrentDate] = React.useState<Date>(() => new Date());

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      const now = new Date();

      setCurrentDate((previousDate) => (
        isSameCalendarDay(previousDate, now) ? previousDate : now
      ));
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return currentDate;
};

export default useCurrentDate;
