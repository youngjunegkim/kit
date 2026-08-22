(function () {
  const root = document.querySelector("[data-ethics-manager]");
  if (!root) return;

  const classId = "class-a";
  const user = sessionStorage.getItem("kit-auth-user") || "teacher";
  const choiceMarkers = ["①", "②", "③", "④", "⑤"];
  const baseQuestionCount = 15;
  const maxImageDataUrlLength = 300000;
  const maxSourceImageLength = 300000;
  const maxImageInputBytes = 6 * 1024 * 1024;
  const imageMaxWidth = 960;
  const imageMaxHeight = 620;

  const form = root.querySelector("[data-ethics-manager-form]");
  const list = root.querySelector("[data-ethics-manager-list]");
  const status = root.querySelector("[data-ethics-manager-status]");
  const preview = root.querySelector("[data-ethics-manager-preview]");
  const previewImage = preview?.querySelector("img");
  const newButton = root.querySelector("[data-ethics-manager-new]");
  const refreshButton = root.querySelector("[data-ethics-manager-refresh]");
  const cancelButton = root.querySelector("[data-ethics-manager-cancel]");
  let records = [];

  function baseQuestionRecords() {
    const source = Array.isArray(window.KitEthicsBaseQuestions) && window.KitEthicsBaseQuestions.length
      ? window.KitEthicsBaseQuestions
      : (Array.isArray(window.KitEthicsQuizQuestions) ? window.KitEthicsQuizQuestions.slice(0, baseQuestionCount) : []);
    return source.slice(0, baseQuestionCount).map((question, index) => normalizeRecord({
      ...question,
      id: `base-${Number(question.number) || index + 1}`,
      baseNumber: Number(question.number) || index + 1
    }));
  }

  function formField(name) {
    return form?.elements?.[name] || null;
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function splitParagraphs(value) {
    return String(value || "")
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function joinParagraphs(value) {
    return (Array.isArray(value) ? value : [value])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join("\n");
  }

  function authHeaders() {
    return {
      "content-type": "application/json",
      "x-kit-role": "teacher",
      "x-kit-user": user,
      "x-kit-class": classId
    };
  }

  function setStatus(text, type = "") {
    if (!status) return;
    status.textContent = text;
    status.classList.toggle("is-ok", type === "ok");
    status.classList.toggle("is-bad", type === "bad");
  }

  function setPanelStatus(text, type = "") {
    setStatus(text, type);
  }

  function normalizeRecord(record = {}) {
    const options = Array.isArray(record.options)
      ? record.options.slice(0, 5).map((option, index) => ({
        id: String(option?.id || index + 1),
        marker: String(option?.marker || choiceMarkers[index] || `${index + 1}.`),
        text: String(option?.text || "").trim()
      })).filter((option) => option.text)
      : [];
    return {
      id: String(record.id || "").trim(),
      baseNumber: Number(record.baseNumber || 0) || 0,
      topic: String(record.topic || "").trim(),
      background: Array.isArray(record.background) ? record.background : splitParagraphs(record.background),
      prompt: String(record.prompt || "").trim(),
      options,
      answer: String(record.answer || "").trim(),
      explanation: Array.isArray(record.explanation) ? record.explanation : splitParagraphs(record.explanation),
      sourceImage: String(record.sourceImage || "").trim()
    };
  }

  function storedBaseOverrides() {
    return new Map(records
      .map(normalizeRecord)
      .filter((record) => record.id && record.baseNumber >= 1 && record.baseNumber <= baseQuestionCount)
      .map((record) => [record.baseNumber, record]));
  }

  function customRecords() {
    return records
      .map(normalizeRecord)
      .filter((record) => record.id && !(record.baseNumber >= 1 && record.baseNumber <= baseQuestionCount));
  }

  function displayRecords() {
    const overrides = storedBaseOverrides();
    const base = baseQuestionRecords().map((record) => ({
      ...record,
      ...(overrides.get(record.baseNumber) || {}),
      id: `base-${record.baseNumber}`,
      baseNumber: record.baseNumber,
      base: true,
      modified: overrides.has(record.baseNumber)
    }));
    return [
      ...base,
      ...customRecords().map((record, index) => ({
        ...record,
        number: baseQuestionCount + index + 1,
        custom: true
      }))
    ];
  }

  function truncate(value, length = 72) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text.length > length ? `${text.slice(0, length - 1)}…` : text;
  }

  function renderPreview(src) {
    if (!preview || !previewImage) return;
    if (!src) {
      preview.hidden = true;
      previewImage.removeAttribute("src");
      return;
    }
    preview.hidden = false;
    previewImage.src = src;
  }

  function resetForm() {
    if (!form) return;
    form.reset();
    form.dataset.currentSourceImage = "";
    formField("id").value = "";
    formField("baseNumber").value = "";
    renderPreview("");
    setStatus("");
  }

  function openForm(record = null) {
    if (!form) return;
    resetForm();
    form.hidden = false;

    if (record) {
      const normalized = normalizeRecord(record);
      formField("id").value = normalized.id;
      formField("baseNumber").value = normalized.baseNumber ? String(normalized.baseNumber) : "";
      formField("topic").value = normalized.topic;
      formField("background").value = joinParagraphs(normalized.background);
      formField("prompt").value = normalized.prompt;
      formField("answer").value = normalized.answer || "1";
      formField("explanation").value = joinParagraphs(normalized.explanation);
      form.dataset.currentSourceImage = normalized.sourceImage;
      if (normalized.sourceImage && !normalized.sourceImage.startsWith("data:")) {
        formField("sourceImage").value = normalized.sourceImage;
      }
      normalized.options.forEach((option, index) => {
        const field = formField(`option${index + 1}`);
        if (field) field.value = option.text;
      });
      renderPreview(normalized.sourceImage);
      setStatus(normalized.baseNumber ? `${normalized.baseNumber}번 기본 문제를 수정합니다. 저장하면 학생용 같은 번호에 반영됩니다.` : "수정할 내용을 바꾼 뒤 저장을 누르세요.");
    } else {
      formField("answer").value = "1";
      setStatus("새 윤리퀴즈 문제를 입력하세요.");
    }

    form.querySelector("[name='topic']")?.focus({ preventScroll: true });
  }

  function closeForm() {
    if (!form) return;
    resetForm();
    form.hidden = true;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("사진 파일을 읽지 못했습니다."));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("사진 파일을 이미지로 열지 못했습니다."));
      image.src = dataUrl;
    });
  }

  async function compressImageFile(file) {
    if (!file) return "";
    if (!String(file.type || "").startsWith("image/")) {
      throw new Error("이미지 파일만 추가할 수 있습니다.");
    }
    if (file.size > maxImageInputBytes) {
      throw new Error("사진 파일은 6MB 이하만 추가할 수 있습니다.");
    }

    const dataUrl = await readFileAsDataUrl(file);
    const image = await loadImage(dataUrl);
    const ratio = Math.min(1, imageMaxWidth / image.naturalWidth, imageMaxHeight / image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("사진을 압축하지 못했습니다.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.78, 0.68, 0.58, 0.48, 0.38]) {
      const compressed = canvas.toDataURL("image/jpeg", quality);
      if (compressed.length <= maxImageDataUrlLength) return compressed;
    }
    throw new Error("사진 용량이 큽니다. 더 작은 사진을 선택하세요.");
  }

  async function sourceImageFromForm() {
    const removeImage = Boolean(formField("removeImage")?.checked);
    if (removeImage) return "";

    const file = formField("sourceFile")?.files?.[0] || null;
    if (file) return compressImageFile(file);

    const typedSource = String(formField("sourceImage")?.value || "").trim();
    const source = typedSource || form?.dataset.currentSourceImage || "";
    if (source.length > maxSourceImageLength) {
      throw new Error("사진 데이터가 큽니다. 더 작은 사진을 사용하세요.");
    }
    return source;
  }

  function makeCustomId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function recordFromForm() {
    const options = [1, 2, 3, 4, 5].map((number, index) => ({
      id: String(number),
      marker: choiceMarkers[index],
      text: String(formField(`option${number}`)?.value || "").trim()
    })).filter((option) => option.text);
    const answer = String(formField("answer")?.value || "").trim();
    const baseNumber = Number(formField("baseNumber")?.value || 0) || 0;
    const record = {
      id: String(formField("id")?.value || "").trim() || (baseNumber ? `base-${baseNumber}` : makeCustomId()),
      baseNumber: baseNumber >= 1 && baseNumber <= baseQuestionCount ? baseNumber : 0,
      topic: String(formField("topic")?.value || "").trim(),
      type: "choice",
      background: splitParagraphs(formField("background")?.value),
      prompt: String(formField("prompt")?.value || "").trim(),
      options,
      answer,
      explanation: splitParagraphs(formField("explanation")?.value),
      sourceImage: await sourceImageFromForm()
    };

    if (!record.topic) throw new Error("제목을 입력하세요.");
    if (!record.prompt) throw new Error("문제를 입력하세요.");
    if (record.options.length < 2) throw new Error("보기는 2개 이상 입력하세요.");
    if (!record.options.some((option) => option.id === answer)) throw new Error("입력한 보기 중에서 정답을 선택하세요.");
    if (!record.explanation.length) throw new Error("해설을 입력하세요.");
    return record;
  }

  async function fetchQuestions() {
    const response = await fetch(`/api/ethics-questions?classId=${encodeURIComponent(classId)}`, {
      cache: "no-store",
      headers: authHeaders()
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(data.questions)) {
      throw new Error(data.error || "윤리퀴즈 목록을 불러오지 못했습니다.");
    }
    records = data.questions.map(normalizeRecord).filter((record) => record.id);
    renderList();
    const modifiedBaseCount = storedBaseOverrides().size;
    const customCount = customRecords().length;
    setPanelStatus(
      `기본 문제 ${baseQuestionCount}개를 수정할 수 있습니다. 수정본 ${modifiedBaseCount}개, 추가 문제 ${customCount}개가 저장되어 있습니다.`,
      "ok"
    );
  }

  async function saveRecord(event) {
    event.preventDefault();
    try {
      const editing = Boolean(String(formField("id")?.value || "").trim());
      setStatus(editing ? "문제를 수정 저장하는 중입니다..." : "새 문제를 저장하는 중입니다...");
      const record = await recordFromForm();
      const response = await fetch("/api/ethics-questions", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          classId,
          question: record
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.questions)) {
        throw new Error(data.error || "윤리퀴즈 저장에 실패했습니다.");
      }
      records = data.questions.map(normalizeRecord).filter((item) => item.id);
      window.KitRefreshEthicsQuestions?.();
      renderList();
      closeForm();
      setPanelStatus(
        record.baseNumber ? `${record.baseNumber}번 문제가 수정되었습니다. 학생용은 잠시 후 같은 번호에 자동 반영됩니다.` : editing ? "문제가 수정되었습니다. 학생용은 잠시 후 자동 반영됩니다." : "새 문제가 추가되었습니다. 학생용은 잠시 후 자동 반영됩니다.",
        "ok"
      );
    } catch (error) {
      setStatus(error.message || "윤리퀴즈 저장에 실패했습니다.", "bad");
    }
  }

  async function deleteRecord(id) {
    const record = displayRecords().find((item) => item.id === id);
    if (!record) return;
    const restoringBase = Boolean(record.baseNumber);
    if (!window.confirm(restoringBase ? `${record.baseNumber}번 문제를 기본값으로 복원할까요?` : `'${record.topic}' 문제를 삭제할까요?`)) return;
    setPanelStatus(restoringBase ? "기본 문제를 복원하는 중입니다..." : "문제를 삭제하는 중입니다...");
    try {
      const response = await fetch("/api/ethics-questions", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          action: "delete",
          id,
          classId
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.questions)) {
        throw new Error(data.error || "윤리퀴즈 삭제에 실패했습니다.");
      }
      records = data.questions.map(normalizeRecord).filter((item) => item.id);
      window.KitRefreshEthicsQuestions?.();
      renderList();
      closeForm();
      setPanelStatus(restoringBase ? `${record.baseNumber}번 문제가 기본값으로 복원되었습니다. 학생용은 잠시 후 자동 반영됩니다.` : "문제가 삭제되었습니다. 학생용은 잠시 후 자동 반영됩니다.", "ok");
    } catch (error) {
      setPanelStatus(error.message || "윤리퀴즈 삭제에 실패했습니다.", "bad");
    }
  }

  function renderList() {
    if (!list) return;
    list.textContent = "";
    const items = displayRecords();
    if (!items.length) {
      list.append(createElement("p", "ethics-manage-empty", "윤리퀴즈 문제를 불러오지 못했습니다. 새로고침을 눌러 주세요."));
      return;
    }

    items.forEach((record, index) => {
      const item = createElement("article", "ethics-manage-item");
      const number = record.baseNumber || record.number || baseQuestionCount + index + 1;
      const kind = record.baseNumber ? `기본 문제${record.modified ? " · 수정됨" : ""}` : "추가 문제";
      const meta = createElement(
        "div",
        "ethics-manage-item__meta",
        `${number}번 · ${kind} · 보기 ${record.options.length}개${record.sourceImage ? " · 사진 있음" : ""}`
      );
      const title = createElement("strong", "", record.topic || "제목 없음");
      const prompt = createElement("p", "", truncate(record.prompt));
      const actions = createElement("div", "ethics-manage-item-actions");
      const edit = createElement("button", "", "수정");
      edit.type = "button";
      edit.dataset.ethicsEditId = record.id;
      actions.append(edit);
      if (!record.baseNumber || record.modified) {
        const remove = createElement("button", "", record.baseNumber ? "기본값 복원" : "삭제");
        remove.type = "button";
        remove.dataset.ethicsDeleteId = record.id;
        actions.append(remove);
      }
      item.append(meta, title, prompt, actions);
      list.append(item);
    });
  }

  form?.addEventListener("submit", saveRecord);
  newButton?.addEventListener("click", () => openForm());
  cancelButton?.addEventListener("click", closeForm);
  refreshButton?.addEventListener("click", () => {
    setPanelStatus("윤리퀴즈 목록을 불러오는 중입니다...");
    fetchQuestions().catch((error) => setPanelStatus(error.message || "윤리퀴즈 목록을 불러오지 못했습니다.", "bad"));
  });
  list?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const edit = target?.closest("[data-ethics-edit-id]");
    const remove = target?.closest("[data-ethics-delete-id]");
    if (edit) {
      const record = displayRecords().find((item) => item.id === edit.dataset.ethicsEditId);
      if (record) openForm(record);
    } else if (remove) {
      deleteRecord(remove.dataset.ethicsDeleteId || "");
    }
  });

  renderList();
  fetchQuestions().catch((error) => setPanelStatus(error.message || "윤리퀴즈 목록을 불러오지 못했습니다.", "bad"));
})();
