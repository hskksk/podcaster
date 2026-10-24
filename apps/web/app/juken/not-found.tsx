import Link from "next/link";
import { JukenShell } from "../../components/juken/JukenShell";

export default function JukenNotFound() {
  return (
    <JukenShell>
      <h1 className="font-serif text-3xl font-black">そのページは見当たりません</h1>
      <p className="mt-3 text-sm text-muted-fg">曜日の名前か、週の日付を確認してください。</p>
      <Link
        href="/juken"
        className="mt-6 inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-black text-accent-fg no-underline"
      >
        物語の一覧へ
      </Link>
    </JukenShell>
  );
}
