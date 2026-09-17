import { readFile } from "node:fs/promises";
import path from "node:path";
import SupportCenter from "@/components/SupportCenter";

function parseFaq(markdown: string) {
  return [...markdown.matchAll(/Q\.\s*(.+?)\r?\n\r?\nA\.\s*([\s\S]*?)(?=\r?\n\r?\nQ\.|\s*$)/g)].map((match) => ({
    question: match[1].trim(),
    answer: match[2].trim(),
  }));
}

export default async function SupportPage() {
  const markdown = await readFile(path.join(process.cwd(), "doc", "FAQ.md"), "utf8");
  return <SupportCenter faqs={parseFaq(markdown)} />;
}
