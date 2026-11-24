import type { Metadata } from "next";
import { JukenSearch } from "../../../components/juken/JukenSearch";
import { JukenShell } from "../../../components/juken/JukenShell";
import { formatWeekLabel } from "../../../lib/juken/catalog";
import { getJukenCoursesForRender } from "../../../lib/knowledge/cached-content";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = {
  title: "さがす",
};

export default async function JukenSearchPage() {
  const courses = await getJukenCoursesForRender();
  const items = courses.flatMap((course) =>
    course.weeks.flatMap((week) =>
      week.lessons.map((lesson) => ({
        href: lesson.href,
        title: lesson.theme,
        weekday: lesson.weekdayLong,
        courseTitle: course.title,
        weekLabel: formatWeekLabel(week.week),
        text: lesson.plainText,
      })),
    ),
  );

  return (
    <JukenShell variant="search">
      <h1 className="font-serif text-3xl font-black tracking-tight">さがす</h1>
      <p className="mt-2 text-sm text-muted-fg">公開している物語の中を調べます。</p>
      <div className="mt-8">
        <JukenSearch items={items} />
      </div>
    </JukenShell>
  );
}
