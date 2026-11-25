import multer from "multer";
import { RequestHandler } from "express";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf"
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, PNG, WEBP, GIF) and PDFs are allowed."));
    }
  }
});

export function uploadSingle(fieldName: string): RequestHandler {
  return upload.single(fieldName) as unknown as RequestHandler;
}
