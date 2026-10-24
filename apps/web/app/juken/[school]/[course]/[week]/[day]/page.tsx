import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DayCards } from "../../../../../../components/juken/DayCards";
import { JukenCrumbs, JukenShell } from "../../../../../../components/juken/JukenShell";
import { JukenPager } from "../../../../../../components/juken/JukenPager";
import { StoryBody } from "../../../../../../components/juken/StoryBody";
import { ReadingProgress } from "../../../../../../components/ReadingProgress";
import {
  adjacentJukenLessons,
  findCourse,
  findLesson,
  findWeek,
  formatWeekLabel,
  loadJukenCourses,
} from "../../../../../../lib/juken/catalog";

export const dynamic = "force-static";
export const revalidate = false;
export const dynamicParams = false;

type Params = { school: string; course: string; week: string; day: string };

export function generateStaticParams() {
  return loadJukenCourses().flatMap((course) =>
    course.weeks.flatMap((week) =>
      week.lessons.map((lesson) => ({
        school: course.school,
        course: course.course,
        week: week.week,
        day: lesson.day,
      })),
    ),
  );
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { school, course, week, day } = await params;
  const lesson = findLesson(school, course, week, day);
  if (!lesson) return { title: "見当たりません" };
  const description = [lesson.textLabel, lesson.todayLabel].filter(Boolean).join(" ");
  return { title: `${lesson.weekdayLong} ${lesson.theme}`, description: description || undefined };
}

export default async function JukenLessonPage({ params }: { params: Promise<Params> }) {
  const { school, course: courseId, week, day } = await params;
  const course = findCourse(school, courseId);
  const foundWeek = findWeek(school, courseId, week);
  const lesson = findLesson(school, courseId, week, day);
  if (!course || !foundWeek || !lesson) notFound();
  const { prev, next } = adjacentJukenLessons(lesson);

  return (
    <>
      <ReadingProgress />
      <JukenShell width="story">
        <JukenCrumbs
          items={[
            { href: "/juken", label: "ふしぎ旅" },
            { href: course.href, label: course.title },
            { href: foundWeek.href, label: formatWeekLabel(foundWeek.week) },
            { label: lesson.weekdayLong },
          ]}
        />
        {lesson.series ? <p className="text-sm font-bold text-accent">{lesson.series}</p> : null}
        <p className="mt-2 text-sm font-black text-muted-fg">{lesson.weekdayLong}</p>
        <h1 className="mt-1 font-serif text-3xl font-black leading-tight tracking-tight sm:text-4xl">
          {lesson.theme}
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          {lesson.textLabel ? <span className="j-chip">{lesson.textLabel}</span> : null}
          {lesson.todayLabel ? <span className="j-chip">{lesson.todayLabel}</span> : null}
        </div>
        <div className="mt-8">
          <StoryBody source={lesson.source} cast={lesson.cast} />
        </div>
        <div className="mt-10">
          <h2 className="mb-3 text-xs font-black tracking-[0.14em] text-muted-fg">この週</h2>
          <DayCards lessons={foundWeek.lessons} currentDay={lesson.day} />
        </div>
        <JukenPager
          prev={prev ? { href: prev.href, title: prev.theme, weekdayLong: prev.weekdayLong } : null}
          next={next ? { href: next.href, title: next.theme, weekdayLong: next.weekdayLong } : null}
        />
      </JukenShell>
    </>
  );
}
