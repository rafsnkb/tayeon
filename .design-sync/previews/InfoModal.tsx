import { InfoModal } from "tayeon";

const noop = () => {};

// title is the whole body — it renders with whitespace-pre-line, so line
// breaks in the string are the intended way to write a two-line message.
export const Info = () => (
  <InfoModal title={"프로필을 저장했어요.\n이후 리딩부터 반영됩니다."} onClose={noop} />
);

export const Error = () => (
  <InfoModal
    tone="error"
    title={"결제에 실패했어요.\n다른 결제 수단으로 다시 시도해 주세요."}
    onClose={noop}
  />
);
