import type { BirthInfo, CalendarMode } from "@/lib/tarot/birthInfo";
import { partnerToBirthInfo } from "@/lib/tarot/partner";
import type { Partner } from "@/lib/tarot/RoomsContext";
import { toCalendarMode } from "@/lib/tarot/birthInfo";

/** 구매 화면의 상대방 입력칸 한 벌. `/compatibility` 의 폼과 칸이 같지만 **저장하지 않는다** —
 *  여기서 고친 값은 이 주문에만 쓰이고 상대 프로필(`/api/user/partner`)을 건드리지 않는다.
 *  목업의 「상대방 닉네임 (변경 가능)」이 그 뜻이다.
 *
 *  `timeUnknown` 칸이 따로 없다. 목업의 이 화면에는 「태어난 시간을 몰라요」 체크가 없고 빈
 *  시간칸과 그 아래 경고문만 있다 — **비어 있으면 모르는 것**으로 읽는다. */
export type PartnerForm = {
  nickname: string;
  calendarMode: CalendarMode;
  birthDate: string;
  birthTime: string;
  gender: Partner["gender"];
  birthPlace: string;
};

export const EMPTY_PARTNER_FORM: PartnerForm = {
  nickname: "",
  calendarMode: "solar",
  birthDate: "",
  birthTime: "",
  gender: "unspecified",
  birthPlace: "",
};

/** 저장돼 있는 상대 프로필을 폼 모양으로 편다. 「내가 등록한 상대방 프로필 정보를 사용할게요」를
 *  켤 때 쓴다. `/compatibility` 가 마운트 때 하는 것과 같은 변환이다. */
export function partnerToForm(partner: Partner): PartnerForm {
  return {
    nickname: partner.nickname,
    calendarMode: toCalendarMode(partner.calendarType, partner.isLeapMonth),
    birthDate: partner.birthDate ?? "",
    birthTime: partner.birthTime ?? "",
    gender: partner.gender,
    birthPlace: partner.birthPlace ?? "",
  };
}

/** 폼을 계산 계층이 받는 `BirthInfo` 로 바꾼다. 생년월일이 없으면 null — 아직 팔 수 없다.
 *
 *  자시법·진태양시를 안 받는 것은 상대 프로필과 **같은 규칙**이다(`partnerToBirthInfo` 주석:
 *  마찰을 줄이려고 일반 자시법·보정 없음 고정). 그 규칙을 여기서 다시 쓰지 않으려고 폼을
 *  `Partner` 로 되돌린 뒤 그 함수에 넘긴다 — 기본값이 두 벌이 되면 한쪽만 바뀐다. */
export function partnerFormToBirthInfo(form: PartnerForm): BirthInfo | null {
  if (!form.birthDate) return null;
  return partnerToBirthInfo({
    nickname: form.nickname,
    birthDate: form.birthDate,
    birthTime: form.birthTime || null,
    gender: form.gender,
    calendarType: form.calendarMode === "solar" ? "solar" : "lunar",
    isLeapMonth: form.calendarMode === "lunarLeap",
    birthPlace: form.birthPlace || null,
  });
}
