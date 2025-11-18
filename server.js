import express from "express";
import cors from "cors";
import multer from "multer";
import sharp from "sharp";
import archiver from "archiver";
import crypto from "crypto";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 50 },
});

const jobs = new Map();

const outputContentType = (fmt) => {
  switch (fmt) {
    case "jpeg":
      return "image/jpeg";
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    case "tiff":
      return "image/tiff";
    case "bmp":
      return "image/bmp";
    default:
      return "application/octet-stream";
  }
};

const normalizeFormat = (fmt) => {
  if (!fmt) return null;
  const f = fmt.toLowerCase();
  if (f === "jpg") return "jpeg";
  return f;
};

const processImage = async (buffer, originalName, options) => {
  const format = normalizeFormat(options.targetFormat);
  let instance = sharp(buffer, { failOnError: false }).rotate();
  const withMeta = options.preserveExif === true;
  if (withMeta) instance = instance.withMetadata();
  const width = Number(options.resizeWidth) || null;
  const height = Number(options.resizeHeight) || null;
  if (width || height) {
    instance = instance.resize({ width: width || null, height: height || null, fit: "inside", withoutEnlargement: true });
  }
  const quality = Math.max(1, Math.min(100, Number(options.quality) || 80));
  if (format === "jpeg") instance = instance.jpeg({ quality, mozjpeg: true });
  else if (format === "png") instance = instance.png({ compressionLevel: 9 });
  else if (format === "webp") instance = instance.webp({ quality });
  else if (format === "avif") instance = instance.avif({ quality });
  else if (format === "tiff") instance = instance.tiff({ quality, compression: "jpeg" });
  else if (format === "bmp") instance = instance.toFormat("bmp");
  else instance = instance.jpeg({ quality, mozjpeg: true });
  const out = await instance.toBuffer();
  const base = path.parse(originalName).name;
  const ext = format || "jpeg";
  const name = `${base}.${ext}`;
  const contentType = outputContentType(ext);
  return { name, data: out, size: out.length, contentType };
};

app.post("/api/convert", upload.array("files"), async (req, res) => {
  try {
    const { targetFormat, quality, resizeWidth, resizeHeight, preserveExif } = req.body;
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    const jobId = crypto.randomUUID();
    const outputs = [];
    for (const f of files) {
      const o = await processImage(f.buffer, f.originalname, { targetFormat, quality, resizeWidth, resizeHeight, preserveExif: preserveExif === "true" || preserveExif === true });
      outputs.push(o);
    }
    jobs.set(jobId, outputs);
    setTimeout(() => jobs.delete(jobId), 10 * 60 * 1000);
    const list = outputs.map((o) => ({ name: o.name, size: o.size, contentType: o.contentType, url: `/api/file/${jobId}/${encodeURIComponent(o.name)}` }));
    res.json({ jobId, files: list, zipUrl: `/api/zip/${jobId}` });
  } catch (e) {
    res.status(500).json({ error: "Processing failed" });
  }
});

app.get("/api/file/:jobId/:name", (req, res) => {
  const { jobId, name } = req.params;
  const items = jobs.get(jobId) || [];
  const found = items.find((i) => i.name === name);
  if (!found) return res.status(404).json({ error: "Not found" });
  res.setHeader("Content-Type", found.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${found.name}"`);
  res.send(found.data);
});

app.get("/api/zip/:jobId", (req, res) => {
  const { jobId } = req.params;
  const items = jobs.get(jobId) || [];
  if (!items.length) return res.status(404).json({ error: "Not found" });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="images-${jobId}.zip"`);
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", () => res.end());
  archive.pipe(res);
  for (const i of items) archive.append(i.data, { name: i.name });
  archive.finalize();
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}/`);
});