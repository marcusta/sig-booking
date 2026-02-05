import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/db";
import { bookings, courseSuggestions } from "../db/schema";

export type SkillLevel = "beginner" | "intermediate" | "advanced";

const COURSES_BY_LEVEL: Record<SkillLevel, string[]> = {
  beginner: ["Paynes Vallye", "Pebble Beach", "Visby The One"],
  intermediate: [
    "Augusta National",
    "Tobacco Road",
    "Royal Portrush",
    "Spyglass Hill",
    "Greywolf",
    "Sequoyah National",
    "Brohof Stadium Course",
    "Linköping",
    "Torrey Pines",
    "Lofoten Links",
    "Jack's Point",
  ],
  advanced: [
    "TPC Sawgrass",
    "Bethpage Black",
    "Royal County Down",
    "Whistling Straits",
    "The Hills Course",
    "Quail Hollow Club",
    "Muirfield Village Golf Club",
    "The Fold at Eastwood",
    "Crumpin-Fox Golf Club",
    "Brohof Castle Course",
    "Vesterby",
    "Hitchcock Links",
    "Muskoka Bay Club",
    "Kauri Cliffs",
    "The Links at Spanish Bay",
    "TPC Scotsdale",
    "Friar's Head",
    "Old Macdonald Golf Course",
    "Sheep Ranch",
    "Chambers Bay",
  ],
};

export async function getSkillLevelForCustomer(
  customerId: string
): Promise<SkillLevel> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(bookings)
    .where(and(eq(bookings.customerId, customerId), eq(bookings.cancelled, false)));

  const totalBookings = Number(result[0]?.count ?? 0);

  if (totalBookings <= 8) {
    return "beginner";
  }
  if (totalBookings <= 20) {
    return "intermediate";
  }
  return "advanced";
}

export async function getCourseSuggestionForCustomer(
  customerId: string,
  level: SkillLevel
): Promise<string> {
  const courses = COURSES_BY_LEVEL[level];

  const previousSuggestions = await db
    .select({ course: courseSuggestions.course })
    .from(courseSuggestions)
    .where(
      and(
        eq(courseSuggestions.customerId, customerId),
        eq(courseSuggestions.level, level)
      )
    );

  const suggestedSet = new Set(previousSuggestions.map((row) => row.course));
  let course = courses.find((name) => !suggestedSet.has(name));

  if (!course) {
    await db
      .delete(courseSuggestions)
      .where(
        and(
          eq(courseSuggestions.customerId, customerId),
          eq(courseSuggestions.level, level)
        )
      );
    course = courses[0];
  }

  await db.insert(courseSuggestions).values({
    customerId,
    level,
    course: course ?? courses[0],
    suggestedAt: new Date().toISOString(),
  });

  return course ?? courses[0];
}
