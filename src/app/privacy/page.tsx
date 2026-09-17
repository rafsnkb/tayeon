import SubPageTopBar from "@/components/SubPageTopBar";
import { PRIVACY_POLICY_SECTIONS, PRIVACY_POLICY_UPDATED_AT } from "@/lib/legal/content";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <SubPageTopBar title="개인정보 처리방침" />
      <main className="mx-auto w-full max-w-2xl flex-1 p-4 pt-20">
        <h1 className="mb-2 text-xl font-bold text-bold-text">개인정보처리방침</h1>
        <p className="mb-6 text-sm text-icon-muted">최종 수정일: {PRIVACY_POLICY_UPDATED_AT}</p>
        <div className="flex flex-col gap-6">
          {PRIVACY_POLICY_SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="mb-2 font-bold text-bold-text">{section.title}</h2>
              <p className="whitespace-pre-wrap text-sm text-icon-muted">{section.body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
