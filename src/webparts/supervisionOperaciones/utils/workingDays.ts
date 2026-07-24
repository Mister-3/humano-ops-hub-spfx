/**
 * Counts calendar days in an inclusive range, excluding Sundays only.
 *
 * Humano Ops Hub operates Monday through Saturday, so Saturdays are treated
 * as regular working days for proportional productivity goals.
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
    if (cursor.getDay() !== 0) {
      workingDays += 1;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return workingDays;
};
