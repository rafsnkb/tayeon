// 피그마 디자인(다크모드 기준, node 5:6 등)에서 내보낸 아이콘들을 React 컴포넌트로 옮긴 것.
// 전부 stroke="currentColor"라 부모의 text-* 클래스로 색을 제어한다.
import type { SVGProps } from "react";

export function BackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="12" height="22" viewBox="0 0 12 22" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M11 21L1 11L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="12" viewBox="0 0 20 12" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M1 11H19M1 6H19M1 1H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SendIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="23" height="22" viewBox="0 0 23 22" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M11.4944 17.5003L11.4944 9.67062M13.11 3.27675L20.5451 17.321C21.2115 18.5796 21.5448 19.2093 21.4489 19.6243C21.3658 19.9843 21.1146 20.2817 20.7732 20.4229C20.3796 20.5856 19.7029 20.3606 18.3514 19.9101L12.0723 17.8171C11.8578 17.7456 11.7509 17.7102 11.6412 17.696C11.5438 17.6834 11.4454 17.6828 11.3481 17.6954C11.2408 17.7092 11.1359 17.7442 10.931 17.8126L4.63738 19.9104C3.28592 20.3609 2.60994 20.586 2.21627 20.4232C1.87486 20.282 1.62313 19.9846 1.54001 19.6247C1.44416 19.2096 1.77719 18.5797 2.44372 17.3207L9.87891 3.27648C10.4029 2.28669 10.6652 1.79173 11.0147 1.62993C11.3191 1.48899 11.6701 1.48883 11.9745 1.62977C12.3239 1.79149 12.5858 2.28634 13.1093 3.27514L13.11 3.27675Z" stroke="currentColor" strokeWidth="3.0483" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RoomInfoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="4" viewBox="0 0 16 4" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M13 2C13 2.55228 13.4477 3 14 3C14.5523 3 15 2.55228 15 2C15 1.44772 14.5523 1 14 1C13.4477 1 13 1.44772 13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 2C7 2.55228 7.44772 3 8 3C8.55228 3 9 2.55228 9 2C9 1.44772 8.55228 1 8 1C7.44772 1 7 1.44772 7 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 2C1 2.55228 1.44772 3 2 3C2.55228 3 3 2.55228 3 2C3 1.44772 2.55228 1 2 1C1.44772 1 1 1.44772 1 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NewChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="23" height="23" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M11.5 14.8334V11.5M11.5 11.5V8.16668M11.5 11.5H14.8333M11.5 11.5H8.16667M11.4999 21.5C13.3166 21.5 15.0203 21.0155 16.4886 20.1687C16.6337 20.085 16.7063 20.0432 16.7745 20.0244C16.838 20.0068 16.8947 20.0009 16.9605 20.0054C17.0305 20.0102 17.103 20.0343 17.2471 20.0824L19.8133 20.9377L19.8153 20.9387C20.3568 21.1192 20.628 21.2096 20.8083 21.1453C20.9653 21.0893 21.0891 20.9653 21.1451 20.8082C21.2094 20.6281 21.1192 20.3577 20.939 19.817L20.9379 19.8137L20.0837 17.2509L20.0817 17.2456C20.034 17.1027 20.0099 17.0304 20.0052 16.9607C20.0007 16.8949 20.0067 16.8378 20.0242 16.7743C20.0428 16.707 20.0839 16.6358 20.1654 16.4945L20.1687 16.4888C21.0155 15.0205 21.5 13.3168 21.5 11.5C21.5 5.97716 17.0228 1.5 11.5 1.5C5.97715 1.5 1.5 5.97716 1.5 11.5C1.5 17.0229 5.97701 21.5 11.4999 21.5Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SajuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="23" viewBox="0 0 22 23" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M11 1.02056C5.47715 1.02056 1 5.49771 1 11.0206C1 16.5434 5.47715 21.0206 11 21.0206M11 1.02056C16.5228 1.02056 21 5.49771 21 11.0206C21 16.5434 16.5228 21.0206 11 21.0206M11 1.02056C12.6667 0.853894 16 1.62056 16 6.02056C16 10.4206 12.6667 11.1872 11 11.0206C9.33333 11.1872 6 12.4206 6 16.0206C6 19.6206 9.33333 20.8539 11 21.0206M11 15.0206C10.4477 15.0206 10 15.4683 10 16.0206C10 16.5728 10.4477 17.0206 11 17.0206C11.5523 17.0206 12 16.5728 12 16.0206C12 15.4683 11.5523 15.0206 11 15.0206ZM11 5.02056C10.4477 5.02056 10 5.46828 10 6.02056C10 6.57284 10.4477 7.02056 11 7.02056C11.5523 7.02056 12 6.57284 12 6.02056C12 5.46828 11.5523 5.02056 11 5.02056Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ZiweiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M6.5 6L4.5 11M6 15L11 17M15 16L17.5 10M16 6.5L10 4.5M7.5 1C6.11929 1 5 2.11929 5 3.5C5 4.88071 6.11929 6 7.5 6C8.88071 6 10 4.88071 10 3.5C10 2.11929 8.88071 1 7.5 1ZM18.5 5C17.1193 5 16 6.11929 16 7.5C16 8.88071 17.1193 10 18.5 10C19.8807 10 21 8.88071 21 7.5C21 6.11929 19.8807 5 18.5 5ZM13.5 16C12.1193 16 11 17.1193 11 18.5C11 19.8807 12.1193 21 13.5 21C14.8807 21 16 19.8807 16 18.5C16 17.1193 14.8807 16 13.5 16ZM3.5 11C2.11929 11 1 12.1193 1 13.5C1 14.8807 2.11929 16 3.5 16C4.88071 16 6 14.8807 6 13.5C6 12.1193 4.88071 11 3.5 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CompatibilityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="19" viewBox="0 0 22 19" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M21 17.9999C21 16.0261 19.1449 14.3469 16.5556 13.7245M14.3333 18C14.3333 15.4963 11.3486 13.4667 7.66667 13.4667C3.98477 13.4667 1 15.4963 1 18M14.3333 10.0667C16.7879 10.0667 18.7778 8.03702 18.7778 5.53333C18.7778 3.02964 16.7879 1 14.3333 1M7.66667 10.0667C5.21207 10.0667 3.22222 8.03702 3.22222 5.53333C3.22222 3.02964 5.21207 1 7.66667 1C10.1213 1 12.1111 3.02964 12.1111 5.53333C12.1111 8.03702 10.1213 10.0667 7.66667 10.0667Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TimepassIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="15" viewBox="0 0 22 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M13.2223 1H4.33335C3.29792 1 2.77992 1 2.37154 1.16493C1.82703 1.38483 1.3947 1.80687 1.16916 2.33777C1 2.73594 1 3.24071 1 4.25025C2.84096 4.25025 4.33335 5.70483 4.33335 7.49975C4.33335 9.29468 2.84096 10.75 1 10.75C1 11.7595 1 12.2643 1.16916 12.6625C1.3947 13.1934 1.82703 13.6151 2.37154 13.835C2.77992 13.9999 3.29792 14 4.33335 14H13.2223M13.2223 1H17.6668C18.7022 1 19.2199 1 19.6283 1.16493C20.1728 1.38483 20.6053 1.80687 20.8308 2.33777C21 2.73594 21 3.24071 21 4.25025C19.159 4.25025 17.6668 5.70507 17.6668 7.5C17.6668 9.29493 19.159 10.75 21 10.75C21 11.7595 21 12.2643 20.8308 12.6625C20.6053 13.1934 20.1728 13.6151 19.6283 13.835C19.2199 13.9999 18.7022 14 17.6668 14H13.2223M13.2223 1V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M20.9999 20.9999L11 11M11 11L1 1M11 11L21 1M11 11L1 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M1 5L4.5 8.5L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M8 1V15M1 8H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 스프레드 선택 리스트용 아이콘 (원카드는 벡터가 아니라 둥근 사각형 하나라 별도 export 없이 직접 그림)
export function SpreadOneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="24" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="2" y="2" width="16" height="20" rx="4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function SpreadThreeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="20" viewBox="0 0 22 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M4.10269 17.7706L1.06685 6.17947C0.787412 5.11254 1.40631 4.01586 2.4492 3.72998L4.10269 3.27671M17.7239 3.22931L19.5503 3.72998C20.5932 4.01586 21.2121 5.11253 20.9327 6.17947L17.8968 17.7706C17.8556 17.9281 17.7971 18.0761 17.7239 18.2131M7.94926 19H13.814C14.8937 19 15.769 18.1046 15.769 17V3C15.769 1.89543 14.8937 1 13.814 1H7.94926C6.86958 1 5.99433 1.89543 5.99433 3V17C5.99433 18.1046 6.86958 19 7.94926 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SpreadDualIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M11 1V21M5 19H17C19.2091 19 21 17.2091 21 15V7C21 4.79086 19.2091 3 17 3H5C2.79086 3 1 4.79086 1 7V15C1 17.2091 2.79086 19 5 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SpreadCelticIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M4 3C4 1.89543 4.89543 1 6 1H16C17.1046 1 18 1.89543 18 3V19C18 20.1046 17.1046 21 16 21H6C4.89543 21 4 20.1046 4 19V3Z" stroke="currentColor" strokeWidth="2" />
      <path d="M2.5 17C1.67157 17 1 16.3284 1 15.5V6.5C1 5.67157 1.67157 5 2.5 5C3.32843 5 4 5.67157 4 6.5V15.5C4 16.3284 3.32843 17 2.5 17Z" stroke="currentColor" strokeWidth="2" />
      <path d="M19.5 17C18.6716 17 18 16.3284 18 15.5V6.5C18 5.67157 18.6716 5 19.5 5C20.3284 5 21 5.67157 21 6.5V15.5C21 16.3284 20.3284 17 19.5 17Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

// 아래는 MyPage 허브 등 새 화면에서 쓰는 범용 아이콘들 — Figma REST API가 플랜 한도(Starter,
// 4.6일 재설정)에 걸려 원본 벡터를 더 이상 내보낼 수 없어서, 스크린샷(asset/Screen/*.png)을 보고
// 표준적인 UI 아이콘 형태(돋보기/장바구니/카드/리스트/톱니바퀴 등 — 특정 브랜드 일러스트가 아닌
// 범용 글리프)로 다시 그렸다(2026-09-14).
export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="8" height="16" viewBox="0 0 8 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M1 1L7 8L1 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** ChevronRightIcon 의 좌우 대칭 — 캐러셀 화살표처럼 둘이 나란히 놓이는 자리는 규격이 같아야
 *  한다(BackIcon 은 상단바용으로 12x22 라 짝이 안 맞는다). */
export function ChevronLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="8" height="16" viewBox="0 0 8 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M7 1L1 8L7 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 접기/펼치기용. 좌우 셰브론과 같은 획(2px, 둥근 끝)이되 가로로 누운 규격이라 viewBox 가
 *  뒤집혀 있다 — 같은 아이콘을 rotate 로 돌려 쓰면 획 끝이 미세하게 어긋난다. */
export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="8" viewBox="0 0 16 8" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M1 1L8 7L15 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M19 19L14.5 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function InvitePersonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="8" cy="4" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M1 15C1 11.134 4.13401 8 8 8C10.1 8 11.98 8.93 13.24 10.41" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 4V10M13 7H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M1 1H3L5.4 12.2C5.5 12.9 6.1 13.4 6.8 13.4H15.3C16 13.4 16.6 12.9 16.7 12.2L18 5H4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7.5" cy="17.5" r="1.3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="15" cy="17.5" r="1.3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function CardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="1" y="1" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M1 6H19" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 11H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ListIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M1 1H19M1 7H19M1 13H12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IdCardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="1" y="1" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="6.5" cy="7" r="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 5.5H16M12 8.5H15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function PersonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="8" cy="5" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M1 19C1 14.5817 4.13401 11 8 11C11.866 11 15 14.5817 15 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CompassIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13.5 6.5L11.2 11.2L6.5 13.5L8.8 8.8L13.5 6.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function GearIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="18" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="10" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M10 1V3M10 15V17M2.5 5L4.2 6M15.8 12L17.5 13M2.5 13L4.2 12M15.8 6L17.5 5M1 9H3M17 9H19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LogoutDoorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M8 1H3C1.89543 1 1 1.89543 1 3V17C1 18.1046 1.89543 19 3 19H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13 14L18 9L13 4M18 9H7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M12.5 1.5L16.5 5.5L6 16H2V12L12.5 1.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 4L14 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M1 4H15M6 4V2C6 1.44772 6.44772 1 7 1H9C9.55228 1 10 1.44772 10 2V4M12.5 4L12 16C11.95 16.55 11.5 17 10.95 17H5.05C4.5 17 4.05 16.55 4 16L3.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 원 안의 물음표. 목업(MyProfile_*)이 "태어난 시간" 안내문 앞에 두는 것 — 옆의
 *  InfoCircleIcon("i")과 쓰임이 다르다: 이건 제약을 알려 주는 자리다. */
export function QuestionCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M6.2 6.1C6.2 5.1 6.98 4.4 8 4.4C9.02 4.4 9.8 5.1 9.8 6.05C9.8 6.85 9.35 7.2 8.75 7.6C8.3 7.9 8 8.2 8 8.9V9.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="8" cy="11.3" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function InfoCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 7.2V11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="4.7" r="0.9" fill="currentColor" />
    </svg>
  );
}

// 표준 "영화표" 모양 글리프 — 피그마 원본 export가 아니라 직접 그린 범용 아이콘(쿼터 소진 이후 예외).
export function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M9 1.5C6.51472 1.5 4.5 3.51472 4.5 6V9.1893C4.5 10.0533 4.16295 10.8827 3.56282 11.5041L2.68306 12.4128C1.63611 13.4949 2.29053 15.5 3.78415 15.5H14.2158C15.7095 15.5 16.3639 13.4949 15.3169 12.4128L14.4372 11.5041C13.837 10.8827 13.5 10.0533 13.5 9.1893V6C13.5 3.51472 11.4853 1.5 9 1.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.75 18C7.05 18.75 7.85 19.5 9 19.5C10.15 19.5 10.95 18.75 11.25 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TicketIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M1 6.4C1.99 6.4 2.8 5.5 2.8 4.4C2.8 3.3 1.99 2.4 1 2.4V2C1 1.44772 1.44772 1 2 1H18C18.5523 1 19 1.44772 19 2V2.4C18.01 2.4 17.2 3.3 17.2 4.4C17.2 5.5 18.01 6.4 19 6.4V9.6C18.01 9.6 17.2 10.5 17.2 11.6C17.2 12.7 18.01 13.6 19 13.6V14C19 14.5523 18.5523 15 18 15H2C1.44772 15 1 14.5523 1 14V13.6C1.99 13.6 2.8 12.7 2.8 11.6C2.8 10.5 1.99 9.6 1 9.6V6.4Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M10 2V15" stroke="currentColor" strokeWidth="1.4" strokeDasharray="1.6 1.6" strokeLinecap="round" />
    </svg>
  );
}

