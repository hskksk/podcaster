import "server-only";

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { getRepoRoot } from "../repo-root";
import {
  lessonModeLabel,
  parseLessonFile,
  resolveLessonMode,
  textLabelFromFrontmatter,
  todayLabelFromFrontmatter,
  type LessonCast,
  type LessonMode,
  type WeekOutlineEntry,
} from "./lesson-meta";
import { jukenPlainTextFromTree } from "./plain-text";
import { prepareJukenMarkdoc } from "./prepare";

const SEGMENT = /^[\w.-]+$/;
const WEEK_DIR = /^(\d{4})-(\d{2})-(\d{2})$/;
const LESSON_FILE = /^(月曜|火曜|水曜|木曜|金曜)_(.+)\.mdoc$/;

export const WEEKDAYS = [
  { id: "mon", label: "月", long: "月曜日", filePrefix: "月曜" },
  { id: "tue", label: "火", long: "火曜日", filePrefix: "火曜" },
  { id: "wed", label: "水", long: "水曜日", filePrefix: "水曜" },
  { id: "thu", label: "木", long: "木曜日", filePrefix: "木曜" },
  { id: "fri", label: "金", long: "金曜日", filePrefix: "金曜" },
] as const;

export type WeekdayId = (typeof WEEKDAYS)[number]["id"];

export type JukenLesson = {
  school: string;
  course: string;
  courseTitle: string;
  series: string;
  week: string;
  day: WeekdayId;
  weekdayLabel: string;
  weekdayLong: string;
  theme: string;
  textLabel: string;
  todayLabel: string;
  mode: LessonMode;
  modeLabel: string;
  href: string;
  source: string;
  cast: LessonCast;
  plainText: string;
};

export type JukenWeek = {
  school: string;
  course: string;
  courseTitle: string;
  week: string;
  textLabel: string;
  href: string;
  lessons: JukenLesson[];
};

export type JukenCourse = {
  school: string;
  course: string;
  title: string;
  schoolLabel: string;
  grade: string;
  subject: string;
  summary: string;
  series: string;
  href: string;
  weeks: JukenWeek[];
};

type CourseMeta = {
  title: string;
  schoolLabel: string;
  grade: string;
  subject: string;
  summary: string;
  series: string;
};

function jukenRoot(): string {
  return path.join(getRepoRoot(), "chugaku-juken");
}

function clean(text: string): string {
  return text.replace(/[\0-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? clean(value) : fallback;
}

function weekdayIndex(id: WeekdayId): number {
  return WEEKDAYS.findIndex((day) => day.id === id);
}

export function formatWeekLabel(iso: string): string {
  const match = WEEK_DIR.exec(iso);
  if (!match) return iso;
  return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日の週`;
}

export function courseHref(school: string, course: string): string {
  return `/juken/${encodeURIComponent(school)}/${encodeURIComponent(course)}`;
}

export function weekHref(school: string, course: string, week: string): string {
  return `${courseHref(school, course)}/${encodeURIComponent(week)}`;
}

export function lessonHref(school: string, course: string, week: string, day: WeekdayId): string {
  return `${weekHref(school, course, week)}/${day}`;
}

function loadCourseMeta(file: string, course: string): CourseMeta {
  const fallback: CourseMeta = {
    title: course,
    schoolLabel: "",
    grade: "",
    subject: "",
    summary: "",
    series: "",
  };
  if (!fs.existsSync(file)) return fallback;
  try {
    const raw = yaml.load(fs.readFileSync(file, "utf8"));
    if (!raw || typeof raw !== "object") return fallback;
    const record = raw as Record<string, unknown>;
    return {
      title: readString(record.title, fallback.title),
      schoolLabel: readString(record.schoolLabel, ""),
      grade: readString(record.grade, ""),
      subject: readString(record.subject, ""),
      summary: readString(record.summary, ""),
      series: readString(record.series, ""),
    };
  } catch (error) {
    console.warn(`[juken] course.yml unreadable at ${file}`, error);
    return fallback;
  }
}

function lessonFromFile(props: {
  filePath: string;
  filename: string;
  school: string;
  course: string;
  courseTitle: string;
  series: string;
  week: string;
  weekOutline?: WeekOutlineEntry[];
}): JukenLesson | null {
  const match = LESSON_FILE.exec(props.filename);
  if (!match) return null;
  const weekday = WEEKDAYS.find((day) => day.filePrefix === match[1]);
  if (!weekday) return null;
  const source = fs.readFileSync(props.filePath, "utf8");
  const parsed = parseLessonFile(source);
  const { content } = prepareJukenMarkdoc(source);
  const mode = resolveLessonMode(weekday.id, parsed.frontmatter, props.weekOutline);
  return {
    school: props.school,
    course: props.course,
    courseTitle: props.courseTitle,
    series: props.series,
    week: props.week,
    day: weekday.id,
    weekdayLabel: weekday.label,
    weekdayLong: weekday.long,
    theme: clean(match[2] ?? ""),
    textLabel: clean(textLabelFromFrontmatter(parsed.frontmatter)),
    todayLabel: clean(todayLabelFromFrontmatter(parsed.frontmatter)),
    mode,
    modeLabel: lessonModeLabel(mode),
    href: lessonHref(props.school, props.course, props.week, weekday.id),
    source,
    cast: parsed.frontmatter.cast,
    plainText: jukenPlainTextFromTree(content),
  };
}

function readCatalog(): JukenCourse[] {
  const root = jukenRoot();
  if (!fs.existsSync(root)) {
    console.warn(`[juken] missing at ${root} (cwd=${process.cwd()})`);
    return [];
  }

  const courses: JukenCourse[] = [];
  for (const schoolDir of fs.readdirSync(root, { withFileTypes: true })) {
    if (!schoolDir.isDirectory() || !SEGMENT.test(schoolDir.name)) continue;
    const schoolPath = path.join(root, schoolDir.name);
    for (const courseDir of fs.readdirSync(schoolPath, { withFileTypes: true })) {
      if (!courseDir.isDirectory() || !SEGMENT.test(courseDir.name)) continue;
      const coursePath = path.join(schoolPath, courseDir.name);
      const meta = loadCourseMeta(path.join(coursePath, "course.yml"), courseDir.name);
      const weeksPath = path.join(coursePath, "weeks");
      const weeks: JukenWeek[] = [];
      if (fs.existsSync(weeksPath)) {
        for (const weekDir of fs.readdirSync(weeksPath, { withFileTypes: true })) {
          if (!weekDir.isDirectory() || !WEEK_DIR.test(weekDir.name)) continue;
          const weekPath = path.join(weeksPath, weekDir.name);
          const weekFiles = fs
            .readdirSync(weekPath, { withFileTypes: true })
            .filter((entry) => entry.isFile() && entry.name.endsWith(".mdoc"));
          const mondayEntry = weekFiles.find((entry) => entry.name.startsWith("月曜_"));
          const weekOutline = mondayEntry
            ? parseLessonFile(
                fs.readFileSync(path.join(weekPath, mondayEntry.name), "utf8"),
              ).frontmatter.weekOutline
            : undefined;
          const lessons = weekFiles
            .map((entry) =>
              lessonFromFile({
                filePath: path.join(weekPath, entry.name),
                filename: entry.name,
                school: schoolDir.name,
                course: courseDir.name,
                courseTitle: meta.title,
                series: meta.series,
                week: weekDir.name,
                weekOutline,
              }),
            )
            .filter((lesson): lesson is JukenLesson => lesson !== null)
            .sort((a, b) => weekdayIndex(a.day) - weekdayIndex(b.day));
          if (lessons.length === 0) continue;
          weeks.push({
            school: schoolDir.name,
            course: courseDir.name,
            courseTitle: meta.title,
            week: weekDir.name,
            textLabel: lessons.find((lesson) => lesson.textLabel)?.textLabel ?? "",
            href: weekHref(schoolDir.name, courseDir.name, weekDir.name),
            lessons,
          });
        }
      }
      weeks.sort((a, b) => b.week.localeCompare(a.week));
      if (weeks.length === 0 && !fs.existsSync(path.join(coursePath, "course.yml"))) continue;
      courses.push({
        school: schoolDir.name,
        course: courseDir.name,
        title: meta.title,
        schoolLabel: meta.schoolLabel,
        grade: meta.grade,
        subject: meta.subject,
        summary: meta.summary,
        series: meta.series,
        href: courseHref(schoolDir.name, courseDir.name),
        weeks,
      });
    }
  }
  courses.sort((a, b) => a.href.localeCompare(b.href, "ja"));
  return courses;
}

export function loadJukenCourses(): JukenCourse[] {
  return readCatalog();
}

export function findCourse(school: string, course: string): JukenCourse | null {
  if (!SEGMENT.test(school) || !SEGMENT.test(course)) return null;
  return loadJukenCourses().find((item) => item.school === school && item.course === course) ?? null;
}

export function findWeek(school: string, course: string, week: string): JukenWeek | null {
  if (!WEEK_DIR.test(week)) return null;
  return findCourse(school, course)?.weeks.find((item) => item.week === week) ?? null;
}

export function findLesson(
  school: string,
  course: string,
  week: string,
  day: string,
): JukenLesson | null {
  if (!WEEKDAYS.some((item) => item.id === day)) return null;
  return findWeek(school, course, week)?.lessons.find((lesson) => lesson.day === day) ?? null;
}

export function adjacentJukenLessons(lesson: JukenLesson): {
  prev: JukenLesson | null;
  next: JukenLesson | null;
} {
  const all = loadJukenCourses()
    .flatMap((course) => course.weeks.flatMap((week) => week.lessons))
    .sort(
      (a, b) =>
        a.week.localeCompare(b.week) ||
        weekdayIndex(a.day) - weekdayIndex(b.day) ||
        a.href.localeCompare(b.href),
    );
  const index = all.findIndex((item) => item.href === lesson.href);
  if (index < 0) return { prev: null, next: null };
  return {
    prev: index > 0 ? all[index - 1]! : null,
    next: index < all.length - 1 ? all[index + 1]! : null,
  };
}

export function courseKicker(course: Pick<JukenCourse, "schoolLabel" | "grade" | "subject">): string {
  return [course.schoolLabel, course.grade, course.subject].filter(Boolean).join(" · ");
}
