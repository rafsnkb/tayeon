export type TarotCard = {
  id: string;
  nameEn: string;
  nameKo: string;
  upright: string;
  reversed: string;
};

const majorArcana: TarotCard[] = [
  { id: "major-00", nameEn: "The Fool", nameKo: "바보", upright: "새로운 시작, 순수함, 모험심, 자유로운 선택", reversed: "경솔함, 무모함, 준비 부족, 방향성 상실" },
  { id: "major-01", nameEn: "The Magician", nameKo: "마법사", upright: "실행력, 자원의 활용, 의지, 창조적 시작", reversed: "재능 낭비, 속임수, 우유부단, 계획의 좌절" },
  { id: "major-02", nameEn: "The High Priestess", nameKo: "여사제", upright: "직관, 내면의 지혜, 비밀, 신중함", reversed: "억눌린 직관, 표면적 판단, 비밀 노출" },
  { id: "major-03", nameEn: "The Empress", nameKo: "여황제", upright: "풍요, 창조성, 돌봄, 안정적 성장", reversed: "정체, 과잉보호, 창조력 고갈, 의존" },
  { id: "major-04", nameEn: "The Emperor", nameKo: "황제", upright: "권위, 질서, 안정, 통제력", reversed: "경직됨, 독선, 통제 상실, 권위 남용" },
  { id: "major-05", nameEn: "The Hierophant", nameKo: "교황", upright: "전통, 조언, 관습, 신념 체계", reversed: "관습 거부, 독단적 신념, 형식주의" },
  { id: "major-06", nameEn: "The Lovers", nameKo: "연인", upright: "사랑, 조화, 선택, 가치관의 일치", reversed: "갈등, 잘못된 선택, 불균형한 관계" },
  { id: "major-07", nameEn: "The Chariot", nameKo: "전차", upright: "의지, 승리, 추진력, 통제된 전진", reversed: "방향 상실, 공격성, 통제 불능" },
  { id: "major-08", nameEn: "Strength", nameKo: "힘", upright: "내면의 용기, 인내, 부드러운 통제력", reversed: "자기 의심, 나약함, 감정 통제 실패" },
  { id: "major-09", nameEn: "The Hermit", nameKo: "은둔자", upright: "성찰, 내면 탐구, 고독한 지혜", reversed: "고립, 회피, 소통 단절" },
  { id: "major-10", nameEn: "Wheel of Fortune", nameKo: "운명의 수레바퀴", upright: "전환점, 운의 변화, 순환", reversed: "불운, 통제 밖의 변화, 정체" },
  { id: "major-11", nameEn: "Justice", nameKo: "정의", upright: "공정함, 균형, 인과응보, 진실", reversed: "불공정, 편향된 판단, 책임 회피" },
  { id: "major-12", nameEn: "The Hanged Man", nameKo: "매달린 사람", upright: "관점의 전환, 기다림, 자발적 희생", reversed: "정체된 희생, 무의미한 기다림, 저항" },
  { id: "major-13", nameEn: "Death", nameKo: "죽음", upright: "끝과 새로운 시작, 변화, 전환", reversed: "변화 거부, 정체, 미련" },
  { id: "major-14", nameEn: "Temperance", nameKo: "절제", upright: "균형, 조화, 인내, 중용", reversed: "불균형, 과잉, 조급함" },
  { id: "major-15", nameEn: "The Devil", nameKo: "악마", upright: "속박, 집착, 물질적 유혹", reversed: "속박에서의 해방, 자각, 극복" },
  { id: "major-16", nameEn: "The Tower", nameKo: "탑", upright: "급격한 붕괴, 충격적 깨달음, 파괴적 변화", reversed: "붕괴 회피, 지연된 위기, 두려움" },
  { id: "major-17", nameEn: "The Star", nameKo: "별", upright: "희망, 치유, 영감, 밝은 미래", reversed: "절망, 자신감 상실, 방향 상실" },
  { id: "major-18", nameEn: "The Moon", nameKo: "달", upright: "불안, 무의식, 착각, 모호함", reversed: "혼란 해소, 두려움 극복, 진실 발견" },
  { id: "major-19", nameEn: "The Sun", nameKo: "태양", upright: "성공, 활력, 기쁨, 명확함", reversed: "일시적 좌절, 과도한 낙관, 성취 지연" },
  { id: "major-20", nameEn: "Judgement", nameKo: "심판", upright: "각성, 재평가, 부름에 대한 응답", reversed: "자기 부정, 후회, 결단력 부족" },
  { id: "major-21", nameEn: "The World", nameKo: "세계", upright: "완성, 성취, 통합, 순환의 완결", reversed: "미완성, 지연, 목표 근처의 정체" },
];

const suits: { key: string; nameKo: string }[] = [
  { key: "wands", nameKo: "완드" },
  { key: "cups", nameKo: "컵" },
  { key: "swords", nameKo: "소드" },
  { key: "pentacles", nameKo: "펜타클" },
];

const rankMeanings: Record<
  string,
  { nameKo: string; upright: string; reversed: string }
> = {
  ace: { nameKo: "에이스", upright: "새로운 기회의 씨앗, 원초적 에너지", reversed: "기회 지연, 잘못된 시작" },
  "2": { nameKo: "2", upright: "선택의 갈림길, 균형 잡기", reversed: "결정 장애, 불균형" },
  "3": { nameKo: "3", upright: "협력, 초기 성과, 확장", reversed: "협업 실패, 지연된 성과" },
  "4": { nameKo: "4", upright: "안정, 휴식, 기반 다지기", reversed: "정체, 불안정한 안정" },
  "5": { nameKo: "5", upright: "갈등, 경쟁, 시련", reversed: "갈등 해소, 회피" },
  "6": { nameKo: "6", upright: "조화, 회복, 나눔", reversed: "불균형한 관계, 과거 집착" },
  "7": { nameKo: "7", upright: "인내, 도전, 재평가", reversed: "포기, 자신감 상실" },
  "8": { nameKo: "8", upright: "빠른 진전, 움직임", reversed: "지연, 정체" },
  "9": { nameKo: "9", upright: "거의 다다른 성취, 경계심", reversed: "불안, 과도한 방어" },
  "10": { nameKo: "10", upright: "완성, 결실, 다음 단계로의 전환", reversed: "부담, 과잉, 마무리 지연" },
  page: { nameKo: "페이지", upright: "배움의 시작, 호기심, 메시지", reversed: "미숙함, 경솔한 판단" },
  knight: { nameKo: "나이트", upright: "행동, 추진력, 모험", reversed: "성급함, 방향성 부족" },
  queen: { nameKo: "퀸", upright: "성숙한 이해, 포용력, 직관적 통찰", reversed: "감정 기복, 과도한 통제" },
  king: { nameKo: "킹", upright: "숙련된 리더십, 책임감, 통제력", reversed: "권위 남용, 경직됨" },
};

const suitFlavor: Record<string, { upright: string; reversed: string }> = {
  wands: { upright: "열정과 행동의 영역에서", reversed: "열정과 행동의 영역에서" },
  cups: { upright: "감정과 관계의 영역에서", reversed: "감정과 관계의 영역에서" },
  swords: { upright: "생각과 갈등의 영역에서", reversed: "생각과 갈등의 영역에서" },
  pentacles: { upright: "물질과 현실의 영역에서", reversed: "물질과 현실의 영역에서" },
};

const minorArcana: TarotCard[] = suits.flatMap((suit) =>
  Object.entries(rankMeanings).map(([rankKey, rank]) => ({
    id: `${suit.key}-${rankKey}`,
    nameEn: `${rankKey === "ace" ? "Ace" : rank.nameKo} of ${suit.key[0].toUpperCase()}${suit.key.slice(1)}`,
    nameKo: `${suit.nameKo} ${rank.nameKo}`,
    upright: `${suitFlavor[suit.key].upright} ${rank.upright}`,
    reversed: `${suitFlavor[suit.key].reversed} ${rank.reversed}`,
  }))
);

export const tarotDeck: TarotCard[] = [...majorArcana, ...minorArcana];
