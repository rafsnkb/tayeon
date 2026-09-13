import { PRIVACY_POLICY_SECTIONS, PRIVACY_POLICY_UPDATED_AT } from "@/lib/legal/content";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-xl font-bold text-bold-text">개인정보처리방침</h1>
      <p className="mb-6 text-sm text-text">최종 수정일: {PRIVACY_POLICY_UPDATED_AT}</p>
      <div className="flex flex-col gap-6">
        {PRIVACY_POLICY_SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="mb-2 font-bold text-bold-text">{section.title}</h2>
            <p className="whitespace-pre-wrap text-sm text-text">{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
