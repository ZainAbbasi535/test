const fileInput = document.getElementById("fileInput");
const dropzone = document.getElementById("dropzone");
const format = document.getElementById("format");
const quality = document.getElementById("quality");
const qualityValue = document.getElementById("qualityValue");
const width = document.getElementById("width");
const height = document.getElementById("height");
const preserveExif = document.getElementById("preserveExif");
const convertBtn = document.getElementById("convertBtn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const zipLink = document.getElementById("zipLink");
const selectedInfo = document.getElementById("selectedInfo");
const thumbsEl = document.getElementById("thumbs");
const clearBtn = document.getElementById("clearBtn");

let selectedFiles = [];

const setStatus = (t) => {
  statusEl.textContent = t || "";
};

quality.addEventListener("input", () => {
  qualityValue.textContent = quality.value;
});

// Removed redundant click handler to prevent multiple picker openings
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  const files = Array.from(e.dataTransfer.files || []);
  if (files.length) {
    fileInput.files = e.dataTransfer.files;
    selectedFiles = files;
    renderSelected();
  }
});

fileInput.addEventListener("change", () => {
  selectedFiles = Array.from(fileInput.files || []);
  renderSelected();
});

const renderResults = (data) => {
  resultsEl.innerHTML = "";
  const items = data.files || [];
  items.forEach((f) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = f.url;
    a.textContent = `${f.name} • ${(f.size / 1024).toFixed(1)} KB`;
    a.target = "_blank";
    a.rel = "noopener";
    li.appendChild(a);
    resultsEl.appendChild(li);
  });
  zipLink.href = data.zipUrl || "#";
};

const convert = async () => {
  const files = selectedFiles;
  if (!files.length) {
    setStatus("Select images to convert.");
    return;
  }
  convertBtn.disabled = true;
  setStatus("Uploading and processing...");
  try {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    fd.append("targetFormat", format.value);
    fd.append("quality", quality.value);
    if (width.value) fd.append("resizeWidth", width.value);
    if (height.value) fd.append("resizeHeight", height.value);
    fd.append("preserveExif", preserveExif.checked ? "true" : "false");
    const resp = await fetch("/api/convert", { method: "POST", body: fd });
    if (!resp.ok) throw new Error("Request failed");
    const data = await resp.json();
    renderResults(data);
    setStatus("Done.");
  } catch (e) {
    setStatus("Error processing images.");
  } finally {
    convertBtn.disabled = false;
  }
};

convertBtn.addEventListener("click", convert);

const renderSelected = () => {
  thumbsEl.innerHTML = "";
  const count = selectedFiles.length;
  selectedInfo.textContent = count ? `${count} file${count > 1 ? "s" : ""} selected` : "No files selected";
  selectedFiles.forEach((f, idx) => {
    const card = document.createElement("div");
    card.className = "thumb";
    if (f.type && f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      const img = document.createElement("img");
      img.src = url;
      img.alt = f.name;
      img.onload = () => URL.revokeObjectURL(url);
      card.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "thumb-ph";
      ph.textContent = (f.name.split(".").pop() || "FILE").toUpperCase();
      card.appendChild(ph);
    }
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${f.name}`;
    const remove = document.createElement("button");
    remove.className = "remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      selectedFiles.splice(idx, 1);
      renderSelected();
    });
    card.appendChild(meta);
    card.appendChild(remove);
    thumbsEl.appendChild(card);
  });
};

clearBtn.addEventListener("click", () => {
  fileInput.value = "";
  selectedFiles = [];
  renderSelected();
});