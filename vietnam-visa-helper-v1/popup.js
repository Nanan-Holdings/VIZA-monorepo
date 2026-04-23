console.log('popup.js 已加载');

const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024;
const UPLOAD_STORAGE_KEY = 'vhUploadDocuments';
const UPLOAD_FIELDS = {
  passport_photo: {
    inputId: 'passportPhotoInput',
    statusId: 'passportPhotoStatus',
    clearId: 'clearPassportPhoto',
    label: '申请人正面照片'
  },
  passport_copy: {
    inputId: 'passportCopyInput',
    statusId: 'passportCopyStatus',
    clearId: 'clearPassportCopy',
    label: '护照资料页'
  }
};

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response || {});
      });
    } catch (error) {
      reject(error);
    }
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

function replaceFileExtension(fileName, extension) {
  const normalized = fileName || 'upload';
  const dotIndex = normalized.lastIndexOf('.');
  if (dotIndex === -1) {
    return `${normalized}${extension}`;
  }
  return `${normalized.slice(0, dotIndex)}${extension}`;
}

function estimateDataUrlBytes(dataUrl) {
  const base64 = (dataUrl || '').split(',')[1] || '';
  const padding = (base64.match(/=+$/) || [''])[0].length;
  return Math.max(0, Math.floor(base64.length * 3 / 4) - padding);
}

async function loadImageFromFile(file) {
  const dataUrl = await readFileAsDataUrl(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image, dataUrl });
    image.onerror = () => reject(new Error('图片解析失败'));
    image.src = dataUrl;
  });
}

async function buildUploadPayload(file, fieldKey) {
  if (!file.type.startsWith('image/')) {
    throw new Error('仅支持图片文件');
  }

  if (file.size <= MAX_UPLOAD_SIZE_BYTES) {
    return {
      file_name: file.name,
      mime_type: file.type,
      size: file.size,
      last_modified: file.lastModified,
      data_url: await readFileAsDataUrl(file)
    };
  }

  const { image } = await loadImageFromFile(file);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;
  const mimeType = 'image/jpeg';
  const qualities = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42];
  const maxDimensions = [1800, 1500, 1200, 1000, 800, 640];

  for (const maxDimension of maxDimensions) {
    const longestSide = Math.max(originalWidth, originalHeight);
    const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(originalWidth * scale));
    canvas.height = Math.max(1, Math.round(originalHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('浏览器不支持图片压缩');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of qualities) {
      const dataUrl = canvas.toDataURL(mimeType, quality);
      const size = estimateDataUrlBytes(dataUrl);
      if (size <= MAX_UPLOAD_SIZE_BYTES) {
        return {
          file_name: replaceFileExtension(file.name, '.jpg'),
          mime_type: mimeType,
          size,
          last_modified: file.lastModified,
          data_url: dataUrl
        };
      }
    }
  }

  throw new Error('图片过大，自动压缩后仍超过 2MB');
}

function getStoredUploadDocuments() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get([UPLOAD_STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result?.[UPLOAD_STORAGE_KEY] || {});
      });
    } catch (error) {
      reject(error);
    }
  });
}

function setStoredUploadDocuments(documents) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set({ [UPLOAD_STORAGE_KEY]: documents }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function getUploadDocumentsFromBackground() {
  const response = await sendMessage({ action: 'getUploadDocuments' });
  return response?.documents || {};
}

async function persistUploadDocument(fieldKey, payload) {
  try {
    const response = await sendMessage({
      action: 'saveUploadDocument',
      key: fieldKey,
      payload
    });

    if (response?.success) {
      return response.documents || {};
    }
  } catch (error) {
    console.warn(`通过后台保存 ${fieldKey} 失败，改用 storage.local 兜底:`, error.message);
  }

  const currentDocuments = await getStoredUploadDocuments();
  currentDocuments[fieldKey] = payload;
  await setStoredUploadDocuments(currentDocuments);
  return currentDocuments;
}

async function persistUploadDocumentFromFile(fieldKey, file) {
  const response = await sendMessage({
    action: 'saveUploadDocumentDataUrl',
    key: fieldKey,
    payload: {
      file_name: file.name,
      mime_type: file.type,
      last_modified: file.lastModified,
      data_url: await readFileAsDataUrl(file)
    }
  });

  if (!response?.success) {
    throw new Error(response?.error || 'background_upload_save_failed');
  }

  return response.documents || {};
}

async function removeUploadDocument(fieldKey) {
  try {
    const response = await sendMessage({
      action: 'clearUploadDocument',
      key: fieldKey
    });

    if (response?.success) {
      return response.documents || {};
    }
  } catch (error) {
    console.warn(`通过后台清除 ${fieldKey} 失败，改用 storage.local 兜底:`, error.message);
  }

  const currentDocuments = await getStoredUploadDocuments();
  delete currentDocuments[fieldKey];
  await setStoredUploadDocuments(currentDocuments);
  return currentDocuments;
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function setUploadStatus(fieldKey, text, state = 'empty') {
  const config = UPLOAD_FIELDS[fieldKey];
  const statusNode = config ? document.getElementById(config.statusId) : null;
  if (!statusNode) return;
  statusNode.textContent = text;
  statusNode.dataset.state = state;
}

function renderUploadStatuses(documents = {}) {
  Object.entries(UPLOAD_FIELDS).forEach(([fieldKey, config]) => {
    const documentInfo = documents?.[fieldKey];
    const input = document.getElementById(config.inputId);
    if (input) input.value = '';

    if (!documentInfo) {
      setUploadStatus(fieldKey, '未选择文件', 'empty');
      return;
    }

    const name = documentInfo.file_name || documentInfo.fileName || documentInfo.name || '已保存文件';
    const size = documentInfo.size ? ` · ${formatBytes(documentInfo.size)}` : '';
    setUploadStatus(fieldKey, `已保存: ${name}${size}`, 'saved');
  });
}

async function refreshUploadStatuses() {
  try {
    let documents = await getUploadDocumentsFromBackground().catch(() => null);
    if (!documents || Object.keys(documents).length === 0) {
      documents = await getStoredUploadDocuments();
    }
    renderUploadStatuses(documents || {});
  } catch (error) {
    console.error('获取已保存文件失败:', error);
    Object.keys(UPLOAD_FIELDS).forEach(fieldKey => {
      setUploadStatus(fieldKey, '读取本地文件状态失败', 'error');
    });
  }
}

async function handleFileSelected(fieldKey, file) {
  const fieldLabel = UPLOAD_FIELDS[fieldKey]?.label || fieldKey;

  if (!file) {
    setUploadStatus(fieldKey, '未选择文件', 'empty');
    return;
  }

  if (!file.type.startsWith('image/')) {
    setUploadStatus(fieldKey, `${fieldLabel} 仅支持图片文件`, 'error');
    return;
  }

  setUploadStatus(
    fieldKey,
    file.size > MAX_UPLOAD_SIZE_BYTES
      ? `正在压缩并保存 ${file.name}...`
      : `正在保存 ${file.name}...`,
    'saving'
  );

  try {
    let savedDocuments;
    let savedPayloadName = file.name;
    let savedPayloadSize = file.size;

    try {
      savedDocuments = await persistUploadDocumentFromFile(fieldKey, file);
      const savedPayload = savedDocuments?.[fieldKey];
      if (savedPayload?.file_name) savedPayloadName = savedPayload.file_name;
      if (savedPayload?.size) savedPayloadSize = savedPayload.size;
    } catch (backgroundError) {
      console.warn(`后台保存 ${fieldLabel} 失败，回退到 popup 本地压缩流程:`, backgroundError.message);
      const payload = await buildUploadPayload(file, fieldKey);
      savedDocuments = await persistUploadDocument(fieldKey, payload);
      savedPayloadName = payload.file_name;
      savedPayloadSize = payload.size;
    }

    console.log(`已保存上传文件: ${fieldKey} -> ${savedPayloadName} (${formatBytes(savedPayloadSize)})`);
    renderUploadStatuses(savedDocuments);
  } catch (error) {
    console.error(`保存 ${fieldLabel} 失败:`, error);
    setUploadStatus(fieldKey, `保存失败: ${error.message}`, 'error');
  }
}

async function clearUpload(fieldKey) {
  try {
    const savedDocuments = await removeUploadDocument(fieldKey);
    renderUploadStatuses(savedDocuments);
  } catch (error) {
    console.error(`清除 ${fieldKey} 失败:`, error);
    setUploadStatus(fieldKey, `清除失败: ${error.message}`, 'error');
  }
}

function bindUploadControls() {
  Object.entries(UPLOAD_FIELDS).forEach(([fieldKey, config]) => {
    const input = document.getElementById(config.inputId);
    const clearButton = document.getElementById(config.clearId);

    if (input) {
      input.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        await handleFileSelected(fieldKey, file);
      });
    }

    if (clearButton) {
      clearButton.addEventListener('click', async () => {
        await clearUpload(fieldKey);
      });
    }
  });
}

function bindQuickActions() {
  const openSiteBtn = document.getElementById('openSite');
  const viewGuideBtn = document.getElementById('viewGuide');
  const settingsBtn = document.getElementById('settings');
  const openUploadPanelBtn = document.getElementById('openUploadPanel');

  if (openSiteBtn) {
    openSiteBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://evisa.gov.vn/' });
    });
  }

  if (viewGuideBtn) {
    viewGuideBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://evisa.gov.vn/' }, (tab) => {
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { action: 'showHelp' });
        }, 1000);
      });
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage?.();
    });
  }

  if (openUploadPanelBtn) {
    openUploadPanelBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?mode=upload') });
    });
  }
}

async function initPopup() {
  const isStandaloneUploadPage = new URLSearchParams(window.location.search).get('mode') === 'upload';
  if (isStandaloneUploadPage) {
    document.body.classList.add('standalone');
  }
  bindQuickActions();
  bindUploadControls();
  await refreshUploadStatuses();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPopup);
} else {
  initPopup();
}
