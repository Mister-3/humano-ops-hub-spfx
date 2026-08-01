/**
 * Cuenta jornadas laborables equivalentes dentro de un rango inclusivo.
 * Lunes a viernes representan 1 jornada, sábado 0.5 y domingo 0.
 */
export const getWorkingDaysCount = (
  startDate: Date,
  endDate: Date
): number => {
  const normalizedStart = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );
  const normalizedEnd = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );

  if (
    Number.isNaN(normalizedStart.getTime()) ||
    Number.isNaN(normalizedEnd.getTime()) ||
    normalizedStart.getTime() > normalizedEnd.getTime()
  ) {
    return 0;
  }

  let workingDays = 0;
  const cursor = new Date(normalizedStart);

  while (cursor.getTime() <= normalizedEnd.getTime()) {
    const dayOfWeek = cursor.getDay();

    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      workingDays += 1;
    } else if (dayOfWeek === 6) {
      workingDays += 0.5;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return workingDays;
};
