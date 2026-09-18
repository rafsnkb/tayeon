import Link from "next/link";

export function AdminPageHeader({ title, description, eyebrow = "운영 도구" }: { title: string; description: string; eyebrow?: string }) {
  return <header className="admin-page-header">
    <div>
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <span>{description}</span>
    </div>
    <Link href="/" className="admin-back-link">‹ 개요</Link>
  </header>;
}
