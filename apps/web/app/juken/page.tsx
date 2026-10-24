import Link from "next/link";
import { DayCards } from "../../components/juken/DayCards";
import { JukenShell } from "../../components/juken/JukenShell";
import { CHARACTERS } from "../../lib/juken/characters";
import { courseKicker, formatWeekLabel, loadJukenCourses } from "../../lib/juken/catalog";

export const dynamic = "force-static";
export const revalidate = false;

export default function JukenHomePage() {
  const courses = loadJukenCourses();
  const latest = courses
    .flatMap((course) => course.weeks.map((week) => ({ course, week })))
    .sort((a, b) => b.week.week.localeCompare(a.week.week))[0];
  const lessonCount = courses.reduce(
    (sum, course) => sum + course.weeks.reduce((inner, week) => inner + week.lessons.length, 0),
    0,
  );

  return (
    <JukenShell
      variant="home"
      hero={
        <section className="border-b border-border/70">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
            <p className="text-xs font-black tracking-[0.16em] text-accent">中学受験</p>
            <h1 className="mt-2 font-serif text-4xl font-black tracking-tight sm:text-5xl">ふしぎ旅</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-fg sm:text-lg">
              家庭学習用に書いた、一週間五本の物語です。むずかしいことばは、会話の外に置いてあります。
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {CHARACTERS.map((character) => (
                <li
                  key={character.name}
                  data-tone={character.tone}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1.5 pl-1.5 pr-3 text-sm font-bold shadow-[var(--shadow-card)]"
                >
                  <span className="j-avatar size-9 text-lg" aria-hidden>
                    {character.emoji}
                  </span>
                  {character.name}
                </li>
              ))}
            </ul>
          </div>
        </section>
      }
    >
      {latest ? (
        <section className="mb-12">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xs font-black tracking-[0.14em] text-muted-fg">いちばん新しい週</h2>
              <p className="mt-1 font-serif text-2xl font-black">{formatWeekLabel(latest.week.week)}</p>
              <p className="mt-1 text-sm font-bold text-muted-fg">
                {courseKicker(latest.course) || latest.course.title}
                {latest.week.textLabel ? ` · ${latest.week.textLabel}` : ""}
              </p>
            </div>
            <Link href={latest.week.href} className="text-sm font-black text-link no-underline hover:underline">
              週のページ
            </Link>
          </div>
          <DayCards lessons={latest.week.lessons} />
        </section>
      ) : null}

      <h2 className="mb-4 text-xs font-black tracking-[0.14em] text-muted-fg">
        コース · {lessonCount} 本
      </h2>
      {courses.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface px-4 py-10 text-center text-sm font-bold text-muted-fg">
          まだ物語がありません。
        </p>
      ) : (
        <div className="space-y-8">
          {courses.map((course) => (
            <section key={course.href} className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
              <p className="text-xs font-black text-accent">{courseKicker(course) || "コース"}</p>
              <h3 className="mt-1 font-serif text-2xl font-black">
                <Link href={course.href} className="text-fg no-underline hover:underline">
                  {course.title}
                </Link>
              </h3>
              {course.summary ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-fg">{course.summary}</p> : null}
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
      )}
    </JukenShell>
  );
}
