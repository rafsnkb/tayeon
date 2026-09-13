import { TERMS_EFFECTIVE_DATE, TERMS_SECTIONS } from "@/lib/legal/content";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-xl font-bold text-bold-text">이용약관</h1>
      <p className="mb-6 text-sm text-text">시행일: {TERMS_EFFECTIVE_DATE}</p>
      <div className="flex flex-col gap-6">
        {TERMS_SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="mb-2 font-bold text-bold-text">{section.title}</h2>
            <p className="whitespace-pre-wrap text-sm text-text">{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
