// 서버가 강제하는 한도 중 사용자 안내 문구·약관에도 같은 숫자가 등장하는 것들.
// 라우트 안에 지역 상수로만 두면 약관과 조용히 어긋날 수 있어서 밖으로 뺀다.
// (firebase-admin 등 서버 전용 모듈을 import하지 않으므로 클라이언트에서도 안전하다.)

/** 계정당 대화방 보유 상한. 한도에 도달하면 가장 오래된 대화방을 지우고 진행할지 먼저 확인한다.
 *  집행: src/app/api/tarot/rooms/route.ts / 고지: 이용약관·개인정보처리방침, RoomLimitModal. */
export const ROOM_LIMIT = 100;
