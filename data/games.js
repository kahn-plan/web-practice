// 공식 경기 기록 (일정·선발·결과). 매일 아침 예약 작업이 갱신합니다.
// `window.PLAYOFF_DATA = ` 뒤는 그대로 JSON 이어야 합니다 (tests/data.test.js 가 검사).
// home/팀 값: "samsung" | "kia", score: 경기 전이면 null.
// myPick/myScore: 사용자의 예측 (예약 작업은 건드리지 않음). 없으면 "" / null.
window.PLAYOFF_DATA = {
  "updatedAt": "2026-10-30",
  "settings": { "winsNeeded": 3, "topSeed": "samsung" },
  "games": [
    {
      "no": 1,
      "date": "2026-10-26",
      "home": "samsung",
      "spSamsung": "페덱",
      "spKia": "네일",
      "score": { "samsung": 1, "kia": 5 },
      "note": "대구 · 10/25 우천 취소로 26일 18:30 순연",
      "myPick": "kia",
      "myScore": { "samsung": 3, "kia": 5 }
    },
    {
      "no": 2,
      "date": "2026-10-27",
      "home": "samsung",
      "spSamsung": "후라도",
      "spKia": "올러",
      "score": { "samsung": 8, "kia": 3 },
      "note": "대구 18:30",
      "myPick": "",
      "myScore": null
    },
    {
      "no": 3,
      "date": "2026-10-29",
      "home": "kia",
      "spSamsung": "최원태",
      "spKia": "시라카와",
      "score": { "samsung": 6, "kia": 4 },
      "note": "광주 18:30",
      "myPick": "",
      "myScore": null
    },
    {
      "no": 4,
      "date": "2026-10-30",
      "home": "kia",
      "spSamsung": "",
      "spKia": "",
      "score": null,
      "note": "광주 18:30",
      "myPick": "",
      "myScore": null
    }
  ]
};
