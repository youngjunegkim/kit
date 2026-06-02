(function () {
  const form = document.querySelector("[data-word-checker]");
  if (!form) return;

  const answerWords = String(form.dataset.answerWords || "")
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);
  const answerSentence = String(form.dataset.answerSentence || "");
  const inputs = [...form.querySelectorAll("[data-word-input]")];
  const result = form.querySelector("[data-check-result]");

  function normalize(value) {
    return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
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
})();
