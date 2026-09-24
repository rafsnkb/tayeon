// 리워드 규칙 단일 출처와 그 Functions 사본의 경로. 동기화 스크립트와 테스트가 같이 쓴다.
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

export const SOURCE = path.join(ROOT, "src", "lib", "reward", "rules.ts");
export const COPY = path.join(ROOT, "functions", "src", "shared", "rewardRules.ts");
