import { TarotScreen } from "../TarotScreen";

/** 대화방. 방 id 가 URL 에 있으므로 새로고침·뒤로가기·북마크가 전부 자연스럽게 동작한다
 *  (예전 `?room=` 쿼리 파라미터를 대체한다). id 자체는 TarotScreen 이 경로에서 읽으므로
 *  여기서 넘겨줄 것이 없다. */
export default function RoomPage() {
  return <TarotScreen />;
}
