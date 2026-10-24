import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DayCards } from "../../../../../components/juken/DayCards";
import { JukenCrumbs, JukenShell } from "../../../../../components/juken/JukenShell";
import { findCourse, findWeek, formatWeekLabel, loadJukenCourses } from "../../../../../lib/juken/catalog";

export const dynamic = "force-static";
export const revalidate = false;
export const dynamicParams = false;

type Params = { school: string; course: string; week: string };

export function generateStaticParams() {
  return loadJukenCourses().flatMap((course) =>
    course.weeks.map((week) => ({ school: course.school, course: course.course, week: week.week })),
  );
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { school, course, week } = await params;
  const found = findWeek(school, course, week);
  if (!found) return { title: "見当たりません" };
  return {
    title: formatWeekLabel(found.week),
    description: found.textLabel || found.courseTitle,
  };
}

export default async function JukenWeekPage({ params }: { params: Promise<Params> }) {
  const { school, course: courseId, week } = await params;
  const course = findCourse(school, courseId);
  const found = findWeek(school, courseId, week);
  if (!course || !found) notFound();

  return (
    <JukenShell>
      <JukenCrumbs
        items={[
          { href: "/juken", label: "ふしぎ旅" },
          { href: course.href, label: course.title },
          { label: formatWeekLabel(found.week) },
        ]}
      />
      <p className="text-xs font-black tracking-[0.14em] text-accent">{course.title}</p>
      <h1 className="mt-2 font-serif text-4xl font-black tracking-tight">{formatWeekLabel(found.week)}</h1>
      {found.textLabel ? <p className="mt-3 text-base font-bold">{found.textLabel}</p> : null}
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-fg">
        月〜金の順です。気になる曜日から読めます。
      </p>
      <div className="mt-8">
        <DayCards lessons={found.lessons} />
      </div>
    </JukenShell>
  );
}
