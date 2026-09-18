"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { BackIcon, CheckIcon, CloseIcon } from "@/app/(app)/tarot/icons";
import { auth } from "@/lib/firebase/client";

type Faq = { question: string; answer: string };
type Tab = "faq" | "inquiry";
type Attachment = { file: File; url: string };
type InquiryDraft = { name: string; nickname: string; email: string; content: string; agreed: boolean };

const INQUIRY_DRAFT_KEY = "tayeon-support-inquiry-draft";

export default function SupportCenter({ faqs }: { faqs: Faq[] }) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("faq");
  const [openIndex, setOpenIndex] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const attachmentsRef = useRef<Attachment[]>([]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => () => attachmentsRef.current.forEach((attachment) => URL.revokeObjectURL(attachment.url)), []);

  useEffect(() => {
    if (searchParams.get("tab") !== "inquiry") return;
    setTab("inquiry");
    const saved = window.sessionStorage.getItem(INQUIRY_DRAFT_KEY);
    if (!saved) return;
    try {
      const draft = JSON.parse(saved) as InquiryDraft;
      const form = formRef.current;
      if (!form) return;
      (form.elements.namedItem("name") as HTMLInputElement).value = draft.name;
      (form.elements.namedItem("nickname") as HTMLInputElement).value = draft.nickname;
      (form.elements.namedItem("email") as HTMLInputElement).value = draft.email;
      (form.elements.namedItem("content") as HTMLTextAreaElement).value = draft.content;
      setAgreed(draft.agreed);
      setMessage("입력한 문의 내용이 복원됐어요. 첨부 이미지는 다시 선택해주세요.");
    } catch {
      window.sessionStorage.removeItem(INQUIRY_DRAFT_KEY);
    }
  }, [searchParams]);

  function saveDraft() {
    const form = formRef.current;
    if (!form) return;
    const values = new FormData(form);
    const draft: InquiryDraft = {
      name: String(values.get("name") ?? ""),
      nickname: String(values.get("nickname") ?? ""),
      email: String(values.get("email") ?? ""),
      content: String(values.get("content") ?? ""),
      agreed,
    };
    window.sessionStorage.setItem(INQUIRY_DRAFT_KEY, JSON.stringify(draft));
  }

  function addAttachments(files: FileList | null) {
    if (!files) return;
    const images = Array.from(files)
      .filter((file) => file.type.startsWith("image/") && file.size <= 2 * 1024 * 1024)
      .slice(0, Math.max(0, 3 - attachments.length))
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    if (images.length < Array.from(files).length) setMessage("이미지 파일만 첨부할 수 있으며, 파일당 최대 크기는 2MB예요.");
    setAttachments((current) => [...current, ...images]);
  }

  function removeAttachment(index: number) {
    setAttachments((current) => {
      URL.revokeObjectURL(current[index].url);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // async 요청 뒤에는 React 이벤트의 currentTarget을 다시 읽지 않는다.
    // 제출 시점의 폼 노드를 보관해 성공 뒤 reset도 안전하게 수행한다.
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (!agreed) {
      setMessage("개인정보 수집 및 이용에 동의해주세요.");
      return;
    }
    const requestData = new FormData();
    for (const [key, value] of form.entries()) requestData.append(key, value);
    attachments.forEach(({ file }) => requestData.append("attachments", file));

    setIsSubmitting(true);
    setMessage(null);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      const response = await fetch("/api/support/inquiries", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: requestData,
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "문의 접수 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
      formElement.reset();
      window.sessionStorage.removeItem(INQUIRY_DRAFT_KEY);
      attachments.forEach((attachment) => URL.revokeObjectURL(attachment.url));
      setAttachments([]);
      setAgreed(false);
      setMessage("문의가 접수되었어요. 입력하신 이메일로 답변드릴게요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "문의 접수 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg xl:h-dvh">
      <div className="app-topbar-glass fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-center border-b border-border">
        <div className="relative mx-auto flex h-full w-full max-w-2xl items-center justify-center">
          <Link href="/tarot" aria-label="뒤로가기" className="absolute left-6 flex h-16 w-8 items-center justify-center text-bold-text"><BackIcon className="h-5 w-2.5" /></Link>
          <span className="text-xl font-semibold text-bold-text">고객센터</span>
        </div>
      </div>
      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-4 pt-20 pb-24">
        {tab === "faq" ? (
          <section>
            <h1 className="mb-3 text-lg font-semibold text-icon-muted">자주 묻는 질문</h1>
            <div className="divide-y divide-border overflow-hidden rounded-[28px] border border-border bg-surface px-4">
              {faqs.map((faq, index) => {
                const open = openIndex === index;
                return <article key={faq.question} className="py-4"><button type="button" onClick={() => setOpenIndex(open ? -1 : index)} aria-expanded={open} className="flex w-full items-center gap-3 text-left"><span className="min-w-0 flex-1 break-keep text-sm font-semibold leading-5 text-bold-text dark:text-[#dcdee3]">{faq.question}</span><BackIcon className={`h-4 w-2 shrink-0 text-bold-text transition-transform dark:text-[#dcdee3] ${open ? "rotate-90" : "-rotate-90"}`} /></button>{open && <p className="mt-3 whitespace-pre-line rounded-2xl bg-[#f7f4fb] p-4 text-sm leading-5 text-text dark:bg-chip-fill dark:text-[#868b9a]">{faq.answer}</p>}</article>;
              })}
            </div>
          </section>
        ) : (
          <section>
            <p className="mb-4 text-center text-sm leading-5 text-icon-muted">이용 중 문제가 발생했거나 문의사항이 있으신 경우,<br />아래 내용을 입력해주세요.</p>
            <form ref={formRef} onSubmit={submitInquiry} className="rounded-[28px] border border-border bg-surface p-4">
              <label className="mb-4 flex flex-col gap-2 text-sm text-icon-muted"><span>이름<span className="text-urgent">*</span></span><input required name="name" placeholder="이름을 입력해주세요" className="h-12 rounded-2xl border border-border bg-bg px-3 text-base text-bold-text outline-none placeholder-placeholder" /></label>
              <label className="mb-4 flex flex-col gap-2 text-sm text-icon-muted"><span>사용중인 닉네임<span className="text-urgent">*</span></span><input required name="nickname" placeholder="타연에서 사용중인 닉네임을 입력해주세요" className="h-12 rounded-2xl border border-border bg-bg px-3 text-base text-bold-text outline-none placeholder-placeholder" /></label>
              <label className="mb-4 flex flex-col gap-2 text-sm text-icon-muted"><span>이메일<span className="text-urgent">*</span></span><input required type="email" name="email" placeholder="이메일을 입력해주세요" className="h-12 rounded-2xl border border-border bg-bg px-3 text-base text-bold-text outline-none placeholder-placeholder" /><span className="text-xs text-urgent">입력하신 메일로 답변해드립니다.</span></label>
              <label className="mb-4 flex flex-col gap-2 text-sm text-icon-muted"><span>문의 내용<span className="text-urgent">*</span></span><textarea required name="content" rows={5} placeholder="문의 내용을 상세하게 입력해주시면 빠른 처리가 가능합니다" className="resize-none rounded-2xl border border-border bg-bg p-3 text-base text-bold-text outline-none placeholder-placeholder" /></label>
              <div className="mb-4"><p className="mb-2 text-sm text-icon-muted">스크린샷 첨부 <span className="text-xs">(이미지 3장, 장당 2MB 이하)</span></p><input ref={fileInputRef} onChange={(event) => { addAttachments(event.target.files); event.currentTarget.value = ""; }} accept="image/*" multiple type="file" className="sr-only" /><div className="flex min-h-20 flex-wrap items-center gap-2 rounded-2xl bg-bg p-3">{attachments.map((attachment, index) => <div key={attachment.url} className="relative h-14 w-14"><div className="h-full w-full overflow-hidden rounded-lg border border-border"><img src={attachment.url} alt={attachment.file.name} className="h-full w-full object-cover" /></div><button type="button" onClick={() => removeAttachment(index)} aria-label={`${attachment.file.name} 삭제`} className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-urgent text-urgent-text"><CloseIcon className="h-2 w-2" /></button></div>)}{attachments.length < 3 && <button type="button" onClick={() => fileInputRef.current?.click()} className="ml-auto rounded-full bg-cta-fill px-6 py-2.5 text-sm font-semibold text-cta-text">파일 첨부하기</button>}</div></div>
              <label className="flex cursor-pointer items-center gap-2 border-t border-border pt-4 text-sm text-bold-text"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="sr-only" /><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${agreed ? "bg-point text-white" : "border border-border"}`}><CheckIcon className={`h-3 w-3 ${agreed ? "" : "opacity-50"}`} /></span>[필수] 타연의 <Link href="/privacy?from=support" className="text-point underline" onClick={(event) => { event.stopPropagation(); saveDraft(); }}>개인정보 수집 및 이용</Link>에 동의합니다.</label>
              {message && <p role="status" className={`mt-3 text-sm ${message.startsWith("문의가 접수") || message.startsWith("입력한 문의") ? "text-point" : "text-urgent"}`}>{message}</p>}
              <button disabled={isSubmitting} type="submit" className="mt-4 h-12 w-full rounded-full bg-point text-base font-semibold text-white disabled:cursor-wait disabled:opacity-60">{isSubmitting ? "접수 중..." : "문의 접수하기"}</button>
            </form>
          </section>
        )}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 p-4 backdrop-blur-lg"><div className="mx-auto grid w-full max-w-2xl grid-cols-2 overflow-hidden rounded-2xl bg-chip-fill"><button type="button" onClick={() => setTab("faq")} className={`h-12 text-base font-semibold ${tab === "faq" ? "bg-point text-white" : "text-white"}`}>FAQ</button><button type="button" onClick={() => setTab("inquiry")} className={`h-12 text-base font-semibold ${tab === "inquiry" ? "bg-point text-white" : "text-white"}`}>문의하기</button></div></nav>
    </div>
  );
}
