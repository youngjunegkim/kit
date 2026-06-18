(function () {
  const form = document.querySelector("[data-word-checker]");
  if (!form) return;

  let answerWords = readAnswerWords();
  let answerSentence = String(form.dataset.answerSentence || "");
  const inputs = [...form.querySelectorAll("[data-word-input]")];
  const result = form.querySelector("[data-check-result]");
  const missionImage = document.querySelector("[data-mission-image]");
  const questionTitle = document.querySelector("[data-question-title]");
  const questionList = document.querySelector("[data-question-list]");
  const resetButton = document.querySelector("[data-countdown-reset]");
  const questions = readQuestions();

  function readAnswerWords() {
    return String(form.dataset.answerWords || "")
      .split(",")
      .map((word) => word.trim())
      .filter(Boolean);
  }

  function readQuestions() {
    const script = document.querySelector("[data-prompt-questions]");
    if (!script) return [];

    try {
      const parsed = JSON.parse(script.textContent || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function normalize(value) {
    return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
  }

  function clearResult() {
    inputs.forEach((input) => {
      input.value = "";
    });
    if (!result) return;
    result.classList.remove("is-visible");
    result.innerHTML = "";
  }

  function selectQuestion(index) {
    const item = questions[index];
    if (!item) return;

    answerWords = Array.isArray(item.answerWords) ? item.answerWords : [];
    answerSentence = String(item.answerSentence || "");
    form.dataset.answerWords = answerWords.join(",");
    form.dataset.answerSentence = answerSentence;

    if (missionImage) {
      missionImage.src = item.image;
      missionImage.alt = item.alt || item.answerSentence || "";
    }

    if (questionTitle) {
      questionTitle.textContent = `문제 ${index + 1} · ${item.room || "미션"}`;
    }

    document.querySelectorAll("[data-question-index]").forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.questionIndex) === index);
    });

    clearResult();
    resetButton?.click();
  }

  function renderQuestionList() {
    if (!questionList || !questions.length) return;

    questions.forEach((item, index) => {
      const button = document.createElement("button");
      button.className = "question-button";
      button.type = "button";
      button.dataset.questionIndex = String(index);
      button.textContent = String(index + 1);
      button.setAttribute("aria-label", `문제 ${index + 1}${item.room ? ` ${item.room}` : ""}`);
      button.addEventListener("click", () => selectQuestion(index));
      questionList.append(button);
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const entered = inputs.map((input) => normalize(input.value)).filter(Boolean);
    const hits = answerWords.filter((word) => entered.includes(normalize(word)));
    const chips = answerWords
      .map((word) => `<span class="word-chip${hits.includes(word) ? " word-chip--hit" : ""}">${word}</span>`)
      .join("");

    result.classList.add("is-visible");
    result.innerHTML = `
      <p class="score-line">맞힌 단어 ${hits.length} / ${answerWords.length}개</p>
      <div class="matched-words" aria-label="정답 단어">${chips}</div>
      <p class="answer-box">정답 문장: ${answerSentence}</p>
    `;
  });

  renderQuestionList();
  if (questions.length) selectQuestion(0);
})();
