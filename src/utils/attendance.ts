export function isSameLocalDay(isoA: string, isoB: string): boolean {
  const dateA = new Date(isoA);
  const dateB = new Date(isoB);

  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

export function filterTodayLogs<T extends { timestamp: string }>(logs: T[]): T[] {
  const today = new Date().toISOString();
  return logs.filter((log) => isSameLocalDay(log.timestamp, today));
}

export type AttendancePeriod = 'day' | 'week' | 'month';

export function filterLogsByPeriod<T extends { timestamp: string }>(
  logs: T[],
  period: AttendancePeriod,
): T[] {
  const now = new Date();

  return logs.filter((log) => {
    const logDate = new Date(log.timestamp);

    if (period === 'day') {
      return isSameLocalDay(log.timestamp, now.toISOString());
    }

    if (period === 'week') {
      const diffInMs = now.getTime() - logDate.getTime();
      const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
      return diffInDays >= 0 && diffInDays < 7;
    }

    const sameMonth =
      logDate.getFullYear() === now.getFullYear() &&
      logDate.getMonth() === now.getMonth();

    return sameMonth;
  });
}

export function sortLogsNewestFirst<T extends { timestamp: string }>(logs: T[]): T[] {
  return [...logs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}