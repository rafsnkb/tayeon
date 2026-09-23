import { redirect } from "next/navigation";

/** 예전 초기 화면 주소. 북마크·외부 링크·`?room=` 가 붙은 옛 링크가 아직 살아 있으므로
 *  메인으로 넘긴다(방 id 를 살리지는 않는다 — 진입은 항상 메인이어야 한다). */
export default function TarotRedirect() {
  redirect("/");
}
