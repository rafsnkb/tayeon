import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CARD_ART_VERSION, tarotDeck } from "@/lib/tarot/cards";

const ASSET_DIR = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..", "..", "asset", "resource");

/** 그림을 갈아끼우고 CARD_ART_VERSION 을 안 올리면, 이미 캐시를 가진 사용자에게 **신구 그림이
 *  섞여** 보인다(2026-09-26 실제로 냈다). 이미지 라우트가 immutable 캐시를 달기 때문에 서버만
 *  고쳐서는 구제되지 않고 URL 이 달라져야 하는데, 그 URL 에 붙는 값이 이 상수다.
 *
 *  사람이 기억해야 하는 절차는 언젠가 빠진다. 파일 수정일과 대조해서 잊으면 테스트가 깨지게 한다. */
test("카드 그림을 교체했으면 CARD_ART_VERSION 도 함께 올라가 있다", () => {
  const pngs = readdirSync(ASSET_DIR).filter((f) => f.endsWith(".png"));
  assert.ok(pngs.length > 0, `${ASSET_DIR} 에 카드 그림이 없다`);

  const newestMs = Math.max(...pngs.map((f) => statSync(path.join(ASSET_DIR, f)).mtimeMs));
  const newestDay = new Date(newestMs).toISOString().slice(0, 10);

  assert.ok(
    CARD_ART_VERSION >= newestDay,
    `카드 그림이 ${newestDay} 에 바뀌었는데 CARD_ART_VERSION 은 아직 ${CARD_ART_VERSION} 이다. ` +
      `src/lib/tarot/cards.ts 의 CARD_ART_VERSION 을 "${newestDay}" 이상으로 올려야 캐시가 깨진다.`
  );
});

test("덱의 모든 카드에 그림 파일이 있다", () => {
  const have = new Set(readdirSync(ASSET_DIR).filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4)));
  const missing = tarotDeck.filter((c) => !have.has(c.id)).map((c) => c.id);
  assert.deepEqual(missing, [], `그림이 없는 카드: ${missing.join(", ")}`);
});
