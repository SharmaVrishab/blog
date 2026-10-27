import type { CollectionEntry } from "astro:content";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import config from "@/config";
import { postFilter } from "./postFilter";
import { getPostUrl } from "./getPostPaths";

dayjs.extend(utc);
dayjs.extend(timezone);

/** Columns in the graph, matching a GitHub-style trailing year. */
const WEEKS = 53;

export type ActivityPost = {
  title: string;
  href: string;
};

export type ActivityDay = {
  /** Calendar date in the site timezone, `YYYY-MM-DD`. */
  date: string;
  count: number;
  posts: ActivityPost[];
};

export type ActivityWeek = {
  /** Index 0 is Sunday. Null entries are days after today. */
  days: Array<ActivityDay | null>;
};

export type ActivityMonthLabel = {
  weekIndex: number;
  label: string;
};

export type PostActivity = {
  weeks: ActivityWeek[];
  total: number;
  monthLabels: ActivityMonthLabel[];
};

/**
 * Buckets published posts into a GitHub-style year, starting 53 weeks back
 * and running through the end of the current month.
 * Days are keyed in `config.site.timezone` from `pubDatetime` only.
 */
export function getPostActivity(
  posts: CollectionEntry<"posts">[],
  locale: string | undefined = config.site.lang
): PostActivity {
  const tz = config.site.timezone;
  const today = dayjs().tz(tz).startOf("day");
  const monthEnd = today.endOf("month").startOf("day");
  const weekStart = today.subtract(today.day(), "day");
  const endWeekStart = monthEnd.subtract(monthEnd.day(), "day");
  const rangeStart = weekStart.subtract(WEEKS - 1, "week");
  const totalWeeks = Math.round(endWeekStart.diff(rangeStart, "day") / 7) + 1;

  const byDay = new Map<string, ActivityPost[]>();

  for (const post of posts) {
    if (!postFilter(post)) continue;

    const published = dayjs(post.data.pubDatetime).tz(tz).startOf("day");
    if (
      published.isBefore(rangeStart, "day") ||
      published.isAfter(today, "day")
    ) {
      continue;
    }

    const key = published.format("YYYY-MM-DD");
    const dayPosts = byDay.get(key) ?? [];
    dayPosts.push({
      title: post.data.title,
      href: getPostUrl(post.id, post.filePath, locale),
    });
    byDay.set(key, dayPosts);
  }

  const weeks: ActivityWeek[] = [];

  for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
    const start = rangeStart.add(weekIndex, "week");
    const days: Array<ActivityDay | null> = [];

    for (let weekday = 0; weekday < 7; weekday++) {
      const day = start.add(weekday, "day");
      if (day.isAfter(monthEnd, "day")) {
        days.push(null);
        continue;
      }

      const date = day.format("YYYY-MM-DD");
      if (day.isAfter(today, "day")) {
        days.push({ date, count: 0, posts: [] });
        continue;
      }

      const dayPosts = byDay.get(date) ?? [];
      days.push({ date, count: dayPosts.length, posts: dayPosts });
    }

    weeks.push({ days });
  }

  return {
    weeks,
    total: [...byDay.values()].reduce(
      (sum, dayPosts) => sum + dayPosts.length,
      0
    ),
    monthLabels: monthLabels(weeks, locale, today.format("YYYY-MM-DD")),
  };
}

function monthName(date: string, locale: string | undefined) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * GitHub labels a month on the first week whose Sunday falls in that month,
 * and skips a name that would sit on top of the next one.
 * The current month is kept even when that rule would hide it.
 */
function monthLabels(
  weeks: ActivityWeek[],
  locale: string | undefined,
  today: string
): ActivityMonthLabel[] {
  const currentMonth = today.slice(0, 7);
  const labels: Array<ActivityMonthLabel & { month: string }> = [];
  let previousMonth = "";

  weeks.forEach((week, weekIndex) => {
    const firstDay = week.days.find(day => day !== null);
    if (!firstDay) return;

    const month = firstDay.date.slice(0, 7);
    if (month === previousMonth) return;

    labels.push({
      weekIndex,
      label: monthName(firstDay.date, locale),
      month,
    });
    previousMonth = month;
  });

  const spaced = labels.filter((label, index) => {
    if (label.month === currentMonth) return true;
    const next = labels[index + 1];
    if (!next) return true;
    return next.weekIndex - label.weekIndex >= 2;
  });

  if (!spaced.some(label => label.month === currentMonth)) {
    const weekIndex = weeks.findIndex(week =>
      week.days.some(day => day?.date.startsWith(currentMonth))
    );
    if (weekIndex < 0) {
      return spaced.map(({ weekIndex, label }) => ({ weekIndex, label }));
    }

    const withoutCollision = spaced.filter(
      label => weekIndex - label.weekIndex >= 2
    );
    withoutCollision.push({
      weekIndex,
      label: monthName(today, locale),
      month: currentMonth,
    });
    withoutCollision.sort((a, b) => a.weekIndex - b.weekIndex);
    return withoutCollision.map(({ weekIndex, label }) => ({
      weekIndex,
      label,
    }));
  }

  return spaced.map(({ weekIndex, label }) => ({ weekIndex, label }));
}
