import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JukenCrumbs, JukenShell } from "../../../../components/juken/JukenShell";
import { courseKicker, findCourse, formatWeekLabel, loadJukenCourses } from "../../../../lib/juken/catalog";

export const dynamic = "force-static";
export const revalidate = false;
export const dynamicParams = false;

type Params = { school: string; course: string };

export function generateStaticParams() {
  return loadJukenCourses().map((course) => ({ school: course.school, course: course.course }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { school, course: courseId } = await params;
  const course = findCourse(school, courseId);
  if (!course) return { title: "見当たりません" };
  return { title: course.title, description: course.summary || undefined };
}

export default async function JukenCoursePage({ params }: { params: Promise<Params> }) {
  const { school, course: courseId } = await params;
  const course = findCourse(school, courseId);
  if (!course) notFound();
  const kicker = courseKicker(course);

  return (
    <JukenShell>
      <JukenCrumbs items={[{ href: "/juken", label: "ふしぎ旅" }, { label: course.title }]} />
      {kicker ? <p className="text-xs font-black tracking-[0.14em] text-accent">{kicker}</p> : null}
      <h1 className="mt-2 font-serif text-4xl font-black tracking-tight">{course.title}</h1>
      {course.series ? <p className="mt-2 text-sm font-bold text-muted-fg">{course.series}</p> : null}
      {course.summary ? <p className="mt-4 max-w-2xl leading-relaxed text-muted-fg">{course.summary}</p> : null}
      <h2 className="mb-4 mt-10 text-xs font-black tracking-[0.14em] text-muted-fg">週</h2>
      {course.weeks.length === 0 ? (
        <p className="text-sm font-bold text-muted-fg">このコースには、まだ週がありません。</p>
      ) : (
        <ul className="space-y-3">
          {course.weeks.map((week) => (
            <li key={week.href}>
              <Link
                href={week.href}
                className="block rounded-[var(--radius-card)] border border-border bg-surface p-4 no-underline shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
              >
                <span className="font-serif text-xl font-black text-fg">{formatWeekLabel(week.week)}</span>
                {week.textLabel ? <span className="mt-1 block text-sm font-bold text-muted-fg">{week.textLabel}</span> : null}
                <span className="mt-3 block text-sm text-muted-fg">
                  {week.lessons.map((lesson) => lesson.weekdayLabel).join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </JukenShell>
  );
}
