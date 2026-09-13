// (app)/layout.tsx의 메뉴 드로어는 레이아웃에 상태가 있는데, 피그마 리디자인에서는 /tarot가
// 자체 TopBar(방 이름/새 대화 등)를 그려야 해서 공통 헤더를 안 쓴다. 그래도 햄버거 버튼으로 같은
// 드로어를 열 수 있어야 하므로, Context 대신 가벼운 이벤트 버스로 "메뉴 열기" 신호만 전달한다.
const target = new EventTarget();

export function openMenu() {
  target.dispatchEvent(new Event("open"));
}

export function onOpenMenu(cb: () => void): () => void {
  target.addEventListener("open", cb);
  return () => target.removeEventListener("open", cb);
}
