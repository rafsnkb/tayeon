import SubPageTopBar from "@/components/SubPageTopBar";

type License = { name: string; license: string };

// 실제로 서비스에 쓰이는 런타임 의존성만 나열한다(src/package.json의 dependencies 기준,
// devDependencies는 빌드 도구라 제외). 버전이 바뀌어도 라이선스 종류 자체가 바뀌는 일은 드물어서
// 패키지 업데이트마다 매번 다시 확인할 필요는 없지만, 새 의존성을 추가하면 이 목록에도 추가할 것.
const LIBRARIES: License[] = [
  { name: "Next.js", license: "MIT" },
  { name: "React / React DOM", license: "MIT" },
  { name: "Firebase / Firebase Admin SDK", license: "Apache-2.0" },
  { name: "Anthropic SDK", license: "MIT" },
  { name: "iztro", license: "MIT" },
  { name: "manseryeok", license: "MIT" },
  { name: "PortOne SDK (browser / server)", license: "Apache-2.0 / MIT" },
  { name: "OpenTelemetry API", license: "Apache-2.0" },
];

export default function OpenSourcePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg xl:h-full xl:overflow-hidden">
      <SubPageTopBar title="오픈소스 라이선스" />
      <div className="flex-1 overflow-y-auto p-4 pt-20">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          <p className="px-1 text-sm text-icon-muted">
            타연은 아래 오픈소스 라이브러리를 사용해 만들어졌습니다. 각 라이브러리의 저작권은 원 저작자에게 있습니다.
          </p>
          <div className="divide-y divide-border rounded-[28px] border border-border bg-topbar">
            {LIBRARIES.map((lib) => (
              <div key={lib.name} className="flex items-center justify-between gap-3 px-5 py-4">
                <p className="min-w-0 truncate text-sm font-semibold text-bold-text">{lib.name}</p>
                <span className="shrink-0 rounded-full bg-chip-fill px-2.5 py-1 text-xs font-semibold text-white">
                  {lib.license}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
