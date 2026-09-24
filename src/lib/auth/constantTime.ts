import { createHash, timingSafeEqual } from "node:crypto";

/**
 * 두 문자열이 같은지를 **비교 시간이 내용과 무관하게** 판정한다.
 *
 * `===` 는 첫 불일치 문자에서 곧장 빠져나오기 때문에, 비교에 걸린 시간이 "맞힌 접두사의 길이"에
 * 비례한다. 공격자가 같은 요청을 반복하면서 응답 시간을 재면 비밀을 한 글자씩 좁혀 나갈 수 있다.
 *
 * 양쪽을 먼저 SHA-256 으로 고정 길이로 만든 뒤 비교한다. 길이가 다르면 timingSafeEqual 이
 * 예외를 던지는 데다, 길이 자체도 흘리지 않게 된다.
 */
export function constantTimeEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a ?? "").digest(),
    createHash("sha256").update(b ?? "").digest()
  );
}
