"use client";

import { useState } from "react";
import { openMenu } from "@/lib/ui/menuBus";
import { TarotFortuneToggle } from "@/components/TarotFortuneToggle";
import { MainCompanyInfo } from "@/components/MainCompanyInfo";
import LoginModal from "@/components/LoginModal";
import { MenuIcon, ArrowRightIcon } from "../tarot/icons";

/** 운세 소개 화면(목업 New/`Main_Fortune_Dark`·`Main_Fortune_Light`).
 *
 *  **비로그인에게만 보인다** — 로그인한 사람은 토글을 누르면 상품 목록(`FortuneScreen`)으로
 *  바로 간다(2026-09-26 사용자 결정). 그래서 "내 운세 보러가기"는 여기서 로그인의 문이다.
 *
 *  실측(목업 1236px = 뷰포트 412px, 3배):
 *    · 안내 첫 줄·마지막 두 줄 14px `--placeholder`, 마지막 두 줄 줄높이 25
 *    · 가운데 질문 6줄 18px Bold `--bold-text`, 줄 간격 27(토큰 `--text-lg--line-height` 28 과
 *      1px 차이라 토큰을 그대로 쓴다)
 *    · 안내 첫 줄 → 질문 블록 16, 질문 블록 → 마지막 두 줄 8
 *    · CTA 260x48 rounded-full, 라벨 16px Bold 가운데, 화살표 23x16 오른쪽 안쪽 13
 *    · 상단바 아래~사업자정보 사이가 **[여백 97][글 248][여백 103][CTA 48][여백 95]** 로
 *      세 여백이 사실상 같다 → `justify-evenly` 한 줄로 떨어진다
 *    · 바닥의 코랄 글로우는 대화 화면과 같은 `.chat-glow`, 사업자정보는 초기 화면과 같은
 *      `MainCompanyInfo`(전자상거래법 표시 — 화면이 갈려도 같은 컴포넌트를 쓴다) */

/** 목업에 적힌 그대로다. 문장을 다듬지 않는다 — 화면으로 바로 나가는 값이다. */
const QUESTIONS = [
  "‘이번에는 대학에 붙을 수 있을까?’",
  "‘언제쯤 취업이 될까?’",
  "‘내 미래의 애인은 누굴까?’",
  "‘나는 돈을 얼마나 많이 벌 수 있을까?’",
  "‘결혼은 언제 어떤 사람이랑 하게 될까?’",
  "‘아이가 언제쯤 생길까?’",
];

export function FortuneIntro() {
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <div className="chat-glow relative flex h-full min-h-0 flex-col overflow-hidden bg-bg">
      <div className="app-topbar-glass relative z-20 flex h-16 shrink-0 items-center border-b border-border">
        <button
          type="button"
          onClick={openMenu}
          aria-label="메뉴 열기"
          className="flex h-16 w-16 shrink-0 items-center justify-center text-icon-muted xl:hidden"
        >
          <MenuIcon className="h-3 w-5" />
        </button>
        <div className="flex flex-1 justify-center">
          <TarotFortuneToggle active="fortune" />
        </div>
        <div className="w-16 shrink-0 xl:w-4" aria-hidden="true" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4">
          <div className="flex flex-1 flex-col items-center justify-evenly py-6 text-center">
            <div>
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
            </div>

            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="point-pill relative flex h-12 w-[260px] shrink-0 items-center justify-center rounded-full text-base font-bold shadow-[0_0_20px_3px_var(--point-glow),inset_0_0_6px_0_var(--point-rim)]"
            >
              {/* 로그인하면 이 화면 자체가 목록으로 바뀐다 — 여기서 따로 이동시키지 않는다. */}
              내 운세 보러가기
              <ArrowRightIcon className="absolute right-[13px] h-4 w-[23px]" />
            </button>
          </div>

          <MainCompanyInfo />
        </div>
      </div>

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
    </div>
  );
}
