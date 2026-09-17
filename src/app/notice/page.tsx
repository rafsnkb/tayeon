import SubPageTopBar from "@/components/SubPageTopBar";
import NoticeList from "@/components/NoticeList";

const notices = [
  {
    title: "[공지] 테스트 중",
    date: "2026.05.08",
    body: "현재 공지사항을 테스트 중입니다.",
  },
  {
    title: "[공지] 테스트 중",
    date: "2026.04.01",
    body: "현재 공지사항을 테스트 중입니다.",
  },
  {
    title: "[공지] 테스트 중",
    date: "2026.03.04",
    body: "현재 공지사항을 테스트 중입니다.",
  },
];

export default function NoticePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg xl:h-dvh">
      <SubPageTopBar title="공지사항" />
      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-4 pt-20 pb-6">
        <NoticeList notices={notices} />
      </main>
    </div>
  );
}
