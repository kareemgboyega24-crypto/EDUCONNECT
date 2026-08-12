const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const driver = process.env.STORAGE_DRIVER || 'local';

let containerClient;
if (driver === 'azure') {
  const { BlobServiceClient } = require('@azure/storage-blob');
  const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  containerClient = blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINER || 'documents');
}

// --- Local disk storage (dev, zero external setup) ---
const localDiskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

// --- Azure: keep the upload in memory via multer, then push the buffer to Blob
// Storage ourselves in finalizeUpload() below. App Service's local disk isn't
// persistent across restarts/deploys, so files can never live there in production.
const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: driver === 'azure' ? memoryStorage : localDiskStorage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB cap
});

// Call after multer has parsed the upload. For local disk, multer already wrote
// the file and req.file.filename is the stored name. For Azure, the file is still
// only in memory (req.file.buffer) - this actually uploads it to Blob Storage.
async function finalizeUpload(file) {
  if (driver === 'azure') {
    const ext = path.extname(file.originalname);
    const blobName = `${uuidv4()}${ext}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype }
    });
    return blobName;
  }
  return file.filename;
}

async function streamFileToResponse(res, storedFileName, originalName, mimeType) {
  if (driver === 'azure') {
    const blockBlobClient = containerClient.getBlockBlobClient(storedFileName);
    const downloadResponse = await blockBlobClient.download();
    res.setHeader('Content-Disposition', `attachment; filename="${originalName.replace(/"/g, '')}"`);
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    downloadResponse.readableStreamBody.pipe(res);
  } else {
    const filePath = path.join(UPLOAD_DIR, storedFileName);
    if (!fs.existsSync(filePath)) throw new Error('File missing on server');
    res.download(filePath, originalName);
  }
}

async function deleteStoredFile(storedFileName) {
  if (driver === 'azure') {
    const blockBlobClient = containerClient.getBlockBlobClient(storedFileName);
    await blockBlobClient.deleteIfExists();
  } else {
    const filePath = path.join(UPLOAD_DIR, storedFileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

module.exports = { upload, finalizeUpload, streamFileToResponse, deleteStoredFile, driver };
