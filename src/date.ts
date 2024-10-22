function toDateString(date: Date) {
  const localTime = new Date(
    date.getTime() - date.getTimezoneOffset() * 60 * 1000
  );
  return localTime.toISOString().slice(0, -1) + "+02:00";
}

function getExactHourFromNow(offset: number = 0): Date {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isUTC = timeZone === "UTC";

  // Create a date object for the current time in the local time zone
  const localNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Stockholm" })
  );

  // Calculate the offset from UTC in hours
  const utcOffset = -localNow.getTimezoneOffset() / 60;

  // Adjust for daylight saving time
  const isDST = isDaylightSavingTime(localNow);
  const dstOffset = isDST ? 1 : 0;

  /*console.log(
    "timeZone: ",
    timeZone,
    "isUTC: ",
    isUTC,
    " utcOffset: ",
    utcOffset,
    "dstOffset: ",
    dstOffset
  );*/

  const hour = new Date(
    localNow.getFullYear(),
    localNow.getMonth(),
    localNow.getDate(),
    localNow.getHours() + offset + (isUTC ? utcOffset + dstOffset : 0),
    0,
    0,
    0
  );
  return hour;
}

function isDaylightSavingTime(date: Date): boolean {
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  return (
    date.getTimezoneOffset() <
    Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset())
  );
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

export { getExactHourFromNow, isDaylightSavingTime, toDateString };
