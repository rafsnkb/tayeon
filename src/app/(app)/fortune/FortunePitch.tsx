"use client";

// 「왜 이걸 봐야 하나」 — 비로그인에게만, 상품 목록 **위에** 얹는다.
//
// ## 화면 하나가 없어진 자리다 (2026-09-27 사용자 결정)
//
// 예전에는 비로그인 전용 소개 화면(`FortuneIntro`, 목업 `Main_Fortune_*`)이 따로 있었고
// 로그인해야 목록이 나왔다. 없앴다 — **타로 쪽이 이미 화면 하나로 둘 다 받고 있었다**
// (`TarotScreen` 의 `isMain` 분기, 사업자정보가 `user` 블록 밖에 있다). 운세만 화면이 둘이라
// 양쪽이 어긋나 있었다.
//
// 그리고 비로그인에게 **실제 상품과 가격을 보여주는 쪽이 더 설득력 있다** — 카피만 읽히는
// 화면보다 낫다. 로그인은 살 때 어차피 필요하고, 그 문은 상세 화면이 이미 들고 있다.
//
// **다만 목록이 못 하는 일이 있어서 이 블록만 살렸다.** 목록은 *무엇을 파는지*를 보여주고,
// 아래 여섯 줄은 *왜 필요한지*를 말한다. 둘은 대체재가 아니다.
import { useState } from "react";
import LoginModal from "@/components/LoginModal";
import { ArrowRightIcon } from "../tarot/icons";

/** 옛 소개 화면의 문장 그대로다. 다듬지 않는다 — 화면으로 바로 나가는 값이고, 사용자가 쓴 글이다. */
const QUESTIONS = [
  "‘이번에는 대학에 붙을 수 있을까?’",
  "‘언제쯤 취업이 될까?’",
  "‘내 미래의 애인은 누굴까?’",
  "‘나는 돈을 얼마나 많이 벌 수 있을까?’",
  "‘결혼은 언제 어떤 사람이랑 하게 될까?’",
  "‘아이가 언제쯤 생길까?’",
];

export function FortunePitch() {
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <>
      {/* 전용 화면이었을 때는 `justify-evenly` 로 세로를 꽉 채웠다(실측 여백 97/103/95). 이제는
          목록 위에 얹히는 블록이라 그 규칙이 의미가 없다 — 아래에 카테고리 칩과 카드가 바로
          이어지므로 고정 간격으로 바꾸고, 목록과의 경계를 구분선 하나로 맺는다. */}
      <section className="border-b border-border pb-6 text-center">
        <p className="text-sm font-semibold text-placeholder">
          우리는 내 인생에 대해 궁금할 때가 많습니다.
        </p>
        <div className="mt-4 text-lg font-bold text-bold-text">
          {QUESTIONS.map((q) => (
            <p key={q}>{q}</p>
          ))}
        </div>
        <p className="mt-2 text-sm font-semibold leading-[25px] text-placeholder">
          이런 여러가지 고민과 질문들을 모아보았습니다.
          <br />
          장/단점을 감추지 않고 속속들이 짚어드립니다.
        </p>

        {/* 라벨은 옛 화면 그대로다. 목록이 이미 보이는데도 말이 되는 이유: 아래 목록은
            **상품**이고, 로그인해야 생기는 것은 내 명식으로 계산한 **내 운세**다. */}
        <button
          type="button"
          onClick={() => setLoginOpen(true)}
          className="point-pill relative mx-auto mt-6 flex h-12 w-[260px] shrink-0 items-center justify-center rounded-full text-base font-bold shadow-[0_0_20px_3px_var(--point-glow),inset_0_0_6px_0_var(--point-rim)]"
        >
          내 운세 보러가기
          <ArrowRightIcon className="absolute right-[13px] h-4 w-[23px]" />
        </button>
      </section>

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
    </>
  );
}
