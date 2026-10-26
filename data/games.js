// 공식 경기 기록 (일정·선발·결과). 매일 아침 예약 작업이 갱신합니다.
// `window.PLAYOFF_DATA = ` 뒤는 그대로 JSON 이어야 합니다 (tests/data.test.js 가 검사).
// home/팀 값: "samsung" | "kia", score: 경기 전이면 null.
// myPick/myScore: 사용자의 예측 (예약 작업은 건드리지 않음). 없으면 "" / null.
window.PLAYOFF_DATA = {
  "updatedAt": "2026-10-26",
  "settings": { "winsNeeded": 3, "topSeed": "samsung" },
  "games": [
    {
      "no": 1,
      "date": "2026-10-26",
      "home": "samsung",
      "spSamsung": "",
      "spKia": "",
      "score": null,
      "note": "대구 · 10/25 우천 취소로 26일 18:30 순연",
      "myPick": "kia",
      "myScore": { "samsung": 3, "kia": 5 }
    }
  ]
};
