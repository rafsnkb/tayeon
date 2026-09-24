// 리워드 규칙 단일 출처를 Cloud Functions 사본으로 복사한다.
//
// Functions 는 별도 npm 패키지(별도 배포 단위)라 `@/lib/...` 를 import 할 수 없다. 예전에는
// 같은 상수가 두 파일에 손으로 복사돼 있어서, 앱만 고치고 Functions 를 빠뜨리면 광고 문구와
// 실제 지급이 어긋났다(2026-09-24). 이제 사본은 이 스크립트가 만들고, 어긋나면
// src/lib/reward/rules.sync.test.mjs 가 `npm test` 에서 실패한다.
//
// 사용: npm run sync:reward-rules
import { copyFileSync, readFileSync } from "node:fs";
import { SOURCE, COPY } from "../src/lib/reward/syncPaths.mjs";

const before = readFileSync(COPY, "utf8");
copyFileSync(SOURCE, COPY);
const after = readFileSync(COPY, "utf8");
console.log(before === after ? "이미 동기화돼 있다 — 바뀐 것 없음." : "사본을 갱신했다: functions/src/shared/rewardRules.ts");
