import { ConfirmModal } from "tayeon";

const noop = () => {};

export const LogoutConfirm = () => (
  <ConfirmModal
    title="로그아웃"
    description={"정말 로그아웃 하시겠어요?\n다시 로그인하면 대화가 그대로 남아 있어요."}
    confirmLabel="로그아웃"
    onConfirm={noop}
    onClose={noop}
  />
);

export const DeleteAccount = () => (
  <ConfirmModal
    title="회원 탈퇴"
    description={"탈퇴하면 모든 대화와 보유 이용권이 사라져요.\n이 작업은 되돌릴 수 없어요."}
    confirmLabel="탈퇴하기"
    onConfirm={noop}
    onClose={noop}
  />
);

export const Busy = () => (
  <ConfirmModal
    title="회원 탈퇴"
    description="처리 중에는 확인 버튼이 비활성화돼요."
    confirmLabel="탈퇴하기"
    busy
    onConfirm={noop}
    onClose={noop}
  />
);
