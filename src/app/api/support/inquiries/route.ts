import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { SUPPORT_EMAIL } from "@/lib/company";
import { DISPUTE_RECORD_RETENTION_MONTHS } from "@/lib/legal/retention";
import { retentionExpiresAt } from "@/lib/legal/retentionTimestamp";
import { consumeRateLimit, clientIp } from "@/lib/rateLimit";
import { notifyOwner } from "@/lib/notify/owner";

// 이 엔드포인트는 일부러 비로그인도 받는다 — 로그인이 안 되는 상황이야말로 문의가 필요하기
// 때문이다. 대신 한 번 호출될 때마다 Firestore 쓰기와 Resend 메일(첨부 포함)이 발생하므로,
// 제한이 없으면 운영자 메일함과 과금이 그대로 공격 표면이 된다. 로그인 사용자는 UID 기준으로,
// 비로그인은 IP 기준으로 더 빡빡하게 건다(IP는 위조될 수 있어 인증이 아니라 완화 수단).
const INQUIRY_WINDOW_MS = 24 * 60 * 60 * 1000;
const INQUIRY_LIMIT_PER_USER = 5;
const INQUIRY_LIMIT_PER_IP = 2;
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

  const limited = uid
    ? await consumeRateLimit(`support:uid:${uid}`, INQUIRY_LIMIT_PER_USER, INQUIRY_WINDOW_MS)
    : await (async () => {
        const ip = clientIp(req);
        // IP를 못 구하면(헤더 누락) 비로그인 요청은 받지 않는다 — 제한을 걸 수 없는 익명 요청을
        // 무제한으로 통과시키는 것보다 낫다. 로그인 후 문의하거나 이메일로 문의할 수 있다.
        if (!ip) return { ok: false as const, retryAfterSeconds: 60 };
        return consumeRateLimit(`support:ip:${ip}`, INQUIRY_LIMIT_PER_IP, INQUIRY_WINDOW_MS);
      })();
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: uid
          ? `문의는 하루 ${INQUIRY_LIMIT_PER_USER}건까지 접수할 수 있어요. 기존 문의에 대한 답변을 기다려주세요.`
          : `문의가 너무 많이 접수됐어요. 로그인 후 문의하시거나 ${SUPPORT_EMAIL}로 보내주세요.`,
        code: "RATE_LIMITED",
      },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

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
  // 메일은 실제 업무용이다 — 첨부와 회신 주소가 붙어 있어 여기서 바로 답장한다. 디스코드는
  // "문의가 왔다"를 바로 알기 위한 것이라 내용 일부만 싣는다. level:"info" 라 메일은 다시
  // 나가지 않는다(환불 알림과 달리 이 경로는 위 sendAdminEmail 이 이미 보냈다).
  void notifyOwner({
    key: `support-inquiry/${inquiryRef.id}`,
    level: "info",
    channel: "support",
    title: `고객센터 문의 · ${nickname}`,
    fields: [
      ["이름", name],
      ["닉네임", nickname],
      ["회신 이메일", email],
      ["UID", uid ?? "비로그인"],
      ["첨부", attachments.length ? `${attachments.length}개 (메일 확인)` : "없음"],
      ["내용", content.length > 900 ? `${content.slice(0, 900)}…(메일에 전문)` : content],
    ],
  });
  return NextResponse.json({ ok: true, inquiryId: inquiryRef.id }, { status: 201 });
}
