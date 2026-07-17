/*
 * Avomatic — 아보카도 숙성도 판별
 *
 * 분류는 Vertex AI에 배포된 실제 학습 모델(avocado-ripening-stage-model-v2)을
 * 백엔드(/api/predict)를 통해 호출한다. 유통기한 계수는 Foods(2024) 논문의
 * "단계 -> 남은 일수 선형 관계" 및 보관 온도 계수를 반영한다.
 */

const STAGES = [
  {
    key: "unripe",
    label: "미숙 (Unripe)",
    emoji: "🥑",
    desc: "아직 단단하고 짙은 녹색이에요. 서두르지 마세요.",
    storageAdvice: "실온에 두면 더 빨리 익어요. 빨리 먹고 싶다면 사과·바나나와 함께 종이봉투에 넣어보세요 (에틸렌 효과).",
    usage: "지금 슬라이스하면 아삭하고 뻑뻑해요. 기다렸다가 드세요.",
    baselineDays: 3,
  },
  {
    key: "breaking",
    label: "브레이킹 (Breaking)",
    emoji: "🥑",
    desc: "녹색에서 갈색으로 넘어가는 중이에요. 거의 다 왔어요.",
    storageAdvice: "적기까지 얼마 남지 않았어요. 냉장 보관하면 속도를 늦출 수 있어요.",
    usage: "하루 이틀 뒤 슬라이스나 토스트용으로 좋아요.",
    baselineDays: 1,
  },
  {
    key: "ripe1",
    label: "적숙 1단계 (Ripe)",
    emoji: "🥑",
    desc: "살짝 눌러보면 부드럽게 들어가요. 지금이 적기의 시작이에요.",
    storageAdvice: "지금 안 드실 거라면 냉장 보관으로 적기를 늘리세요.",
    usage: "슬라이스, 토스트, 샐러드에 딱이에요.",
    windowDays: 2,
  },
  {
    key: "ripe2",
    label: "적숙 2단계 (Ripe+)",
    emoji: "🥑",
    desc: "많이 부드러워졌고 향도 진해졌어요. 지금이 가장 맛있을 때예요.",
    storageAdvice: "지금 드시는 게 가장 좋아요. 남으면 냉장 보관하세요.",
    usage: "과카몰리, 스프레드, 딥에 최적이에요.",
    windowDays: 1,
  },
  {
    key: "overripe",
    label: "과숙 (Overripe)",
    emoji: "🫒",
    desc: "표면이 많이 검고 매우 부드러워요. 갈변이 진행됐을 수 있어요.",
    storageAdvice: "더 이상 기다리지 마세요. 지금 바로 확인해보세요.",
    usage: "내부를 확인해서 갈변이 심하지 않으면 과카몰리로, 심하면 폐기하세요.",
    baselineDays: 0,
  },
];

const dropzone = document.getElementById("dropzone");
const dropzoneEmpty = document.getElementById("dropzoneEmpty");
const fileInput = document.getElementById("fileInput");
const previewImg = document.getElementById("previewImg");
const analyzeBtn = document.getElementById("analyzeBtn");
const analyzeStatus = document.getElementById("analyzeStatus");
const storageGroup = document.getElementById("storageGroup");
const resultCard = document.getElementById("resultCard");

let selectedCoef = 2.3;
let hasImage = false;

// ---------- storage pills ----------
storageGroup.addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if (!btn) return;
  storageGroup.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
  btn.classList.add("active");
  selectedCoef = parseFloat(btn.dataset.coef);
});

// ---------- upload handling ----------
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) loadImage(fileInput.files[0]);
});

["dragover", "dragenter"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("drag-over");
  })
);

["dragleave", "dragend", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
  })
);

dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) loadImage(file);
});

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = () => {
    previewImg.src = reader.result;
    previewImg.classList.remove("hidden");
    dropzoneEmpty.classList.add("hidden");
    hasImage = true;
    analyzeBtn.disabled = false;
    resultCard.classList.add("hidden");
    analyzeStatus.textContent = "";
  };
  reader.readAsDataURL(file);
}

// ---------- analyze ----------
analyzeBtn.addEventListener("click", async () => {
  if (!hasImage) return;
  analyzeBtn.disabled = true;
  analyzeStatus.textContent = "🥑 이미지를 분석하는 중...";

  try {
    const { content, mimeType } = dataUrlToBase64(previewImg.src);
    const { stageIndex, confidence } = await apiFetch("/api/predict", {
      method: "POST",
      body: JSON.stringify({ content, mimeType }),
    });

    renderResult(STAGES[stageIndex], stageIndex, confidence);
    analyzeBtn.textContent = "🔄 다시 분석하기";
    analyzeStatus.textContent = "";
  } catch (err) {
    analyzeStatus.textContent = `⚠️ ${err.message}`;
  } finally {
    analyzeBtn.disabled = false;
  }
});

function dataUrlToBase64(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mimeType = header.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
  return { content: base64, mimeType };
}

// ---------- ETA / result rendering ----------
function computeEta(stageIndex, coef) {
  const stage = STAGES[stageIndex];

  if (stageIndex === 4) {
    return { text: "이미 늦었어요 — 지금 상태를 확인하세요" };
  }

  if (stageIndex === 2 || stageIndex === 3) {
    const windowDays = Math.max(0, Math.round(stage.windowDays * coef));
    return {
      text: windowDays > 0
        ? `지금 드세요! 약 ${windowDays}일간 이 상태가 유지돼요`
        : "지금 드세요! 오늘 안에 드시는 게 가장 좋아요",
    };
  }

  const days = Math.max(0, Math.round(stage.baselineDays * coef));
  if (days === 0) {
    return { text: "곧 적기예요 — 오늘 중 확인해보세요" };
  }
  const target = new Date();
  target.setDate(target.getDate() + days);
  const dateLabel = target.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  return { text: `${days}일 후(${dateLabel})가 적기예요` };
}

function renderResult(stage, stageIndex, confidence) {
  document.getElementById("stageEmoji").textContent = stage.emoji;
  document.getElementById("stageLabel").textContent = stage.label;
  document.getElementById("stageDesc").textContent = stage.desc;

  const pct = Math.round(confidence * 100);
  document.getElementById("confidenceValue").textContent = `${pct}%`;
  document.getElementById("confidenceRing").style.background =
    `conic-gradient(var(--green-mid) ${pct * 3.6}deg, var(--cream-dark) 0deg)`;

  const eta = computeEta(stageIndex, selectedCoef);
  document.getElementById("etaText").textContent = eta.text;

  document.getElementById("storageAdvice").textContent = stage.storageAdvice;
  document.getElementById("usageAdvice").textContent = stage.usage;

  const warningEl = document.getElementById("lowConfidenceWarning");
  const warningText = document.getElementById("warningText");
  if (confidence < 0.55) {
    warningEl.classList.remove("hidden");
    warningText.textContent = "신뢰도가 낮아요. 자연광 아래에서 아보카도 전체가 나오도록 다시 찍어보면 더 정확해질 수 있어요.";
  } else {
    warningEl.classList.add("hidden");
  }

  resultCard.classList.remove("hidden");
  resultCard.scrollIntoView({ behavior: "smooth", block: "center" });
}
