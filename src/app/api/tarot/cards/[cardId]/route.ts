import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { tarotDeck } from "@/lib/tarot/cards";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;

  const isValidCard = tarotDeck.some((card) => card.id === cardId);
  if (!isValidCard) {
    return NextResponse.json({ error: "존재하지 않는 카드예요." }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "asset", "resource", `${cardId}.png`);

  try {
    const file = await readFile(filePath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "이미지를 찾을 수 없어요." }, { status: 404 });
  }
}
