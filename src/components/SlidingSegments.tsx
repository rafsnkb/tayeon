"use client";

// 세그먼트 컨트롤의 **움직이는 표시기**. iOS 의 세그먼트처럼 선택 알약이 칸 사이를 미끄러진다.
//
// ## 왜 부품으로 뺐나
//
// 같은 모양이 다섯 군데 있었다 — 타로/운세 토글, 보유 이용권 탭, 이용권 구입 하단 탭,
// 시간제 분 선택, 폼의 양력/음력·성별. 전부 "트랙 위에서 알약이 칸을 옮겨 다니는" 것이고,
// 지금까지는 **선택된 버튼의 배경색만 켜고 껐다**(움직임이 없다).
//
// 알약을 움직이려면 칸마다 배경을 켜는 대신 **표시기 하나를 절대 위치로 띄워** 옮겨야 한다.
// 그 위치 계산(안쪽 여백·칸 사이 간격까지 고려한 `calc`)이 손으로 적기엔 까다롭고 다섯 벌이
// 되면 반드시 어긋난다. 그래서 **계산만** 여기 모으고, 색·크기는 각 호출부가 자기 클래스로
// 그대로 들고 있는다 — 다섯 곳의 생김새가 서로 다르기 때문이다(트랙 여백 4·6·8, 높이 36·40,
// 폼 쪽은 아예 트랙이 없고 칸 사이가 벌어져 있다).
//
// ## 기하
//
//   칸 너비 = (트랙 너비 − 안쪽 여백×2 − 간격×(칸수−1)) ÷ 칸수
//   왼쪽    = 안쪽 여백 + 인덱스 × (칸 너비 + 간격)
//
// 퍼센트가 섞여 있어 JS 로 재지 않고 `calc` 로 넘긴다 — 폭을 읽어 계산하면 리사이즈·폰트 로딩
// 때마다 다시 재야 하고, 첫 렌더에서 0 이 잡히면 알약이 왼쪽 끝에서 미끄러져 들어온다.
//
// ## 움직임을 원치 않는 사람
//
// `motion-reduce:transition-none` 을 붙인다. 전정기관 질환이 있으면 미끄러지는 UI 가 실제로
// 어지럼을 유발한다 — 운영체제에 "동작 줄이기"를 켜 둔 사람에게는 예전처럼 즉시 바뀐다.
import type { ReactNode } from "react";

export function SlidingSegments({
  count,
  index,
  padding = 0,
  gap = 0,
  className = "",
  indicatorClassName = "",
  children,
}: {
  /** 칸 수. `children` 의 개수와 같아야 한다 — 다르면 알약이 엉뚱한 자리에 선다. */
  count: number;
  /** 선택된 칸(0부터). **-1 이면 알약을 그리지 않는다** — "아직 아무것도 안 골랐다"를
   *  표현해야 하는 자리(별점처럼)가 생기면 쓸 수 있고, 지금은 방어값이다. */
  index: number;
  /** 트랙 안쪽 여백(px). Tailwind 의 `p-2` 를 쓴다면 8 이다 — 클래스와 이 숫자가 **같아야**
   *  알약이 버튼과 정확히 겹친다. 두 값이 어긋나면 알약이 글자에서 몇 px 밀린다. */
  padding?: number;
  /** 칸 사이 간격(px). 트랙 없이 버튼이 벌어져 있는 폼 쪽(`gap-2`)이 8 이다. */
  gap?: number;
  className?: string;
  /** 움직이는 알약의 색·모서리·그림자. 트랙마다 달라서 호출부가 준다. */
  indicatorClassName?: string;
  /** 칸 버튼들. **배경을 칠하지 말 것** — 알약이 뒤에 깔리므로 배경을 주면 알약을 가린다.
   *  글자색만 선택 여부로 바꾸면 된다. */
  children: ReactNode;
}) {
  // 칸이 하나뿐이면 옮길 데가 없다. `calc` 도 0 으로 나누지 않게 막는다.
  const slot = `((100% - ${padding * 2}px - ${gap * (count - 1)}px) / ${Math.max(count, 1)})`;

  return (
    <div className={`relative ${className}`}>
      {index >= 0 && count > 0 && (
        <span
          aria-hidden="true"
          className={`absolute transition-[left] duration-300 ease-out motion-reduce:transition-none ${indicatorClassName}`}
          style={{
            // 위아래는 트랙 여백만큼 안쪽으로. 트랙 높이가 "여백×2 + 버튼 높이"라서 이 둘만
            // 맞추면 알약 높이가 버튼 높이와 저절로 같아진다 — 높이를 따로 받지 않는 이유다.
            top: padding,
            bottom: padding,
            left: `calc(${padding}px + ${index} * (${slot} + ${gap}px))`,
            width: `calc(${slot})`,
          }}
        />
      )}
      {children}
    </div>
  );
}
