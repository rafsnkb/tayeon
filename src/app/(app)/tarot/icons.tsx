// 피그마 디자인(다크모드 기준, node 5:6 등)에서 내보낸 아이콘들을 React 컴포넌트로 옮긴 것.
// 전부 stroke="currentColor"라 부모의 text-* 클래스로 색을 제어한다.
import type { SVGProps } from "react";

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
