/*
 * Avomatic — 아보카도 숙성도 판별 데모
 *
 * 여기서 쓰는 분류기는 실제 학습된 CNN이 아니라, 업로드한 사진의 색상 통계
 * (밝기, 녹색 비율)을 5개의 대표 프로토타입과 비교하는 경량 휴리스틱이다.
 * PRD가 근거로 삼는 Foods(2024) 논문/데이터셋의 "단계 -> 남은 일수 선형 관계"와
 * 보관 온도 계수만 실제 수치를 반영했고, 이미지 분류 자체는 데모용 근사치다.
 */

const STAGES = [
  {
    key: "unripe",
    label: "미숙 (Unripe)",
    emoji: "🥑",
    desc: "아직 단단하고 짙은 녹색이에요. 서두르지 마세요.",
    storageAdvice: "실온에 두면 더 빨리 익어요. 빨리 먹고 싶다면 사과·바나나와 함께 종이봉투에 넣어보세요 (에틸렌 효과).",
    usage: "지금 슬라이스하면 아삭하고 뻑뻑해요. 기다렸다가 드세요.",
    centroid: { brightness: 0.58, green: 0.40 },
    baselineDays: 3,
  },
  {
    key: "breaking",
    label: "브레이킹 (Breaking)",
    emoji: "🥑",
    desc: "녹색에서 갈색으로 넘어가는 중이에요. 거의 다 왔어요.",
    storageAdvice: "적기까지 얼마 남지 않았어요. 냉장 보관하면 속도를 늦출 수 있어요.",
    usage: "하루 이틀 뒤 슬라이스나 토스트용으로 좋아요.",
    centroid: { brightness: 0.47, green: 0.37 },
    baselineDays: 1,
  },
  {
    key: "ripe1",
    label: "적숙 1단계 (Ripe)",
    emoji: "🥑",
    desc: "살짝 눌러보면 부드럽게 들어가요. 지금이 적기의 시작이에요.",
    storageAdvice: "지금 안 드실 거라면 냉장 보관으로 적기를 늘리세요.",
    usage: "슬라이스, 토스트, 샐러드에 딱이에요.",
    centroid: { brightness: 0.37, green: 0.335 },
    windowDays: 2,
  },
  {
    key: "ripe2",
    label: "적숙 2단계 (Ripe+)",
    emoji: "🥑",
    desc: "많이 부드러워졌고 향도 진해졌어요. 지금이 가장 맛있을 때예요.",
    storageAdvice: "지금 드시는 게 가장 좋아요. 남으면 냉장 보관하세요.",
    usage: "과카몰리, 스프레드, 딥에 최적이에요.",
    centroid: { brightness: 0.27, green: 0.305 },
    windowDays: 1,
  },
  {
    key: "overripe",
    label: "과숙 (Overripe)",
    emoji: "🫒",
    desc: "표면이 많이 검고 매우 부드러워요. 갈변이 진행됐을 수 있어요.",
    storageAdvice: "더 이상 기다리지 마세요. 지금 바로 확인해보세요.",
    usage: "내부를 확인해서 갈변이 심하지 않으면 과카몰리로, 심하면 폐기하세요.",
    centroid: { brightness: 0.16, green: 0.29 },
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
analyzeBtn.addEventListener("click", () => {
  if (!hasImage) return;
  analyzeBtn.disabled = true;
  analyzeStatus.textContent = "🥑 이미지를 분석하는 중...";

  setTimeout(() => {
    const metrics = analyzeImageColors(previewImg);
    const { stageIndex, confidence } = classify(metrics);
    const stage = STAGES[stageIndex];
    const lightingIssue = metrics.brightness < 0.14 || metrics.brightness > 0.9;

    renderResult(stage, stageIndex, confidence, lightingIssue);

    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "🔄 다시 분석하기";
    analyzeStatus.textContent = "";
  }, 700);
});

function analyzeImageColors(imgEl) {
  const size = 80;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgEl, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count++;
  }
  r /= count;
  g /= count;
  b /= count;

  const brightness = (r + g + b) / 3 / 255;
  const green = g / (r + g + b + 1e-6);
  return { brightness, green };
}

function classify(metrics) {
  const distances = STAGES.map((stage) => {
    const db = metrics.brightness - stage.centroid.brightness;
    const dg = (metrics.green - stage.centroid.green) * 2.5;
    return Math.sqrt(db * db + dg * dg);
  });

  const minDist = Math.min(...distances);
  const stageIndex = distances.indexOf(minDist);

  const scores = distances.map((d) => Math.exp(-d * 12));
  const total = scores.reduce((a, b) => a + b, 0);
  const confidence = scores[stageIndex] / total;

  return { stageIndex, confidence };
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

function renderResult(stage, stageIndex, confidence, lightingIssue) {
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
  const lowConfidence = confidence < 0.55;
  if (lowConfidence || lightingIssue) {
    warningEl.classList.remove("hidden");
    warningText.textContent = lightingIssue
      ? "조명이 너무 어둡거나 밝아서 판별이 부정확할 수 있어요. 자연광 아래에서 아보카도 전체가 나오도록 다시 찍어보세요."
      : "신뢰도가 낮아요. 다른 각도나 조명에서 다시 찍어보면 더 정확해질 수 있어요.";
  } else {
    warningEl.classList.add("hidden");
  }

  resultCard.classList.remove("hidden");
  resultCard.scrollIntoView({ behavior: "smooth", block: "center" });
}
