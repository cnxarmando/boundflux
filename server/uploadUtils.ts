import fs from "fs";
import path from "path";
import crypto from "crypto";
import { UPLOADS_DIR } from "./db";

export function verifyBufferMagicBytes(buffer: Buffer, claimedMime: string): boolean {
  if (buffer.length < 4) return false;
  if (claimedMime === "image/jpeg") {
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  if (claimedMime === "image/png") {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  }
  if (claimedMime === "image/webp") {
    if (buffer.length < 12) return false;
    const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
    const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    return isRiff && isWebp;
  }
  if (claimedMime === "application/pdf") {
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }
  return false;
}

export function saveBase64Image(base64Str: string): string {
  if (base64Str && (base64Str.startsWith("data:image") || base64Str.startsWith("data:application/pdf"))) {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const mimeType = matches[1];
      
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowedMimeTypes.includes(mimeType)) {
        console.warn(`Rejected upload: MIME-type "${mimeType}" is not allowed.`);
        return "";
      }
      
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");
      
      const MAX_SIZE = 5 * 1024 * 1024;
      if (buffer.length > MAX_SIZE) {
        console.warn(`Rejected upload: file size ${buffer.length} bytes exceeds 5MB limit.`);
        return "";
      }

      if (!verifyBufferMagicBytes(buffer, mimeType)) {
        console.warn(`Rejected upload: Real media type does not match claimed MIME-type "${mimeType}".`);
        return "";
      }

      const uuid = crypto.randomUUID();
      let fileExtension = "jpg";
      if (mimeType === "image/png") fileExtension = "png";
      else if (mimeType === "image/webp") fileExtension = "webp";
      else if (mimeType === "application/pdf") fileExtension = "pdf";

      const filename = `receipt-${uuid}.${fileExtension}`;
      const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, "");
      const savePath = path.join(UPLOADS_DIR, safeFilename);
      
      try {
        fs.writeFileSync(savePath, buffer);
        return `/uploads/${safeFilename}`;
      } catch (err) {
        console.error("Failed to write cargo photo or document upload file:", err);
      }
    }
  } else if (base64Str) {
    if (typeof base64Str === "string") {
      return base64Str.replace(/\.\./g, "");
    }
    return base64Str;
  }
  return "";
}
