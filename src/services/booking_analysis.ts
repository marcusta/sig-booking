import { and, gte, lt } from "drizzle-orm";
import { db } from "../db/db";
import type { Booking } from "../db/schema";
import { bookings } from "../db/schema";

export interface CustomerBookingSummary {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  totalBookings: number;
  totalBookingHours: number;
  primeTimeHours: number;
  regularHours: number;
}

export interface BayUtilization {
  bayNumber: number;
  courtId: string;
  totalBookings: number;
  totalHours: number;
  utilizationPercentage: number;
}

// Map court IDs to bay numbers
function courtIdToBayNumber(courtId: string): number {
  const mapping: Record<string, number> = {
    "2068": 1,
    "2069": 2,
    "2074": 3,
    "2071": 4,
    "2072": 5,
    "2070": 6,
    "2076": 7,
    "2077": 8,
  };
  return mapping[courtId] || 0;
}

// Helper function to check if a given time is prime time
function isPrimeTime(date: Date): boolean {
  const hour = date.getHours();
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  if (isWeekend) {
    return hour >= 8 && hour < 18; // 8 AM to 6 PM
  } else {
    return hour >= 16 && hour < 21; // 4 PM to 9 PM
  }
}

// Helper function to calculate prime/regular hours for a booking time range
function calculatePrimeRegularHours(
  startTime: Date,
  endTime: Date
): {
  primeHours: number;
  regularHours: number;
} {
  let primeHours = 0;
  let regularHours = 0;

  // Check each hour of the booking
  let currentTime = new Date(startTime);
  while (currentTime < endTime) {
    const nextHour = new Date(currentTime);
    nextHour.setHours(nextHour.getHours() + 1);

    // If next hour would exceed end time, use end time instead
    const endOfSegment = nextHour > endTime ? endTime : nextHour;
    const segmentHours =
      (endOfSegment.getTime() - currentTime.getTime()) / (1000 * 60 * 60);

    if (isPrimeTime(currentTime)) {
      primeHours += segmentHours;
    } else {
      regularHours += segmentHours;
    }

    currentTime = nextHour;
  }

  return { primeHours, regularHours };
}

export async function getMonthlyBookingSummary(
  year: number,
  month: number
): Promise<{
  customerSummaries: CustomerBookingSummary[];
  bayUtilizations: BayUtilization[];
  totalBookings: number;
  totalBookingHours: number;
  totalPrimeHours: number;
  totalRegularHours: number;
  uniqueCustomers: number;
}> {
  if (month < 1 || month > 12) {
    throw new Error("Invalid month. Month must be between 1 and 12.");
  }
  if (year < 2000 || year > 2100) {
    // Add some reasonable year bounds
    throw new Error("Invalid year. Year must be between 2000 and 2100.");
  }

  // Construct the start and end dates for the given month and year.
  const startDate = `${year}-${String(month).padStart(2, "0")}-01T00:00:00`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01T00:00:00`
      : `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00`;

  // Fetch bookings within the specified month
  const monthlyBookings: Booking[] = await db
    .select()
    .from(bookings)
    .where(
      and(gte(bookings.startTime, startDate), lt(bookings.startTime, endDate))
    );

  // Calculate hours per bay
  const bayStats: Record<string, { bookings: number; hours: number }> = {};
  const customerSummaries: Record<string, CustomerBookingSummary> = {};
  let totalBookings = 0;
  let totalBookingHours = 0;
  let totalPrimeHours = 0;
  let totalRegularHours = 0;

  for (const booking of monthlyBookings) {
    const startTime = new Date(booking.startTime);
    const endTime = new Date(booking.endTime);
    const bookingHours =
      (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    const { primeHours, regularHours } = calculatePrimeRegularHours(
      startTime,
      endTime
    );

    // Update bay statistics
    if (!bayStats[booking.courtId]) {
      bayStats[booking.courtId] = { bookings: 0, hours: 0 };
    }
    bayStats[booking.courtId].bookings++;
    bayStats[booking.courtId].hours += bookingHours;

    // Update customer statistics
    if (!customerSummaries[booking.customerId]) {
      customerSummaries[booking.customerId] = {
        customerId: booking.customerId,
        firstName: booking.firstName,
        lastName: booking.lastName,
        email: booking.email,
        totalBookings: 0,
        totalBookingHours: 0,
        primeTimeHours: 0,
        regularHours: 0,
      };
    }

    customerSummaries[booking.customerId].totalBookings++;
    customerSummaries[booking.customerId].totalBookingHours += bookingHours;
    customerSummaries[booking.customerId].primeTimeHours += primeHours;
    customerSummaries[booking.customerId].regularHours += regularHours;

    totalBookings++;
    totalBookingHours += bookingHours;
    totalPrimeHours += primeHours;
    totalRegularHours += regularHours;
  }

  // Calculate bay utilizations
  const daysInMonth = new Date(year, month, 0).getDate();
  const hoursPerDay = 19; // 5 AM to 12 PM
  const availableHoursPerBay = daysInMonth * hoursPerDay;

  const bayUtilizations: BayUtilization[] = Object.entries(bayStats).map(
    ([courtId, stats]) => ({
      bayNumber: courtIdToBayNumber(courtId),
      courtId,
      totalBookings: stats.bookings,
      totalHours: stats.hours,
      utilizationPercentage: (stats.hours / availableHoursPerBay) * 100,
    })
  );

  // Sort by bay number
  bayUtilizations.sort((a, b) => a.bayNumber - b.bayNumber);

  return {
    customerSummaries: Object.values(customerSummaries).sort(
      (a, b) => b.totalBookingHours - a.totalBookingHours
    ),
    bayUtilizations,
    totalBookings,
    totalBookingHours,
    totalPrimeHours,
    totalRegularHours,
    uniqueCustomers: Object.keys(customerSummaries).length,
  };
}
