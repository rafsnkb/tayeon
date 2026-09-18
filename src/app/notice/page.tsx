import SubPageTopBar from "@/components/SubPageTopBar";
import NoticeList from "@/components/NoticeList";
import { adminDb } from "@/lib/firebase/admin";

export default async function NoticePage() {
  const snap = await adminDb.collection("notices").where("status", "==", "published").orderBy("createdAt", "desc").limit(100).get();
  const notices = snap.docs.map((doc) => { const data = doc.data(); return { title: data.title ?? "", body: data.body ?? "", date: typeof data.createdAt === "string" ? data.createdAt.slice(0, 10).replaceAll("-", ".") : "" }; });
  return (
    <div className="flex min-h-dvh flex-col bg-bg xl:h-dvh">
      <SubPageTopBar title="공지사항" />
      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-4 pt-20 pb-6">
        <NoticeList notices={notices} />
      </main>
    </div>
  );
}
