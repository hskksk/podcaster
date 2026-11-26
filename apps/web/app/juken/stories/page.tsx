import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JukenCrumbs, JukenShell } from "../../../components/juken/JukenShell";
import { courseKicker, formatWeekLabel, loadJukenCourses } from "../../../lib/juken/catalog";
import { jukenStoriesAvailable } from "../../../lib/juken/hub";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = {
  title: "歴史ものがたり",
  description: "ぬいぐるみたちが、中学受験の歴史テキストを週ごとに会話で歩く読み物です。",
};

export default function JukenStoriesPage() {
  if (!jukenStoriesAvailable()) notFound();
  const courses = loadJukenCourses();
  const lessonCount = courses.reduce(
    (sum, course) => sum + course.weeks.reduce((inner, week) => inner + week.lessons.length, 0),
    0,
  );

  return (
    <JukenShell variant="stories">
      <JukenCrumbs
        items={[
          { href: "/juken", label: "ふしぎ旅" },
          { href: "/juken/stories", label: "社会" },
          { label: "歴史ものがたり" },
        ]}
      />
      <p className="text-xs font-black tracking-[0.14em] text-accent">社会</p>
      <h1 className="mt-2 font-serif text-4xl font-black tracking-tight">歴史ものがたり</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted-fg">
        一週間五本の物語です。むずかしいことばは、会話の外に置いてあります。
      </p>
      <p className="mt-2 text-sm font-bold text-muted-fg">{lessonCount} 本 · {courses.length} コース</p>

      <div className="mt-10 space-y-8">
        {courses.map((course) => (
          <section
            key={course.href}
            className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6"
          >
            <p className="text-xs font-black text-accent">{courseKicker(course) || "コース"}</p>
            <h2 className="mt-1 font-serif text-2xl font-black">
              <Link href={course.href} className="text-fg no-underline hover:underline">
                {course.title}
              </Link>
            </h2>
            {course.summary ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-fg">{course.summary}</p>
            ) : null}
            <ul className="mt-5 space-y-2">
              {course.weeks.map((week) => (
                <li key={week.href}>
                  <Link
                    href={week.href}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border border-border px-3 py-3 no-underline transition hover:bg-muted"
                  >
                    <span className="font-bold text-fg">{formatWeekLabel(week.week)}</span>
                    <span className="text-sm text-muted-fg">
                      {week.textLabel || `${week.lessons.length} 本`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </JukenShell>
  );
}