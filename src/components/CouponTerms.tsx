import Link from "next/link";
import { EXPIRED_COUPON_RETENTION_DAYS } from "@/lib/payment/discountCoupon";

/** 쿠폰 안내 문구. **두 탭이 같은 문구를 보여주므로**(목업 Coupon_Apply·Coupon_List) 한 곳에
 *  둔다 — 양쪽에 복사하면 한쪽만 고쳐져서 같은 화면의 두 탭이 서로 다른 말을 하게 된다.
 *
 *  문구는 약관 제8조의2 와 짝이다. 여기를 고치면 그쪽도 같이 봐야 한다. */
export default function CouponTerms() {
  return (
    <ul className="list-disc space-y-2 pl-5 text-sm font-semibold leading-6 text-icon-muted marker:text-icon-muted">
      <li>할인 쿠폰은 쿠폰 1개당 계정에 1회만 등록할 수 있습니다.</li>
      <li>쿠폰에 따라 등록 인원이 제한될 수 있으며, 한도에 도달하면 등록할 수 없습니다.</li>
      <li>
        사용 가능한 할인 쿠폰이 있으면 결제 1회에 대해 자동으로 할인된 가격이 적용됩니다. 구매
        화면에서 이번 결제에는 쿠폰을 사용하지 않도록 선택할 수 있습니다.
      </li>
      <li>만료된 쿠폰은 사용할 수 없습니다.</li>
      <li>
        할인 쿠폰을 사용해 상품을 구매한 뒤 환불한 경우, 쿠폰은 다시 사용할 수 있는 상태로
        돌아갑니다. 다만 쿠폰의 유효기간이 지난 뒤에는 사용할 수 없습니다.
      </li>
      <li>
        사용하지 않은 채 만료된 쿠폰은 본 화면에 최대 {EXPIRED_COUPON_RETENTION_DAYS}일 동안
        노출된 후 삭제됩니다. 사용한 쿠폰의 내역은 계속 확인할 수 있습니다.
      </li>
      <li>
        쿠폰을 사용한 경우, 보너스 리워드와 친구 초대 리워드는 상품의 원래 가격이 아닌 할인
        가격을 기준으로 합산됩니다.
      </li>
      <li>
        자세한 내용은{" "}
        <Link href="/terms" className="font-bold text-point-text underline underline-offset-2">
          이용약관
        </Link>
        을 확인해주세요.
      </li>
    </ul>
  );
}
