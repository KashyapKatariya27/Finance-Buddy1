import fs from "fs";
import path from "path";
import { UPLOAD_DIR } from "../config";

export interface StorageProvider {
  saveFile(file: Express.Multer.File): Promise<string>;
  deleteFile(fileUrl: string): Promise<void>;
}

/**
 * Local disk storage provider (default for development).
 * Note: Render's disk is ephemeral; swap with CloudinaryStorageProvider or S3StorageProvider in production.
 */
class LocalStorageProvider implements StorageProvider {
  constructor() {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  async saveFile(file: Express.Multer.File): Promise<string> {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const targetPath = path.join(UPLOAD_DIR, safeName);
    await fs.promises.writeFile(targetPath, file.buffer);
    return `/uploads/${safeName}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl.startsWith("/uploads/")) return;
    const fileName = path.basename(fileUrl);
    const targetPath = path.join(UPLOAD_DIR, fileName);
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
  }
}

export const storageProvider: StorageProvider = new LocalStorageProvider();
