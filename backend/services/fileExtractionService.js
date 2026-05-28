const path = require('path');
const mammoth = require('mammoth');
const { PDFParse } = require('pdf-parse');

const supportedTypes = {
  '.pdf': {
    mimeTypes: ['application/pdf'],
    label: 'pdf',
  },
  '.docx': {
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'application/octet-stream',
    ],
    label: 'docx',
  },
  '.txt': {
    mimeTypes: ['text/plain', 'application/octet-stream'],
    label: 'txt',
  },
};

function getFileType(file) {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const config = supportedTypes[extension];
  if (!config) return null;

  if (file.mimetype && !config.mimeTypes.includes(file.mimetype)) {
    return null;
  }

  return config.label;
}

function normalizeExtractedText(text) {
  return String(text || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return normalizeExtractedText(result.text);
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return normalizeExtractedText(result.value);
}

async function extractText(file) {
  const fileType = getFileType(file);
  if (!fileType) {
    const err = new Error('Unsupported file type. Upload a PDF, DOCX, or TXT file.');
    err.statusCode = 415;
    throw err;
  }

  let text = '';
  if (fileType === 'pdf') {
    text = await extractPdf(file.buffer);
  } else if (fileType === 'docx') {
    text = await extractDocx(file.buffer);
  } else {
    text = normalizeExtractedText(file.buffer.toString('utf8'));
  }

  if (!text) {
    const err = new Error('No readable text could be extracted from this file.');
    err.statusCode = 422;
    throw err;
  }

  return { text, fileType };
}

module.exports = {
  extractText,
  getFileType,
  supportedTypes,
};
