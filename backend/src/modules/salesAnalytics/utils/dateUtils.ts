import { endOfDay, startOfDay, subDays, startOfMonth, subMonths, endOfMonth, startOfYear } from 'date-fns';

/**
 * Helper to ensure IST dates are correctly parsed for aggregation
 */
export const getISTDateRanges = () => {
  const now = new Date();
  // Adjust for IST (+5:30) if environment implies UTC timezone but we want IST boundaries
  // Note: For consistency with existing system, we'll use date-fns functions 
  // on the system's local time, assuming the server runs in IST or handles it via timezone configs.
  return { now };
};

export const parseDateFilter = (period?: string, startStr?: string, endStr?: string): { start: Date; end: Date } => {
  const now = new Date();
  let start = startOfDay(now);
  let end = endOfDay(now);

  if (period && period !== 'custom') {
    switch (period) {
      case 'today':
        start = startOfDay(now);
        break;
      case 'last7days':
        start = startOfDay(subDays(now, 6)); // 6 full days past + today
        break;
      case 'last30days':
        start = startOfDay(subDays(now, 29));
        break;
      case 'thisMonth':
        start = startOfMonth(now);
        break;
      case 'lastMonth':
        const lastMon = subMonths(now, 1);
        start = startOfMonth(lastMon);
        end = endOfMonth(lastMon);
        break;
      case 'last3months':
        start = startOfDay(subMonths(now, 3));
        break;
      case 'last6months':
        start = startOfDay(subMonths(now, 6));
        break;
      case 'thisYear':
        start = startOfYear(now);
        break;
      case 'all':
        start = new Date('2000-01-01'); // Arbitrary far past
        break;
      default:
        // Default to last 30 days
        start = startOfDay(subDays(now, 29));
    }
  } else if (startStr && endStr) {
    start = startOfDay(new Date(startStr));
    end = endOfDay(new Date(endStr));
  } else {
    // Default to last 30 days
    start = startOfDay(subDays(now, 29));
  }

  return { start, end };
};

export const getPreviousPeriod = (start: Date, end: Date): { start: Date; end: Date } => {
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1); // 1 ms before current start
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  
  return { start: prevStart, end: prevEnd };
};
