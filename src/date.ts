function toDateString(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error("Invalid date provided to toDateString");
  }

  // Create a formatter for the Stockholm timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const dateParts: { [key: string]: string } = {};

  parts.forEach(({ type, value }) => {
    dateParts[type] = value;
  });

  // Construct the date string in the correct format
  const formattedDate = `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}+02:00`;

  return formattedDate;
}

export function toDateStringUTC(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error("Invalid date provided to toDateStringUTC");
  }

  // Get UTC components
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  // Return UTC time (Z suffix indicates UTC)
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}

// Helper function to validate dates
function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

function getExactHourFromNow(offset: number = 0): Date {
  const now = new Date();

  // Get current UTC hour
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  const utcDate = now.getUTCDate();
  const utcHour = now.getUTCHours();

  // Create new UTC date at exact hour
  const result = new Date(
    Date.UTC(utcYear, utcMonth, utcDate, utcHour + offset, 0, 0, 0)
  );

  return result;
}

export function isNearNewHour(
  beforeMinutes: number = 5,
  afterMinutes: number = 10
): { isJustBefore: boolean; isJustAfter: boolean } {
  const now = new Date();
  const minutes = now.getMinutes();
  const isJustBefore = minutes >= 60 - beforeMinutes;
  const isJustAfter = minutes < afterMinutes;

  return { isJustBefore, isJustAfter };
}

export { getExactHourFromNow, toDateString };
