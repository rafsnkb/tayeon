import { SupportCenter } from "tayeon";

const faqs = [
  {
    question: "이용권은 언제까지 쓸 수 있나요?",
    answer: "횟수제 이용권은 구매일로부터 1년, 시간제 이용권은 활성화 후 남은 시간 동안 사용할 수 있어요.",
  },
  {
    question: "결제를 취소하고 싶어요.",
    answer: "사용하지 않은 이용권은 구매 후 7일 이내에 전액 환불됩니다. 문의하기로 연락해 주세요.",
  },
  {
    question: "생년월일을 잘못 입력했어요.",
    answer: "내 정보 > 프로필에서 언제든 수정할 수 있어요. 수정하면 이후 리딩부터 반영됩니다.",
  },
];

export const Default = () => (
  <div className="w-[420px] bg-bg p-4">
    <SupportCenter faqs={faqs} />
  </div>
);
