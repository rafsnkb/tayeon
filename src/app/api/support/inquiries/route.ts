import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { SUPPORT_EMAIL } from "@/lib/company";
import { DISPUTE_RECORD_RETENTION_MONTHS, retentionExpiresAt } from "@/lib/legal/retention";
import {
  MAX_SUPPORT_ATTACHMENTS,
  MAX_SUPPORT_ATTACHMENT_BYTES,
  MAX_SUPPORT_TOTAL_ATTACHMENT_BYTES,
} from "@/lib/support/constants";

export const runtime = "nodejs";

function textField(value: FormDataEntryValue | null, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function escapeText(value: string) {
  return value.replace(/[\r\n]+/g, " ");
}

async function sendAdminEmail(input: {
  inquiryId: string;
  uid: string | null;
  name: string;
  nickname: string;
  email: string;
  content: string;
  attachments: File[];
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { status: "pending_configuration" as const, emailId: null };

  const attachments = await Promise.all(input.attachments.map(async (file) => ({
    filename: file.name.replace(/[\r\n]/g, " ").slice(0, 180),
    content: Buffer.from(await file.arrayBuffer()).toString("base64"),
  })));
  const subject = `[타연 고객센터] ${escapeText(input.nickname)}님의 문의`;
  const text = [
    `문의 번호: ${input.inquiryId}`,
    `UID: ${input.uid ?? "비로그인"}`,
    `이름: ${input.name}`,
    `닉네임: ${input.nickname}`,
    `회신 이메일: ${input.email}`,
    "",
    "문의 내용",
    input.content,
  ].join("\n");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `support-inquiry/${input.inquiryId}` },
    body: JSON.stringify({ from, to: [process.env.RESEND_ADMIN_EMAIL ?? SUPPORT_EMAIL], reply_to: input.email, subject, text, attachments }),
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
  if (!response.ok) throw new Error(payload.message ?? payload.name ?? `Resend 요청 실패 (${response.status})`);
  return { status: "sent" as const, emailId: payload.id ?? null };
}

/** 고객센터 문의를 먼저 Firestore에 보존한 뒤 Resend로 관리자에게 전달한다. */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "문의 내용을 읽을 수 없어요." }, { status: 400 });
  const name = textField(form.get("name"), 100);
  const nickname = textField(form.get("nickname"), 100);
  const email = textField(form.get("email"), 254).toLowerCase();
  const content = textField(form.get("content"), 5000);
  if (!name || !nickname || !email || !content) return NextResponse.json({ error: "필수 항목을 모두 입력해주세요." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "올바른 이메일 주소를 입력해주세요." }, { status: 400 });

  const attachments = form.getAll("attachments").filter((value): value is File => value instanceof File);
  const attachmentBytes = attachments.reduce((sum, file) => sum + file.size, 0);
  if (attachments.length > MAX_SUPPORT_ATTACHMENTS || attachments.some((file) => !file.type.startsWith("image/") || file.size > MAX_SUPPORT_ATTACHMENT_BYTES) || attachmentBytes > MAX_SUPPORT_TOTAL_ATTACHMENT_BYTES) {
    return NextResponse.json(
      { error: `스크린샷은 이미지 ${MAX_SUPPORT_ATTACHMENTS}장까지, 장당 ${MAX_SUPPORT_ATTACHMENT_BYTES / 1024 / 1024}MB 이하로 첨부해주세요.` },
      { status: 400 }
    );
  }

  const uid = await getUidFromRequest(req);
  const inquiryRef = adminDb.collection("supportInquiries").doc();
  const createdAt = new Date().toISOString();
  await inquiryRef.create({
    uid,
    name,
    nickname,
    email,
    content,
    attachmentMetadata: attachments.map((file) => ({ name: file.name.slice(0, 180), contentType: file.type, bytes: file.size })),
    status: "open",
    emailDeliveryStatus: "pending",
    createdAt,
    updatedAt: createdAt,
    // 소비자 불만·분쟁처리 기록 3년(개인정보처리방침 제3조). Firestore TTL이 이 필드를 보고 파기한다.
    expiresAt: retentionExpiresAt(createdAt, DISPUTE_RECORD_RETENTION_MONTHS),
  });

  try {
    const delivery = await sendAdminEmail({ inquiryId: inquiryRef.id, uid, name, nickname, email, content, attachments });
    await inquiryRef.update({ emailDeliveryStatus: delivery.status, resendEmailId: delivery.emailId, updatedAt: new Date().toISOString() });
  } catch (error) {
    // 접수 원문은 이미 DB에 보존되어 있어, 메일 장애가 있어도 운영자가 놓치지 않는다.
    await inquiryRef.update({
      emailDeliveryStatus: "failed",
      emailDeliveryError: error instanceof Error ? error.message.slice(0, 500) : "unknown error",
      updatedAt: new Date().toISOString(),
    });
  }
  return NextResponse.json({ ok: true, inquiryId: inquiryRef.id }, { status: 201 });
}
