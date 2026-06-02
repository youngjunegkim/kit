(function () {
  const storagePrefix = "kit-student-note:";
  const labels = {
    saving: "\uC800\uC7A5 \uC911...",
    saved: "\uC790\uB3D9 \uC800\uC7A5\uB428",
    cleared: "\uBE44\uC6E0\uC2B5\uB2C8\uB2E4"
  };
  const numberedTemplate = "1. \n2. \n3. \n4. \n5. ";
  const oldTemplatePattern = /^1\. .+\uC5D0\uAC8C\uC11C \uC5BB\uC740 \uB2E8\uC11C:\s*\n2\. .+\uC5D0\uAC8C\uC11C \uC5BB\uC740 \uB2E8\uC11C:\s*\n3\. .+\uC5D0\uAC8C\uC11C \uC5BB\uC740 \uB2E8\uC11C:\s*\n4\. .+\uC5D0\uAC8C\uC11C \uC5BB\uC740 \uB2E8\uC11C:\s*$/;
  const oldTemplatePhrase = /\uC5D0\uAC8C\uC11C\s*\uC5BB\uC740/;

  const getTemplate = () => numberedTemplate;

  function isOldTemplateLine(line) {
    const trimmed = line.trim();
    if (!trimmed || /^[1-5]\.\s*$/.test(trimmed)) return true;
    if (!/^[1-5]\.\s+/.test(trimmed) || !oldTemplatePhrase.test(trimmed)) return false;

    const withoutPrompt = trimmed
      .replace(/^[1-5]\.\s+/, "")
      .replace(/^.+?\uC5D0\uAC8C\uC11C\s*\uC5BB\uC740(?:\s*\uB2E8\uC11C)?\s*:?\s*/, "");
    return withoutPrompt === "";
  }

  function shouldUseTemplate(savedNote) {
    if (savedNote === null || !savedNote.trim()) return true;
    if (oldTemplatePattern.test(savedNote)) return true;

    const lines = savedNote.split(/\n/).filter((line) => line.trim());
    return lines.some((line) => oldTemplatePhrase.test(line)) &&
      lines.every(isOldTemplateLine);
  }

  document.querySelectorAll("[data-note-key]").forEach((textarea) => {
    const key = textarea.dataset.noteKey;
    const storageKey = `${storagePrefix}${key}`;
    const status = document.querySelector(`[data-note-status="${key}"]`);
    let saveTimer = 0;

    const savedNote = localStorage.getItem(storageKey);
    if (shouldUseTemplate(savedNote)) {
      textarea.value = getTemplate();
      localStorage.setItem(storageKey, textarea.value);
    } else {
      textarea.value = savedNote;
    }

    textarea.addEventListener("input", () => {
      localStorage.setItem(storageKey, textarea.value);
      if (status) status.textContent = labels.saving;

      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        if (status) status.textContent = labels.saved;
      }, 350);
    });
  });

  document.querySelectorAll("[data-clear-note]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.clearNote;
      const textarea = document.querySelector(`[data-note-key="${key}"]`);
      const status = document.querySelector(`[data-note-status="${key}"]`);

      if (!textarea) return;

      textarea.value = getTemplate();
      localStorage.removeItem(`${storagePrefix}${key}`);
      if (status) status.textContent = labels.cleared;
      textarea.focus();
    });
  });
})();
