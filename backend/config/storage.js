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

const localDiskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: driver === 'azure' ? memoryStorage : localDiskStorage,
  limits: { fileSize: 25 * 1024 * 1024 }
});

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

async function streamFileInline(res, storedFileName, mimeType) {
  if (driver === 'azure') {
    const blockBlobClient = containerClient.getBlockBlobClient(storedFileName);
    const downloadResponse = await blockBlobClient.download();
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    downloadResponse.readableStreamBody.pipe(res);
  } else {
    const filePath = path.join(UPLOAD_DIR, storedFileName);
    if (!fs.existsSync(filePath)) throw new Error('File missing on server');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
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

module.exports = { upload, finalizeUpload, streamFileToResponse, streamFileInline, deleteStoredFile, driver };
