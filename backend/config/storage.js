const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const STORAGE_DRIVER = process.env.STORAGE_DRIVER || 'local';
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

let s3Client = null;
function getS3Client() {
  if (s3Client) return s3Client;
  const { S3Client } = require('@aws-sdk/client-s3');
  s3Client = new S3Client({
    endpoint: process.env.B2_ENDPOINT,
    region: 'us-east-005',
    credentials: {
      accessKeyId: process.env.B2_KEY_ID,
      secretAccessKey: process.env.B2_APPLICATION_KEY
    },
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED'
  });

  try {
    s3Client.middlewareStack.remove('flexibleChecksumsMiddleware');
  } catch (err) {
    // If this particular SDK version names the step differently, the config
    // options above still provide a first line of defense - safe to continue.
  }

  return s3Client;
}

async function finalizeUpload(file) {
  const storedFileName = uuidv4();

  if (STORAGE_DRIVER === 'b2') {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await getS3Client().send(new PutObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: storedFileName,
      Body: file.buffer,
      ContentType: file.mimetype
    }));
    return storedFileName;
  }

  if (STORAGE_DRIVER === 'azure') {
    const { BlobServiceClient } = require('@azure/storage-blob');
    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINER || 'documents');
    const blockBlobClient = containerClient.getBlockBlobClient(storedFileName);
    await blockBlobClient.uploadData(file.buffer, { blobHTTPHeaders: { blobContentType: file.mimetype } });
    return storedFileName;
  }

  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, storedFileName), file.buffer);
  return storedFileName;
}

async function streamFileToResponse(res, storedFileName, downloadName, mimeType) {
  if (STORAGE_DRIVER === 'b2') {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const result = await getS3Client().send(new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: storedFileName
    }));
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    result.Body.pipe(res);
    return;
  }

  if (STORAGE_DRIVER === 'azure') {
    const { BlobServiceClient } = require('@azure/storage-blob');
    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINER || 'documents');
    const downloadResponse = await containerClient.getBlockBlobClient(storedFileName).download();
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    downloadResponse.readableStreamBody.pipe(res);
    return;
  }

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  fs.createReadStream(path.join(UPLOAD_DIR, storedFileName)).pipe(res);
}

async function streamFileInline(res, storedFileName, mimeType) {
  if (STORAGE_DRIVER === 'b2') {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const result = await getS3Client().send(new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: storedFileName
    }));
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', 'inline');
    result.Body.pipe(res);
    return;
  }

  if (STORAGE_DRIVER === 'azure') {
    const { BlobServiceClient } = require('@azure/storage-blob');
    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINER || 'documents');
    const downloadResponse = await containerClient.getBlockBlobClient(storedFileName).download();
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', 'inline');
    downloadResponse.readableStreamBody.pipe(res);
    return;
  }

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', 'inline');
  fs.createReadStream(path.join(UPLOAD_DIR, storedFileName)).pipe(res);
}

async function deleteStoredFile(storedFileName) {
  if (STORAGE_DRIVER === 'b2') {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await getS3Client().send(new DeleteObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: storedFileName
    }));
    return;
  }

  if (STORAGE_DRIVER === 'azure') {
    const { BlobServiceClient } = require('@azure/storage-blob');
    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINER || 'documents');
    await containerClient.getBlockBlobClient(storedFileName).deleteIfExists();
    return;
  }

  const filePath = path.join(UPLOAD_DIR, storedFileName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

module.exports = { upload, finalizeUpload, streamFileToResponse, streamFileInline, deleteStoredFile };
