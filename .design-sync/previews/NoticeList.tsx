import { NoticeList } from "tayeon";

const notices = [
  {
    title: "시간제 이용권 개편 안내",
    date: "2026-09-18",
    body: "횟수제 이용권 조합이 네 가지로 고정됩니다. 기존에 보유하신 이용권은 그대로 사용하실 수 있어요.",
  },
  {
    title: "추석 연휴 고객센터 운영 안내",
    date: "2026-09-12",
    body: "연휴 기간에는 문의 답변이 1~2일 지연될 수 있습니다.",
  },
  {
    title: "자미두수 리딩 정식 오픈",
    date: "2026-08-30",
    body: "타로·사주에 이어 자미두수 리딩을 정식으로 제공합니다.",
  },
];

export const Default = () => (
  <div className="w-[420px] bg-bg p-4">
    <NoticeList notices={notices} />
  </div>
);

export const Single = () => (
  <div className="w-[420px] bg-bg p-4">
    <NoticeList notices={notices.slice(0, 1)} />
  </div>
);

export const Empty = () => (
  <div className="w-[420px] bg-bg p-4">
    <NoticeList notices={[]} />
  </div>
);

// Every card in this gallery renders on a white body with no `dark` class, so
// the dark half of the token set is otherwise invisible here. `dark` on a
// wrapper is exactly how the app switches themes (globals.css defines the
// variant as a class, not prefers-color-scheme), and the opaque bg-bg inside
// it stands in for the app background the white page would otherwise show
// through.
export const Dark = () => (
  <div className="dark">
    <div className="w-[420px] bg-bg p-4">
      <NoticeList notices={notices} />
    </div>
  </div>
);
