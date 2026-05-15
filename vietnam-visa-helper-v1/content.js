// Content Script v1.2.1 - Final fixes for all reported issues

const EXTENSION_VERSION = (() => {
  try {
    return chrome.runtime?.getManifest?.()?.version || 'unknown';
  } catch (error) {
    return 'unknown';
  }
})();

// ===== EARLIEST POSSIBLE LOG =====
console.log('%c🇻🇳 越南签证助手 v' + EXTENSION_VERSION + ' 已激活！', 'color: green; font-size: 14px; font-weight: bold;');
console.log('📍 当前URL:', window.location.href);

let userData = null;
let fieldMappings = null;
let isAutoFillEnabled = false;
let currentPageType = null;
let disclaimerScrolled = false;
let fieldCache = {};
let applyHighlightApplied = false; // Prevent duplicate highlights
let hintRecoveryInitialized = false;
let hintRecoveryObserver = null;
let hintRecoveryIntervalId = null;
let hintRecoveryDebounceTimer = null;
let hintRecoveryCleanupBound = false;
let relabelRetryScheduled = false;
let lastUnidentifiedFieldsSignature = '';
let lastFieldDetectionSummary = '';
let uploadDocumentsCache = null;
let uploadGuidanceShown = false;
let captchaGuidanceShown = false;
let paymentGuidanceShown = false;
let topGuidanceTimeoutId = null;
const UPLOAD_STORAGE_KEY = 'vhUploadDocuments';
const UPLOAD_FIELD_KEYS = new Set(['passport_photo', 'passport_copy']);

// Initialize
(function init() {
  console.log('✅ init() 函数已执行');
  console.log('📡 正在请求用户数据...');
  
  const initializeWithData = (userDataObj, fieldMappingsObj) => {
    userData = userDataObj;
    fieldMappings = fieldMappingsObj;
    uploadDocumentsCache = userDataObj?.documents || uploadDocumentsCache || {};
    
    console.log('✅ 用户数据已加载', userData);
    console.log('✅ 字段映射已加载，共', Object.keys(fieldMappings).length, '个字段');
    
    injectFloatingPanel();
    
    let retryCount = 0;
    const detectAndInit = () => {
      detectPageType();
      console.log('🔍 页面类型: ' + currentPageType);
      handleCurrentPage();
      
      if (retryCount < 3) {
        retryCount++;
        setTimeout(detectAndInit, 1500);
      }
    };
    
    setTimeout(detectAndInit, 800);
    
    // ADDITIONAL: Keep checking for form fields and labels even after initial detection
    // This handles slow-loading forms or SPAs that render forms later
    let extraRetries = 0;
    const lateFormDetection = () => {
      const inputs = document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
      if (inputs.length > 0 && !document.querySelector('[data-vh-label-id]')) {
        console.log(`⏰ 延迟检测到 ${inputs.length} 个表单字段且还没有标签，现在添加...`);
        detectAndLabelFields();
        setupHintRecovery();
      }
      
      if (extraRetries < 5) {
        extraRetries++;
        setTimeout(lateFormDetection, 2000);
      }
    };
    
    setTimeout(lateFormDetection, 2000);
  };
  
  // Try to get data from background script
  try {
    chrome.runtime.sendMessage({ action: 'getUserData' }, (response) => {
      if (response && response.userData && response.fieldMappings) {
        console.log('📡 后台脚本响应正常');
        initializeWithData(response.userData, response.fieldMappings);
      } else {
        console.warn('⚠️ 后台脚本响应异常或不完整，使用备用初始化');
        initializeWithData({}, {});
      }
    });
  } catch (e) {
    console.error('❌ 消息传递失败:', e.message);
    console.log('ℹ️ 继续使用备用初始化...');
    // Fallback: initialize with empty data and let page detection work
    setTimeout(() => initializeWithData({}, {}), 100);
  }
})();

const CAPTCHA_KEYWORDS = [
  'captcha',
  'verification code',
  'verify code',
  'security code',
  'mã xác nhận',
  'ma xac nhan',
  '验证码',
  '识别码',
  '校验码',
  '请输入验证码'
];

function findCaptchaInputField() {
  const candidates = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'));
  return candidates.find(input => {
    const inputText = normalizeFieldContextText([
      input.placeholder,
      input.name,
      input.id,
      input.getAttribute?.('aria-label'),
      input.className
    ].filter(Boolean).join(' '));

    return CAPTCHA_KEYWORDS.some(keyword => inputText.includes(keyword));
  }) || null;
}

function findCaptchaVisualElement() {
  const selectors = [
    'img[src*="captcha" i]',
    'img[alt*="captcha" i]',
    'img[class*="captcha" i]',
    'img[id*="captcha" i]',
    'canvas[id*="captcha" i]',
    'canvas[class*="captcha" i]',
    '[class*="captcha" i] img',
    '[class*="captcha" i] canvas'
  ];

  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) return element;
    } catch (error) {
      // Ignore invalid selector errors and continue fallback detection.
    }
  }

  return null;
}

function detectCaptchaStep() {
  const pageText = normalizeFieldContextText(document.body?.innerText || '');
  const hasKeyword = CAPTCHA_KEYWORDS.some(keyword => pageText.includes(keyword));
  const captchaInput = findCaptchaInputField();
  const captchaVisual = findCaptchaVisualElement();
  const score = (hasKeyword ? 1 : 0) + (captchaInput ? 2 : 0) + (captchaVisual ? 1 : 0);

  return {
    isCaptchaStep: score >= 2,
    score,
    hasKeyword,
    hasCaptchaInput: !!captchaInput,
    hasCaptchaVisual: !!captchaVisual,
    captchaInput,
    captchaVisual
  };
}

// Detect page type - ENHANCED WITH DETAILED LOGGING
function detectPageType() {
  const url = window.location.href.toLowerCase();
  const pageText = document.body.innerText.toLowerCase();
  const bodyHtml = document.body.innerHTML.toLowerCase();
  const captchaDetection = detectCaptchaStep();
  
  // Multiple detection methods for different page elements
  const hasForm = !!document.querySelector('form input, form select, form textarea, input[type="text"], select, input[type="email"]');
  const hasCheckbox = !!document.querySelector('input[type="checkbox"], [role="checkbox"], .ant-checkbox-input');
  const hasDisclaimer =
    pageText.includes('disclaimer') ||
    pageText.includes('terms and conditions') ||
    pageText.includes('条款') ||
    pageText.includes('免责声明') ||
    pageText.includes('i have read') ||
    pageText.includes('read carefully before');
  
  // Additional detection methods
  const hasApplyButton = !!findApplyButton();
  const hasNextButton = !!findNextButton();
  const hasPayButton = !!findPayButton();
  const inputCount = document.querySelectorAll('input, select, textarea').length;
  const buttonCount = document.querySelectorAll('button, a[role="button"], [role="button"]').length;
  
  // Detect if we're on form/disclaimer by checking visible content and layout
  const hasStepIndicator = pageText.includes('step') || pageText.includes('步骤') || bodyHtml.includes('step-content') || bodyHtml.includes('steps');
  const disclaimerTextInDom =
    pageText.includes('disclaimer') ||
    pageText.includes('terms and conditions') ||
    pageText.includes('条款') ||
    pageText.includes('免责声明') ||
    pageText.includes('read carefully before');
  
  // Log debug info
  console.log('🔍 页面检测信息:');
  console.log('  URL:', url);
  console.log('  hasForm:', hasForm, `(${inputCount}个输入框)`);
  console.log('  disclaimerTextInDom:', disclaimerTextInDom);
  console.log('  hasDisclaimer:', hasDisclaimer);
  console.log('  hasCheckbox:', hasCheckbox);
  console.log('  hasApplyButton:', hasApplyButton);
  console.log('  hasNextButton:', hasNextButton);
  console.log('  hasPayButton:', hasPayButton);
  console.log('  hasStepIndicator:', hasStepIndicator);
  console.log('  captchaScore:', captchaDetection.score, `(input=${captchaDetection.hasCaptchaInput}, visual=${captchaDetection.hasCaptchaVisual}, keyword=${captchaDetection.hasKeyword})`);

  // PRIORITY 0: CAPTCHA page - detect verification step before generic form detection
  if (captchaDetection.isCaptchaStep) {
    currentPageType = 'CAPTCHA';
    console.log('✅ 页面类型: 🔐 CAPTCHA (验证码步骤)');
    return;
  }

  // PRIORITY 0.5: PAYMENT page - explicit payment action should be guided persistently
  if (hasPayButton && inputCount <= 3 && !hasCheckbox) {
    currentPageType = 'PAY';
    console.log('✅ 页面类型: 💳 PAY (支付步骤)');
    return;
  }
  
  // PRIORITY 1: FORM page - check input count first (most reliable)
  if (inputCount > 3) {
    currentPageType = 'FORM';
    console.log('✅ 页面类型: 📝 FORM (表单页面 - ' + inputCount + '个字段)');
    return;
  }
  
  // PRIORITY 2: DISCLAIMER page - check for disclaimer content + checkbox
  if ((disclaimerTextInDom || hasDisclaimer) && hasCheckbox) {
    currentPageType = 'DISCLAIMER';
    console.log('✅ 页面类型: 📋 DISCLAIMER (条款同意页面)');
    return;
  }
  
  // PRIORITY 3: DISCLAIMER page - just disclaimer text
  if (disclaimerTextInDom || hasDisclaimer) {
    currentPageType = 'DISCLAIMER';
    console.log('✅ 页面类型: 📋 DISCLAIMER (通过文本检测)');
    return;
  }
  
  // PRIORITY 4: HOME page with Apply button
  if (hasApplyButton) {
    currentPageType = 'HOME';
    console.log('✅ 页面类型: 🏠 HOME (首页 - 找到Apply按钮)');
    return;
  }
  
  // PRIORITY 5: Fallback to HOME
  currentPageType = 'HOME';
  console.log('✅ 页面类型: 🏠 HOME (默认)');
  
  // 输出所有找到的checkbox信息（用于调试）
  if (hasCheckbox) {
    const checkboxes = document.querySelectorAll('input[type="checkbox"], [role="checkbox"], .ant-checkbox-input');
    console.log(`  📦 找到 ${checkboxes.length} 个 checkbox:`);
    checkboxes.forEach((cb, idx) => {
      const label = cb.parentElement?.textContent || '';
      console.log(`    [${idx}] Class="${cb.className}", Label="${label.substring(0,30)}"`);
    });
  }
}

// Handle current page - FIXED: prevent Apply highlight on every page
function handleCurrentPage() {
  console.log('📋 处理页面:', currentPageType);

  if (currentPageType !== 'DISCLAIMER') {
    clearDisclaimerGuidanceArtifacts();
  }

  if (currentPageType !== 'CAPTCHA') {
    clearCaptchaGuidanceArtifacts();
  }
  
  // ALWAYS check for form fields on any page and add labels
  const allInputs = document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
  console.log(`🔍 检查页面上的表单字段: ${allInputs.length} 个`);
  
  if (allInputs.length > 0) {
    // Call multiple times to ensure Vue rendering completes
    console.log('🔄 开始处理表单字段...');
    detectAndLabelFields();
    
    setTimeout(() => {
      console.log('🔄 [重试1] 再次检查并添加缺失的标签...');
      detectAndLabelFields();
    }, 800);
    
    setTimeout(() => {
      console.log('🔄 [重试2] 最后确认所有标签已添加...');
      detectAndLabelFields();
    }, 1500);
  }
  
  switch(currentPageType) {
    case 'FORM':
      captchaGuidanceShown = false;
      paymentGuidanceShown = false;
      console.log('🚀 处理表单页面...');
      setTimeout(() => {
        detectAndLabelFields();
        enableAutoFillButton();
        
        // Show UI guidance for form
        showTopGuidance('📝 表单已加载 - 字段下方显示中文翻译、说明和示例', { persistent: true });
      }, 600);
      break;

    case 'CAPTCHA':
      paymentGuidanceShown = false;
      console.log('🔐 处理验证码页面...');
      setTimeout(() => handleCaptchaPage(), 450);
      break;

    case 'PAY':
      captchaGuidanceShown = false;
      console.log('💳 处理支付页面...');
      setTimeout(() => handlePaymentPage(), 350);
      break;
    
    case 'DISCLAIMER':
      captchaGuidanceShown = false;
      paymentGuidanceShown = false;
      console.log('📋 处理Disclaimer页面...');
      setTimeout(() => handleDisclaimerPage(), 500);
      break;
      
    default: // HOME page or other
      captchaGuidanceShown = false;
      paymentGuidanceShown = false;
      // Only highlight Apply button once per page load
      if (!applyHighlightApplied && findApplyButton()) {
        console.log('🏠 首页 - 高亮Apply按钮');
        applyHighlightApplied = true;
        findAndHighlightApplyButton();
        showTopGuidance('👆 请点击红色"Apply now"按钮开始申请', { persistent: true });
      }
      break;
  }
}

// Enable auto-fill button on form pages
function enableAutoFillButton() {
  const btn = document.getElementById('vh-toggle-autofill');
  if (btn) {
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    btn.disabled = false;
    console.log('✅ 一键填表按钮已启用');
  }
}

// ===== APPLY BUTTON DETECTION =====

function findApplyButton() {
  let btn = null;
  
  // Strategy 1: Text-based search (most reliable for dynamic content)
  const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'));
  btn = buttons.find(b => {
    const text = b.innerText?.toLowerCase() || b.textContent?.toLowerCase() || b.value?.toLowerCase() || '';
    return (text.includes('apply') && text.includes('now')) || 
           (text.trim() === 'apply') ||
           text.includes('开始申请') ||
           text.includes('申请');
  });
  
  if (btn) {
    console.log('✅ Apply按钮已找到 (文本):', btn.textContent?.trim() || btn.value);
    return btn;
  }
  
  // Strategy 2: CSS class matching
  const classSelectors = [
    '.apply-button',
    '.apply-btn',
    'button[class*="apply"]',
    'a[class*="apply"]',
    'button.btn-primary',
    'a.btn-danger',
    'button[data-test*="apply"]',
    '[class*="apply-now"]',
    '#apply-btn',
    '[href*="apply"]'
  ];
  
  for (const selector of classSelectors) {
    try {
      btn = document.querySelector(selector);
      if (btn && btn.offsetParent !== null) {
        console.log(`✅ Apply按钮已找到 (选择器): ${selector}`);
        return btn;
      }
    } catch (e) {}
  }
  
  console.log('⚠️ 未找到Apply按钮');
  return null;
}

function findAndHighlightApplyButton() {
  const applyBtn = findApplyButton();
  
  if (!applyBtn) {
    console.warn('⚠️ 找不到Apply按钮');
    return null;
  }
  
  if (applyBtn.classList.contains('vh-apply-highlight')) {
    console.log('ℹ️ Apply按钮已高亮');
    return applyBtn;
  }
  
  // Highlight button
  applyBtn.classList.add('vh-apply-highlight');
  applyBtn.style.position = 'relative';
  console.log('✅ Apply按钮已高亮');
  
  // Auto-scroll
  setTimeout(() => {
    applyBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    console.log('👇 已滚动到Apply按钮');
  }, 300);
  
  // Only add listener once
  if (!applyBtn.dataset.vhListenerAdded) {
    applyBtn.addEventListener('click', function handleApplyClick() {
      console.log('👆 用户点击Apply按钮');
      showNotification('⏳ 加载中...', 'info');
      setTimeout(() => {
        applyHighlightApplied = false;
        detectPageType();
        handleCurrentPage();
      }, 1500);
    });
    applyBtn.dataset.vhListenerAdded = 'true';
  }
  
  return applyBtn;
}

// ===== FORM PAGE HANDLER =====

function detectAndLabelFields() {
  // Include hidden inputs that might be form fields
  const inputs = document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="submit"]):not([type="button"]), select:not([style*="display:none"]), textarea');
  
  if (inputs.length === 0) {
    if (lastFieldDetectionSummary !== '0') {
      console.warn('⚠️ 页面上没有发现表单元素');
      lastFieldDetectionSummary = '0';
    }
    return;
  }
  
  let fieldCount = 0;
  let labeledCount = 0;
  let unidentifiedFields = [];
  
  inputs.forEach((input, index) => {
    // Skip if already labeled
    if (input.dataset.vhLabeled === 'true') {
      if (input.type === 'file') {
        const existingFieldInfo = identifyField(input);
        if (existingFieldInfo) {
          bindUploadPersistence(input, existingFieldInfo);
        }
      }
      labeledCount++;
      return;
    }
    
    // Skip hidden or disabled fields (but check visibility better)
    if (input.style.display === 'none' || input.disabled) {
      return;
    }
    
    // More lenient visibility check - allow fields user can't see but are in DOM
    const visible = input.offsetParent !== null || input.closest('[style*="visibility"]') === null;
    
    const fieldInfo = identifyField(input);
    if (fieldInfo) {
      fieldCount++;
      fieldCache[fieldInfo.key] = input;
      console.log(`✅ 识别字段 [${index}]: ${fieldInfo.label_cn}`);
      addChineseLabel(input, fieldInfo);
      if (input.type === 'file') {
        bindUploadPersistence(input, fieldInfo);
      }
      
      // Auto-show hint on focus
      input.addEventListener('focus', () => {
        const hint = document.querySelector(`[data-vh-hint-for="${input.dataset.vhInputId}"]`);
        if (hint) {
          hint.style.display = 'block';
          console.log('ℹ️ 显示提示框');
        }
      }, { once: false });
    } else {
      // Log unidentified fields for debugging
      const label = input.placeholder || input.name || input.id || input.parentElement?.textContent?.substring(0, 30);
      const fieldInfo = {
        placeholder: input.placeholder || '',
        name: input.name || '',
        id: input.id || '',
        parent: input.parentElement?.textContent?.substring(0, 50) || ''
      };
      unidentifiedFields.push({
        index,
        type: input.type,
        label: label?.substring(0, 40),
        fieldInfo
      });
    }
  });
  
  const fieldDetectionSummary = `${inputs.length}|${fieldCount}|${labeledCount}`;
  if (fieldCount > 0 || fieldDetectionSummary !== lastFieldDetectionSummary) {
    console.log(`🔍 发现 ${inputs.length} 个表单元素`);
    console.log(`✅ 已识别并标记 ${fieldCount} 个新字段 (已有 ${labeledCount} 个)`);
    lastFieldDetectionSummary = fieldDetectionSummary;
  }
  
  // Log unidentified fields for debugging
  const unidentifiedSignature = unidentifiedFields
    .slice(0, 10)
    .map(field => `${field.index}|${field.fieldInfo.id}|${field.fieldInfo.name}|${field.fieldInfo.placeholder}`)
    .join('||');
  
  if (unidentifiedFields.length > 0 && unidentifiedSignature !== lastUnidentifiedFieldsSignature) {
    lastUnidentifiedFieldsSignature = unidentifiedSignature;
    console.warn(`⚠️ 未被识别的字段 (${unidentifiedFields.length} 个):`);
    unidentifiedFields.slice(0, 10).forEach(field => {
      console.log(`  [${field.index}] ${field.label} | placeholder:"${field.fieldInfo.placeholder}" name:"${field.fieldInfo.name}" parent:"${field.fieldInfo.parent.substring(0, 30)}"`);
    });
  } else if (unidentifiedFields.length === 0) {
    lastUnidentifiedFieldsSignature = '';
  }
  
  // Setup MutationObserver to re-add labels/hints if DOM changes
  if (fieldCount > 0 || inputs.length > 0) {
    setupHintRecovery();

    // Re-check once after Vue renders; avoid repeated self-scheduling loops.
    if (!relabelRetryScheduled) {
      relabelRetryScheduled = true;
      setTimeout(() => {
        relabelRetryScheduled = false;
        detectAndLabelFields();
      }, 2500);
    }
  }
}

function normalizeFieldContextText(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getAssociatedFieldLabelText(input) {
  const texts = [];

  if (input.id) {
    try {
      const linkedLabel = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (linkedLabel?.textContent) {
        texts.push(linkedLabel.textContent);
      }
    } catch (error) {
      const linkedLabel = document.querySelector(`label[for="${input.id.replace(/"/g, '\\"')}"]`);
      if (linkedLabel?.textContent) {
        texts.push(linkedLabel.textContent);
      }
    }
  }

  const wrappedLabel = input.closest('label');
  if (wrappedLabel?.textContent) {
    texts.push(wrappedLabel.textContent);
  }

  const formItemLabel = input.closest('.ant-form-item')?.querySelector('.ant-form-item-label label');
  if (formItemLabel?.textContent) {
    texts.push(formItemLabel.textContent);
  }

  const localContainer = input.closest('.field, .form-group, .form-item, .form-field, [data-field], td, th, tr, li');
  const localLabel = localContainer?.querySelector('label, .field-label, .form-label, .label');
  if (localLabel?.textContent) {
    texts.push(localLabel.textContent);
  }

  return normalizeFieldContextText(Array.from(new Set(texts.filter(Boolean))).join(' '));
}

function getLocalFieldContextText(input) {
  const texts = [];
  let current = input.parentElement;

  for (let depth = 0; depth < 5 && current; depth++) {
    if (current === document.body || current === document.documentElement) break;

    const text = normalizeFieldContextText(current.textContent);
    const controlCount = current.querySelectorAll?.('input, select, textarea').length || 0;
    const isNamedContainer = current.matches?.(
      '.ant-form-item, .field, .form-group, .form-item, .form-field, [data-field], td, th, tr, li, section, article'
    );

    if (text && text.length <= 180 && (isNamedContainer || controlCount <= 2)) {
      texts.push(text);
    }

    if (isNamedContainer) break;
    current = current.parentElement;
  }

  return normalizeFieldContextText(Array.from(new Set(texts.filter(Boolean))).join(' '));
}

function identifyField(input) {
  const label = normalizeFieldContextText(input.placeholder);
  const name = normalizeFieldContextText(input.name);
  const id = normalizeFieldContextText(input.id);
  const normalizedId = id.replace(/[^a-z0-9]/g, '');
  const ariaLabel = normalizeFieldContextText(input.getAttribute?.('aria-label'));
  const prevLabel = normalizeFieldContextText(input.previousElementSibling?.textContent);
  const linkedLabel = getAssociatedFieldLabelText(input);
  const localContext = getLocalFieldContextText(input);
  const directText = `${label} ${name} ${id} ${ariaLabel} ${prevLabel} ${linkedLabel}`.trim();
  const allText = `${directText} ${localContext}`.trim();
  
  // ===== VIETNAMESE ID FIELD RECOGNITION =====
  // Handle Vietnamese form field IDs (from Ant Form naming pattern)
  // These IDs appear in the id or aria-label attributes, not always in name
  if (id.includes('anh') && id.includes('mat')) {
    return { key: 'passport_photo', label_cn: '照片（正面）', hint: '上传正面照片', example: null, options: null };
  }
  if (id.includes('anh') && (id.includes('hochieu') || id.includes('passport') || normalizedId.includes('anhhochieu'))) {
    return { key: 'passport_copy', label_cn: '护照复印件', hint: '上传护照首页复印件', example: null, options: null };
  }
  if (id.includes('gioitinh') || id.includes('sex') || allText.includes('giới tính')) {
    return { key: 'gender', ...fieldMappings.gender };
  }
  if (id.includes('maqt') || id.includes('identity') || allText.includes('chứng minh')) {
    return { key: 'identity_card', ...fieldMappings.identity_card };
  }
  if (
    normalizedId.includes('hcloai') ||
    (id.includes('loai') && (id.includes('passport') || id.includes('hochieu') || allText.includes('loại')))
  ) {
    return { key: 'passport_type', ...fieldMappings.passport_type };
  }
  
  // 护照号码 (Enter passport)
  if (label === 'enter passport' || label.includes('passport') && label.includes('number') || 
      id.includes('passport') && id.includes('number')) {
    return { key: 'passport_number', ...fieldMappings.passport_number };
  }
  if (label === 'enter passport' || id.includes('hochieu') && id.includes('so')) {
    return { key: 'passport_number', ...fieldMappings.passport_number };
  }
  
  // 紧急联系人关系 (Enter relationship)
  if (label === 'enter relationship' || label.includes('relationship') || 
      id.includes('relationship') || allText.includes('relationship')) {
    return { key: 'emergency_contact_relationship', ...fieldMappings.emergency_contact_relationship };
  }
  
  // 临时居住地址 (basic_ttcdDcTamTru)
  if (
    normalizedId.includes('ttcddctamtru') ||
    normalizedId.includes('dctamtru') ||
    (allText.includes('temporary') && allText.includes('residence'))
  ) {
    return { key: 'destiny_residential_address', label_cn: '临时居住地址', hint: '越南的临时居住地址', example: '123 Tran Hung Dao St, Hanoi', options: null };
  }
  
  // 购买保险 (basic_kpbhMuaBaoHiem) - 需要在Ant Select识别中处理
  if (id.includes('kpbh') && id.includes('muabaohiem') || id.includes('insurance')) {
    return { key: 'bought_insurance', ...fieldMappings.bought_insurance };
  }
  
  // 保险承担人 (basic_kpbhNguoiDamBao) - 需要在Ant Select识别中处理
  if (id.includes('kpbh') && id.includes('nguoidambao') || id.includes('expense_coverage')) {
    return { key: 'expense_coverage', ...fieldMappings.expense_coverage };
  }
  if (normalizedId.includes('kpbhhinhthuc') || (id.includes('kpbh') && id.includes('hinhthuc'))) {
    return {
      key: 'payment_method',
      ...(fieldMappings?.payment_method || {
        label_cn: '支付方式',
        hint: '如页面要求，请选择支付方式',
        example: null,
        options: null
      })
    };
  }
  
  // 目的 (basic_ttcdMucDich) - 需要在Ant Select识别中处理
  if (id.includes('ttcd') && id.includes('mucdich') || label.includes('purpose')) {
    return { key: 'purpose', ...fieldMappings.purpose };
  }
  
  // 边境口岸 (basic_ttcdNcCuaKhau 和 basic_ttcdXcCuaKhau) - 需要在Ant Select识别中处理
  if (normalizedId.includes('ttcdnccuakhau') || normalizedId.includes('nccuakhau') || (id.includes('ttcd') && id.includes('ncuakhau'))) {
    return { key: 'intended_border_gate_of_entry', ...fieldMappings.intended_border_gate_of_entry };
  }
  if (normalizedId.includes('ttcdxccuakhau') || normalizedId.includes('xccuakhau') || (id.includes('ttcd') && id.includes('xcuakhau'))) {
    return { key: 'intended_border_gate_of_exit', ...fieldMappings.intended_border_gate_of_exit };
  }
  
  // ===== DATE FIELD RECOGNITION BY CONTEXT =====
  if (label === 'dd/mm/yyyy' || label.includes('dd/mm')) {
    const context = allText.substring(0, 200);
    if (context.includes('birth') || id.includes('birth') || id.includes('dob')) return { key: 'date_of_birth', ...fieldMappings.date_of_birth };
    if (context.includes('issue') || id.includes('issue')) return { key: 'passport_date_of_issue', ...fieldMappings.passport_date_of_issue };
    if (context.includes('expir') || id.includes('expir')) return { key: 'passport_expiry', ...fieldMappings.passport_expiry };
    if (context.includes('entry') || context.includes('arrival') || id.includes('entry') || id.includes('arrival')) return { key: 'intended_date_of_entry', ...fieldMappings.intended_date_of_entry };
    // If can't determine, use generic date
    return { key: 'generic_date', label_cn: '日期', hint: '请输入日期 (DD/MM/YYYY)', example: '01/01/1990', options: null };
  }
  
  // ===== ENGLISH FIELD RECOGNITION =====
  if (directText.includes('surname') || directText.includes('last name') || directText.includes('family name') || allText.includes('surname')) {
    return { key: 'surname', ...fieldMappings.surname };
  }
  // Given name / First name
  if (directText.includes('given') || directText.includes('first name') || (directText.includes('middle') && directText.includes('name')) || allText.includes('given')) {
    return { key: 'given_name', ...fieldMappings.given_name };
  }
  // Full name
  if (directText.includes('full name') || linkedLabel.includes('full name')) {
    return { key: 'full_name', ...fieldMappings.full_name };
  }
  // Date of birth
  if (directText.includes('date of birth') || directText.includes('birth date') || directText.includes('dob') || linkedLabel.includes('date of birth')) {
    return { key: 'date_of_birth', ...fieldMappings.date_of_birth };
  }
  // Sex / Gender
  if (directText.includes('sex') || directText.includes('gender') || linkedLabel.includes('gender')) {
    return { key: 'gender', ...fieldMappings.gender };
  }
  // Nationality
  if (directText.includes('nationality') || linkedLabel.includes('nationality')) {
    return { key: 'nationality', ...fieldMappings.nationality };
  }
  // Passport number
  if ((directText.includes('passport') && directText.includes('number')) || linkedLabel.includes('passport number')) {
    return { key: 'passport_number', ...fieldMappings.passport_number };
  }
  // Passport expiry
  if ((directText.includes('passport') && directText.includes('expir')) || directText.includes('passport validity') || linkedLabel.includes('passport expiry')) {
    return { key: 'passport_expiry', ...fieldMappings.passport_expiry };
  }
  // Email
  if (directText.includes('email') || linkedLabel.includes('email')) {
    return { key: 'email', ...fieldMappings.email };
  }
  // Phone
  if (directText.includes('phone') || directText.includes('mobile') || linkedLabel.includes('phone')) {
    return { key: 'phone', ...fieldMappings.phone };
  }
  // Purpose
  if (allText.includes('purpose') || allText.includes('reason')) {
    return { key: 'purpose', ...fieldMappings.purpose };
  }
  // Duration / Stay
  if (allText.includes('duration') || allText.includes('stay')) {
    return {
      key: 'duration',
      label_cn: fieldMappings.duration?.label_cn || fieldMappings.intended_length_of_stay?.label_cn || '停留天数',
      hint: fieldMappings.duration?.hint || fieldMappings.intended_length_of_stay?.hint || '',
      example: fieldMappings.duration?.example || fieldMappings.intended_length_of_stay?.example || null,
      options: fieldMappings.duration?.options || fieldMappings.intended_length_of_stay?.options || null
    };
  }
  // Arrival date
  if (allText.includes('arrival') && allText.includes('date')) {
    return { key: 'arrival_date', ...fieldMappings.arrival_date };
  }
  // Departure date / Intended date of entry
  if (allText.includes('departure') || (allText.includes('intended') && allText.includes('entry'))) {
    return { key: 'departure_date', ...fieldMappings.departure_date };
  }
  // City
  if (allText.includes('arrival') && allText.includes('city')) {
    return { key: 'arrival_city', ...fieldMappings.arrival_city };
  }
  // Address / Destination
  if (allText.includes('address') || allText.includes('destination') || allText.includes('residential')) {
    return { key: 'destination_address', ...fieldMappings.destination_address };
  }
  // Religion
  if (allText.includes('religion')) {
    return { key: 'religion', ...fieldMappings.religion };
  }
  // Place of birth
  if (allText.includes('place') && allText.includes('birth')) {
    return { key: 'place_of_birth', ...fieldMappings.place_of_birth };
  }
  // Identity card / ID
  if (allText.includes('identity') || allText.includes('id card')) {
    return { key: 'identity_card', ...fieldMappings.identity_card };
  }
  // Re-enter email
  if (allText.includes('re-enter') || allText.includes('re enter') || allText.includes('confirm')) {
    return { key: 're_enter_email', ...fieldMappings.re_enter_email };
  }
  // Passport type
  if (allText.includes('passport') && allText.includes('type')) {
    return { key: 'passport_type', ...fieldMappings.passport_type };
  }
  // Passport issue authority / issuing authority
  if (allText.includes('issuing') || allText.includes('issue') || (allText.includes('passport') && allText.includes('authority'))) {
    return { key: 'passport_issue_authority', ...fieldMappings.passport_issue_authority };
  }
  // Date of issue
  if (allText.includes('date') && allText.includes('issue')) {
    return { key: 'passport_date_of_issue', ...fieldMappings.passport_date_of_issue };
  }
  // Other passports
  if (allText.includes('other') && allText.includes('passport')) {
    return { key: 'other_passports', ...fieldMappings.other_passports };
  }
  // Phone in Vietnam
  if (allText.includes('vietnam') && allText.includes('phone')) {
    return { key: 'phone_in_vietnam', ...fieldMappings.phone_in_vietnam };
  }
  // Visa type / Entry type
  if (allText.includes('single') || allText.includes('multiple') || allText.includes('entry type')) {
    return { key: 'visa_type', ...fieldMappings.visa_type };
  }
  // Visa valid from
  if (allText.includes('visa') && allText.includes('valid') && allText.includes('from')) {
    return { key: 'visa_valid_from', ...fieldMappings.visa_valid_from };
  }
  // Visa valid to
  if (allText.includes('visa') && (allText.includes('valid to') || allText.includes('valid until'))) {
    return { key: 'visa_valid_to', ...fieldMappings.visa_valid_to };
  }
  // Intended length of stay
  if (allText.includes('length') && allText.includes('stay')) {
    return { key: 'intended_length_of_stay', ...fieldMappings.intended_length_of_stay };
  }
  // Province / City in Vietnam
  if (allText.includes('province') || (allText.includes('city') && allText.includes('vietnam'))) {
    return { key: 'province_city', ...fieldMappings.province_city };
  }
  // Ward / Commune
  if (allText.includes('ward') || allText.includes('commune') || allText.includes('district')) {
    return { key: 'ward_commune', ...fieldMappings.ward_commune };
  }
  // Border gate of entry
  if (allText.includes('border') && allText.includes('entry')) {
    return { key: 'intended_border_gate_of_entry', ...fieldMappings.intended_border_gate_of_entry };
  }
  // Border gate of exit
  if (allText.includes('border') && allText.includes('exit')) {
    return { key: 'intended_border_gate_of_exit', ...fieldMappings.intended_border_gate_of_exit };
  }
  // Temporary residence declaration
  if (allText.includes('temporary') && allText.includes('residence')) {
    return { key: 'temporary_residence_declaration', ...fieldMappings.temporary_residence_declaration };
  }
  // Agree to create account
  if (allText.includes('create') && allText.includes('account')) {
    return { key: 'agree_to_create_account', ...fieldMappings.agree_to_create_account };
  }
  // Multiple nationalities
  if (allText.includes('multiple') && allText.includes('nationality')) {
    return { key: 'multiple_nationalities', ...fieldMappings.multiple_nationalities };
  }
  // Violation of laws
  if (allText.includes('violation') || (allText.includes('violate') && allText.includes('laws'))) {
    return { key: 'violation_of_laws', ...fieldMappings.violation_of_laws };
  }
  // Occupation
  if (allText.includes('occupation') && !allText.includes('info')) {
    return { key: 'occupation', ...fieldMappings.occupation };
  }
  // Occupation info
  if (allText.includes('occupation') && allText.includes('info')) {
    return { key: 'occupation_info', ...fieldMappings.occupation_info };
  }
  // Company name / Company
  if ((allText.includes('company') || allText.includes('agency') || allText.includes('school')) && allText.includes('name')) {
    return { key: 'company_name', ...fieldMappings.company_name };
  }
  // Position / Course of study
  if (allText.includes('position') || allText.includes('course')) {
    return { key: 'position_course', ...fieldMappings.position_course };
  }
  // Company address
  if ((allText.includes('company') || allText.includes('agency') || allText.includes('school')) && allText.includes('address')) {
    return { key: 'company_address', ...fieldMappings.company_address };
  }
  // Company phone
  if ((allText.includes('company') || allText.includes('agency') || allText.includes('school')) && allText.includes('phone')) {
    return { key: 'company_phone', ...fieldMappings.company_phone };
  }
  // Emergency contact current address
  if (allText.includes('emergency') && allText.includes('current') && allText.includes('address')) {
    return { key: 'emergency_contact_current_address', ...fieldMappings.emergency_contact_current_address };
  }
  // Contact address
  if (allText.includes('contact') && allText.includes('address') && !allText.includes('emergency')) {
    return { key: 'contact_address', ...fieldMappings.contact_address };
  }
  // Emergency contact name (in emergency contact section, "Full name" = emergency contact name)
  if (allText.includes('emergency') && (allText.includes('full name') || allText.includes('name'))) {
    return { key: 'emergency_contact_name', ...fieldMappings.emergency_contact_name };
  }
  // Emergency contact phone (in emergency section, "Telephone" = emergency contact phone)
  if (allText.includes('emergency') && allText.includes('telephone')) {
    return { key: 'emergency_contact_phone', ...fieldMappings.emergency_contact_phone };
  }
  // Emergency contact relationship
  if (allText.includes('emergency') && allText.includes('relationship')) {
    return { key: 'emergency_contact_relationship', ...fieldMappings.emergency_contact_relationship };
  }
  
  // Additional fields that might be missing
  // Intended expenses / Trip expenses
  if (allText.includes('expense') && (allText.includes('intended') || allText.includes('trip'))) {
    return { key: 'intended_expenses', ...fieldMappings.intended_expenses };
  }
  // Insurance
  if (allText.includes('insurance') || allText.includes('buy insurance')) {
    return { key: 'bought_insurance', ...fieldMappings.bought_insurance };
  }
  // Who covers expenses
  if (allText.includes('cover') && allText.includes('expense')) {
    return { key: 'expense_coverage', ...fieldMappings.expense_coverage };
  }
  // Legal declaration
  if (allText.includes('hereby declare') || allText.includes('declare') && allText.includes('statement')) {
    return { key: 'legal_declaration', ...fieldMappings.legal_declaration };
  }
  // Relatives in Vietnam
  if (allText.includes('relative') && allText.includes('vietnam')) {
    return { key: 'relatives_in_vietnam', ...fieldMappings.relatives_in_vietnam };
  }
  
  return null;
}

function addChineseLabel(input, fieldInfo) {
  if (input.dataset.vhLabeled === 'true') return;
  input.dataset.vhLabeled = 'true';

  const safeLabel = fieldInfo?.label_cn || fieldInfo?.key || '字段';
  const safeHint = fieldInfo?.hint || '请输入有效信息';
  const safeExample = fieldInfo?.example;
  
  // Assign unique ID to input for tracking
  if (!input.dataset.vhInputId) {
    input.dataset.vhInputId = 'vh-input-' + Math.random().toString(36).slice(2, 9);
  }
  
  try {
    console.log(`📝 添加中文标签: ${safeLabel}`);
    
    // Remove old label if exists
    const oldLabel = document.querySelector(`[data-vh-label-id="${input.dataset.vhInputId}"]`);
    if (oldLabel) oldLabel.remove();
    
    // Create label container - position BELOW input, not floating above
    const labelContainer = document.createElement('div');
    labelContainer.setAttribute('data-vh-label-id', input.dataset.vhInputId);
    labelContainer.className = 'vh-chinese-label';
    
    // Use relative/static positioning so it appears inline below the input
    labelContainer.style.cssText = `
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      position: static;
      margin-top: 6px;
      margin-bottom: 8px;
      padding: 8px 10px;
      background: #fef5e7 !important;
      border-left: 4px solid #ff9800;
      border-radius: 4px;
      font-size: 12px;
      color: #333;
      line-height: 1.5;
      pointer-events: auto;
      z-index: auto;
      max-width: 100%;
      box-sizing: border-box;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    
    const html = `
      <div style="font-weight: 600; color: #333; margin-bottom: 3px;">
        💡 ${safeLabel}
      </div>
      <div style="color: #666; font-size: 11px; line-height: 1.4;">
        ${safeHint}
        ${safeExample ? `<br/><span style="color: #1976d2; font-weight: 500; display: block; margin-top: 3px;">例: ${safeExample}</span>` : ''}
      </div>
    `;
    
    labelContainer.innerHTML = html;
    
    // Insert DIRECTLY AFTER the input field (not after form-item)
    // This puts label right below the input, not floating above
    if (input.nextSibling) {
      input.parentNode.insertBefore(labelContainer, input.nextSibling);
    } else {
      input.parentNode.appendChild(labelContainer);
    }
    
    // Mark for recovery
    input.dataset.vhHasHints = 'true';
    input.dataset.vhFieldInfo = JSON.stringify(fieldInfo);
    
    console.log(`✅ 标签已添加在输入框下方: ${safeLabel} (ID: ${input.dataset.vhInputId})`);
  } catch (e) {
    console.error('❌ 添加标签失败:', safeLabel, e);
  }
}

function cleanupHintRecovery() {
  if (hintRecoveryDebounceTimer) {
    clearTimeout(hintRecoveryDebounceTimer);
    hintRecoveryDebounceTimer = null;
  }

  if (hintRecoveryIntervalId) {
    clearInterval(hintRecoveryIntervalId);
    hintRecoveryIntervalId = null;
  }

  if (hintRecoveryObserver) {
    hintRecoveryObserver.disconnect();
    hintRecoveryObserver = null;
  }

  hintRecoveryInitialized = false;
}

function ensureHintRecoveryCleanupRegistered() {
  if (hintRecoveryCleanupBound) {
    return;
  }

  hintRecoveryCleanupBound = true;
  window.addEventListener('pagehide', cleanupHintRecovery, { once: true });
  window.addEventListener('beforeunload', cleanupHintRecovery, { once: true });
}

function setupHintRecovery() {
  if (hintRecoveryInitialized) {
    return;
  }
  hintRecoveryInitialized = true;
  ensureHintRecoveryCleanupRegistered();
  console.log('🔄 标签恢复机制已启用 - 标签如果被移除会自动恢复');

  // Use MutationObserver to detect when hints/labels are removed and restore them
  const observerConfig = {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  };
  
  const checkAndRestore = () => {
    // Find all inputs that should have hints
    const inputsWithHints = document.querySelectorAll('[data-vh-has-hints="true"]');
    
    inputsWithHints.forEach(input => {
      // Check if label is missing
      const labelId = input.dataset.vhInputId;
      const label = document.querySelector(`[data-vh-label-id="${labelId}"]`);
      
      if (!label && input.offsetParent !== null) {
        console.log('🔄 恢复消失的标签: ' + (input.name || input.id || input.placeholder));
        try {
          const fieldInfo = JSON.parse(input.dataset.vhFieldInfo);
          // Remove old labeled flag to allow re-labeling
          input.dataset.vhLabeled = 'false';
          addChineseLabel(input, fieldInfo);
        } catch (e) {
          console.warn('❌ 恢复失败:', e);
        }
      }
    });
  };
  
  hintRecoveryObserver = new MutationObserver(() => {
    // Debounce the recovery check to avoid too many updates
    clearTimeout(hintRecoveryDebounceTimer);
    hintRecoveryDebounceTimer = setTimeout(checkAndRestore, 500);
  });
  
  hintRecoveryObserver.observe(document.body, observerConfig);
  
  // Also periodically check and restore every 2 seconds
  hintRecoveryIntervalId = setInterval(checkAndRestore, 2000);
}

function toggleAutoFill() {
  isAutoFillEnabled = !isAutoFillEnabled;
  const icon = document.getElementById('vh-autofill-status');
  if (icon) icon.textContent = isAutoFillEnabled ? '🟢' : '🔴';
  
  if (isAutoFillEnabled) {
    console.log('🟢 自动填表已启用');
    fillAllFields();
    
    // After auto-fill, ensure labels are added to form fields
    setTimeout(() => {
      console.log('📝 自动填表完成后检查和添加标签...');
      detectAndLabelFields();
    }, 500);
    
    setTimeout(() => {
      console.log('📝 [再次确认] 确保所有标签已添加...');
      detectAndLabelFields();
    }, 1500);
  } else {
    console.log('🔴 自动填表已禁用');
    showNotification('已关闭自动填表', 'info');
  }
}

async function fillAllFields() {
  console.log('📝 开始自动填表 v2...\n');
  let uploadDocuments = await ensureUploadDocumentsLoaded();
  let uploadCount = Object.keys(uploadDocuments || {}).filter(key => !!uploadDocuments[key]).length;
  const hasFileInputs = !!document.querySelector('input[type="file"]');
  console.log(`📎 已加载本地上传文件: ${uploadCount} 个`);
  setPanelStatusText(uploadCount > 0 ? `已加载上传文件 ${uploadCount} 个` : '未检测到上传文件');
  if (uploadCount === 0 && hasFileInputs) {
    console.warn('⚠️ 未检测到本地上传文件，请先在插件弹窗中重新选择“申请人正面照片”和“护照资料页”');
    console.log('⏳ 等待上传文件写入本地存储...');
    uploadDocuments = await waitForUploadDocuments(6000, 250);
    uploadCount = Object.keys(uploadDocuments || {}).filter(key => !!uploadDocuments[key]).length;
    console.log(`📎 重试后已加载本地上传文件: ${uploadCount} 个`);
    if (uploadCount === 0) {
      showUploadSetupGuidance();
    } else {
      setPanelStatusText(`已加载上传文件 ${uploadCount} 个`);
    }
  }
  
  // 第 1 阶段：填充标准输入字段
  console.log('📊 第 1 阶段：填充标准输入字段');
  const standardInputs = document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
  let standardSuccess = 0;
  let standardAttempted = 0;
  
  console.log(`  发现 ${standardInputs.length} 个标准输入字段`);
  
  for (const [idx, input] of Array.from(standardInputs).entries()) {
    if (input.type === 'file') {
      const fieldInfo = identifyField(input);
      if (!fieldInfo?.key) {
        console.log(`  ⊘ [${idx}] 文件上传字段: 无法识别`);
        continue;
      }

      const uploadValue = getValueFromUserData(fieldInfo.key);
      if (!uploadValue) {
        console.log(`  ⊘ [${idx}] ${fieldInfo.label_cn}: 没有上传文件数据`);
        continue;
      }

      standardAttempted++;

      if (await fillFileInputSmart(input, uploadValue, fieldInfo)) {
        standardSuccess++;
        input.classList.add('vh-filled');
      }
      continue;
    }

    if (isAntManagedFieldElement(input)) {
      console.log(`  ⊘ [${idx}] Ant 组件字段留给专用阶段处理`);
      continue;
    }

    const fieldInfo = identifyField(input);
    if (!fieldInfo?.key) {
      continue;
    }
    
    const value = getValueFromUserData(fieldInfo.key);
    if (!value && value !== 0) {
      console.log(`  ⊘ [${idx}] ${fieldInfo.label_cn}: 没有值`);
      continue;
    }
    
    standardAttempted++;
    
    try {
      let filled = false;

      if (input.tagName === 'SELECT') {
        fillSelectField(input, value, fieldInfo);
        filled = !!(await waitFor(() => isStandardInputValueApplied(input, value, fieldInfo), 600, 50));
      } else {
        filled = await fillStandardInputSmart(input, value, fieldInfo);
      }

      if (filled) {
        standardSuccess++;
        input.classList.add('vh-filled');
        console.log(`  ✅ [${idx}] ${input.type === 'number' ? '数字' : '文本'}字段: ${fieldInfo.label_cn} = ${value}`);
      } else {
        console.warn(`  ⚠️ [${idx}] ${fieldInfo.label_cn}: 写入后未确认生效`);
      }
    } catch (e) {
      console.warn(`  ❌ [${idx}] ${fieldInfo.label_cn}:`, e.message);
    }
  }
  
  console.log(`✅ 标准字段填充: ${standardSuccess}/${standardAttempted} 尝试\n`);
  
  // 第 2 阶段：填充 Ant Design Select
  await sleep(300);
  await fillPendingAntSelects('第 2 阶段：填充 Ant Design Select');
  
  // 第 3 阶段：填充 Ant Design DatePicker
  await sleep(300);
  console.log('📊 第 3 阶段：填充 Ant DatePicker');
  const antPickers = document.querySelectorAll('.ant-picker');
  let pickerSuccess = 0;
  let pickerAttempted = 0;
  
  console.log(`  发现 ${antPickers.length} 个 Ant DatePicker`);
  
  for (const [idx, picker] of Array.from(antPickers).entries()) {
    if (picker.classList.contains('vh-filled')) continue;
    
    const fieldInfo = identifyAntPickerField(picker);
    if (!fieldInfo) {
      console.log(`  ⊘ [${idx}] Ant DatePicker: 无法识别`);
      continue;
    }
    
    const value = getValueFromUserData(fieldInfo.key);
    if (!value && value !== 0) {
      console.log(`  ⊘ [${idx}] ${fieldInfo.key}: 没有值`);
      continue;
    }
    
    pickerAttempted++;
    
    if (await fillAntPickerSmart(picker, value, fieldInfo)) {
      pickerSuccess++;
      picker.classList.add('vh-filled');
    }
  }
  
  console.log(`✅ Ant DatePicker: ${pickerSuccess}/${pickerAttempted} 尝试\n`);

  // 第 3.5 阶段：补填动态出现的 Ant Select
  await sleep(250);
  await fillPendingAntSelects('第 3.5 阶段：补填动态出现的 Ant Select');
  
  // 第 4 阶段：填充复选框
  await sleep(300);
  console.log('📊 第 4 阶段：填充复选框和单选框');
  
  // 查找所有复选框（包括直接的 input[type="checkbox"] 和通过 Ant Checkbox 包装的）
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  let checkboxSuccess = 0;
  let checkboxAttempted = 0;
  
  console.log(`  发现 ${checkboxes.length} 个复选框`);
  
  checkboxes.forEach((checkbox, idx) => {
    let checkedFieldInfo = null;
    
    // 方法 1：从 Ant Checkbox 标签直接识别（最可靠）
    const antCheckbox = checkbox.closest('.ant-checkbox');
    if (antCheckbox) {
      const label = antCheckbox.nextElementSibling?.textContent?.trim() || '';
      const wrapper = antCheckbox.closest('.ant-checkbox-wrapper');
      const wrapperText = wrapper?.textContent?.trim() || '';
      const allText = `${label} ${wrapperText}`.toLowerCase();
      
      console.log(`    [${idx}] Ant Checkbox - Label: "${label}", Wrapper text: "${wrapperText.substring(0, 30)}..."`);
      
      // 根据文本内容识别
      if (
        (allText.includes('temporary') || allText.includes('residence')) &&
        (allText.includes('declaration') || allText.includes('declare') || allText.includes('committed'))
      ) {
        checkedFieldInfo = { key: 'temporary_residence_declaration', label_cn: '临时居住地址声明' };
      } else if (allText.includes('agree') || allText.includes('create') || allText.includes('account')) {
        checkedFieldInfo = { key: 'agree_to_create_account', label_cn: '同意创建账户' };
      } else if (
        allText.includes('legal') ||
        allText.includes('vietnamese laws') ||
        allText.includes('declare') ||
        allText.includes('accurate') ||
        allText.includes('compliance') ||
        allText.includes('reading carefully') ||
        allText.includes('completed application')
      ) {
        checkedFieldInfo = { key: 'legal_declaration', label_cn: '法律声明' };
      } else {
        console.log(`    [${idx}] 无法从 Ant Checkbox 标签匹配任何字段`);
      }
    } else {
      console.log(`    [${idx}] 未找到 ant-checkbox 包装器，跳过此复选框`);
    }
    
    // 如果还是没识别，跳过这个复选框
    if (!checkedFieldInfo?.key) {
      console.log(`  ⊘ [${idx}] 复选框: 无法识别`);
      return;
    }
    
    // 获取要填充的值
    const value = getValueFromUserData(checkedFieldInfo.key);
    console.log(`    [${idx}] ${checkedFieldInfo.key} = "${value}"`);
    
    if (!value) {
      console.log(`  ⊘ [${idx}] ${checkedFieldInfo.key}: 没有值`);
      return;
    }
    
    checkboxAttempted++;
    
    // 检查值是否应该被勾选
    if (value === 'on' || value === true || value === 'yes' || value === 'Yes') {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      checkbox.dispatchEvent(new Event('click', { bubbles: true }));
      checkbox.dispatchEvent(new Event('input', { bubbles: true }));
      checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      
      // 点击 Ant Design 包装器以确保 Vue 更新
      if (antCheckbox) {
        antCheckbox.click?.();
        antCheckbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
      
      checkboxSuccess++;
      console.log(`  ✅ [${idx}] ${checkedFieldInfo.label_cn}: ${value}`);
    }
  });
  
  console.log(`✅ 复选框: ${checkboxSuccess}/${checkboxAttempted} 尝试\n`);

  // 第 4.5 阶段：最后再扫一遍动态下拉
  await sleep(250);
  await fillPendingAntSelects('第 4.5 阶段：最终补填动态出现的 Ant Select');

  // 第 5 阶段：最后回填普通输入框，兜住页面回刷导致的空白
  await sleep(200);
  await fillPendingStandardInputs('第 5 阶段：最终回填普通输入框');

  console.log('✨ 自动填表完成\n');
  showPostFillNextGuidance();
}

const DATE_FIELD_KEYS = new Set([
  'date_of_birth',
  'passport_date_of_issue',
  'passport_expiry',
  'visa_valid_from',
  'visa_valid_to',
  'intended_date_of_entry',
  'arrival_date',
  'departure_date',
  'generic_date'
]);

function isDateField(input, fieldInfo = null) {
  const placeholder = (input.placeholder || '').toLowerCase();
  const name = (input.name || '').toLowerCase();
  const id = (input.id || '').toLowerCase();
  const parent = (input.parentElement?.textContent || '').toLowerCase();
  
  const allText = `${placeholder} ${name} ${id} ${parent}`;

  if (input.type === 'date') return true;
  if (fieldInfo?.key && DATE_FIELD_KEYS.has(fieldInfo.key)) return true;
  if (fieldInfo?.key && !DATE_FIELD_KEYS.has(fieldInfo.key)) return false;

  const hasExplicitDateShape =
    allText.includes('dd/mm') ||
    allText.includes('mm/dd') ||
    allText.includes('yyyy-mm-dd') ||
    allText.includes('date');

  if (!hasExplicitDateShape) return false;

  return ['birth', 'expir', 'entry', 'exit', 'valid', 'issue'].some(keyword => allText.includes(keyword));
}

function fillSelectField(select, value, fieldInfo) {
  // Try to find matching option
  const options = Array.from(select.options || []);
  let matched = options.find(opt => 
    opt.value.toLowerCase() === value.toString().toLowerCase() ||
    opt.text.toLowerCase() === value.toString().toLowerCase() ||
    opt.text.toLowerCase().includes(value.toString().toLowerCase())
  );
  
  if (matched) {
    select.value = matched.value;
    triggerEvents(select);
    console.log(`  ✓ 选择选项: ${matched.text}`);
  } else {
    console.log(`  ℹ️ 未找到匹配选项，可用值: ${options.map(o => o.value).join(', ')}`);
  }
}

function fillRadioCheckbox(input, value, fieldInfo) {
  const container = input.closest('.ant-checkbox') || input.closest('.ant-radio') || input.parentElement;
  
  // Check if this checkbox/radio matches the value
  if (input.value.toLowerCase() === value.toString().toLowerCase() ||
      container?.textContent?.toLowerCase().includes(value.toString().toLowerCase())) {
    input.checked = true;
    
    // Trigger click on wrapper to ensure Ant Design updates
    if (container) {
      container.click?.();
    }
    
    triggerEvents(input);
    triggerEvents(container);
    console.log(`  ✓ 已勾选: ${input.value}`);
  }
}

function fillDateField(input, value, fieldInfo) {
  // Normalize date format - convert to DD/MM/YYYY format which most Vietnamese forms use
  let dateValue = value.toString();
  
  // If input already has the right format, use it
  if (input.value && input.type === 'date') {
    input.value = value;
  } else {
    // Try to format as DD/MM/YYYY
    dateValue = normalizeDateFormat(dateValue);
    input.value = dateValue;
  }
  
  // Trigger date change events
  triggerEvents(input);
  
  // Also try clicking on date picker if visible
  const datePickerButton = input.parentElement?.querySelector('[role="button"]');
  if (datePickerButton && datePickerButton.offsetParent !== null) {
    datePickerButton.click();
    
    // Wait for picker to open, then try to input the date
    setTimeout(() => {
      const dateInput = document.querySelector('.ant-picker-input, input[type="date"]');
      if (dateInput) {
        dateInput.value = dateValue;
        triggerEvents(dateInput);
      }
      
      // Try to confirm/close the picker
      const confirmBtn = document.querySelector('.ant-picker-ok, button[type="submit"]');
      confirmBtn?.click();
    }, 200);
  }
  
  console.log(`  ✓ 已填充日期: ${dateValue}`);
}

function normalizeDateFormat(dateStr) {
  // Handle various date formats and convert to DD/MM/YYYY
  const str = dateStr.toString().trim();
  
  // Already in DD/MM/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [day, month, year] = str.split('/');
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  
  // YYYY-MM-DD format
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const [year, month, day] = str.split('-');
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  
  // MM/DD/YYYY format (convert to DD/MM/YYYY)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [month, day, year] = str.split('/');
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  
  // Try to parse and reformat
  try {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {
    // Silent fail
  }
  
  // Return original if can't parse
  return str;
}

// ===== Ant Design 字段识别函数 =====
function identifyAntSelectField(selectContainer) {
  const formItem = selectContainer.closest('.ant-form-item');
  const formLabel = formItem?.querySelector('.ant-form-item-label label')?.textContent?.trim() || '';
  // 获取所有可能的文本线索
  const label = selectContainer.previousElementSibling?.textContent || '';
  const parentText = selectContainer.parentElement?.textContent || '';
  const domHints = Array.from(
    selectContainer.querySelectorAll('input, [id], [name], [aria-label], [data-testid], [placeholder]')
  ).map(el => {
    const parts = [
      el.id,
      el.getAttribute?.('name'),
      el.getAttribute?.('aria-label'),
      el.getAttribute?.('data-testid'),
      el.getAttribute?.('placeholder')
    ].filter(Boolean);
    return parts.join(' ');
  }).join(' ');
  const normalizedHints = domHints.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // 获取上级的所有文本
  const labelText = `${formLabel} ${label}`.toLowerCase();
  let allText = `${formLabel} ${label} ${parentText} ${selectContainer.id} ${selectContainer.className} ${domHints}`.toLowerCase();
  let current = selectContainer.parentElement;
  for (let i = 0; i < 3 && current; i++) {
    allText += ' ' + (current.textContent || '').substring(0, 100).toLowerCase();
    current = current.parentElement;
  }

  const makeFieldInfo = (key) => {
    const mapping = fieldMappings?.[key] || {};
    return {
      key,
      label_cn: mapping.label_cn || key,
      hint: mapping.hint || '',
      example: mapping.example || null,
      options: mapping.options || null
    };
  };

  // ID-driven shortcuts for Vietnamese eVisa field ids
  if (normalizedHints.includes('hcloai') || normalizedHints.includes('hochieu') && normalizedHints.includes('loai')) {
    return makeFieldInfo('passport_type');
  }
  if (normalizedHints.includes('ttcdnccuakhau') || normalizedHints.includes('nccuakhau')) {
    return makeFieldInfo('intended_border_gate_of_entry');
  }
  if (normalizedHints.includes('ttcdxccuakhau') || normalizedHints.includes('xccuakhau')) {
    return makeFieldInfo('intended_border_gate_of_exit');
  }
  if (normalizedHints.includes('ttcddctamtru') || normalizedHints.includes('dctamtru')) {
    return makeFieldInfo('destiny_residential_address');
  }
  if (normalizedHints.includes('mamd')) {
    return makeFieldInfo('purpose');
  }
  if (normalizedHints.includes('kpbhmuabaohiem') || normalizedHints.includes('muabaohiem')) {
    return makeFieldInfo('bought_insurance');
  }
  if (normalizedHints.includes('kpbhhinhthuc')) {
    return makeFieldInfo('payment_method');
  }

  const labelDrivenMappings = [
    {
      key: 'purpose',
      keys: ['purpose of entry', 'purpose of visit', 'purpose', 'muc dich', '访问目的', '入境目的']
    },
    {
      key: 'visa_type',
      keys: ['visa type', 'number of entries', 'single entry', 'multiple entry', 'single-entry', 'multiple-entry', '签证类型']
    }
  ];

  for (const config of labelDrivenMappings) {
    if (config.keys.some(k => labelText.includes(k))) {
      return makeFieldInfo(config.key);
    }
  }
  
  // 扩展的匹配规则
  const antFieldMappings = {
    'gender': { keys: ['gender', 'sex', 'giới tính', '性别', 'giới tính'] },
    'nationality': { keys: ['nationality', 'quốc tịch', '国籍', '国籍'] },
    'passport_type': { keys: ['passport type', 'type of passport', 'loại hộ chiếu', 'hộ chiếu loại', '护照类型'] },
    'purpose': { keys: ['purpose', 'purpose of entry', '目的', 'mục đích', '为何', 'reason for visit'] },
    'occupation': { keys: ['occupation', '职业', '职位', 'nghề', '工作'] },
    'religion': { keys: ['religion', '宗教', '宗教信仰', 'tôn giáo'] },
    'province_city': { keys: ['province', 'city', '省市', 'tỉnh', '城市', '地方'] },
    'ward_commune': { keys: ['ward', 'commune', '乡镇', 'xã', '街道'] },
    'intended_border_gate_of_entry': { keys: ['border gate of entry', 'gate of entry', 'port of entry', '入境口岸', 'cửa khẩu nhập cảnh'] },
    'intended_border_gate_of_exit': { keys: ['border gate of exit', 'gate of exit', 'port of exit', '出境口岸', 'cửa khẩu xuất cảnh'] },
    'bought_insurance': { keys: ['insurance', '保险', 'bảo hiểm', 'buy', 'mua'] },
    'expense_coverage': { keys: ['cover', 'expense', '谁', 'who', 'ai sẽ', '费用'] },
    'payment_method': { keys: ['payment method', 'method of payment', 'payment', 'hinh thuc', 'hình thức', '支付方式', 'thanh toán'] },
    'visa_type': { keys: ['visa type', 'type of visa', 'number of entries', 'single-entry', 'multiple-entry', 'single entry', 'multiple entry', '签证类型', 'thị thực'] }
  };
  
  for (const [key, config] of Object.entries(antFieldMappings)) {
    if (config.keys.some(k => allText.includes(k))) {
      return makeFieldInfo(key);
    }
  }
  
  return null;
}

function identifyAntPickerField(picker) {
  // 从 form-item 中获取标签（最可靠）
  const formItem = picker.closest('.ant-form-item');
  let formLabel = formItem?.querySelector('.ant-form-item-label label')?.textContent?.trim().toLowerCase() || '';
  
  // 如果 formLabel 为空，尝试向上搜索更多层级
  if (!formLabel) {
    // 尝试从上一个 form-item 或其他兄弟元素找标签
    let sibling = formItem?.previousElementSibling;
    while (sibling && !formLabel) {
      const siblingLabel = sibling.querySelector('.ant-form-item-label label')?.textContent?.trim().toLowerCase();
      if (siblingLabel) {
        formLabel = siblingLabel;
        break;
      }
      sibling = sibling.previousElementSibling;
    }
    
    // 如果还是没找到，尝试从父级找所有标签
    if (!formLabel) {
      const allLabels = Array.from(formItem?.parentElement?.querySelectorAll('.ant-form-item-label label') || [])
        .map(l => l.textContent.trim().toLowerCase());
      if (allLabels.length > 0) {
        formLabel = allLabels[allLabels.length - 1];  // 取最后一个标签
      }
    }
  }
  
  // 获取其他可能的文本线索
  const label = picker.previousElementSibling?.textContent?.trim().toLowerCase() || '';
  const ariaLabel = picker.getAttribute('aria-label')?.toLowerCase() || '';
  
  // 合并所有文本来源
  let allText = `${formLabel} ${label} ${ariaLabel} ${picker.id} ${picker.className}`.toLowerCase();
  
  // 精确匹配映射（基于 formLabel）
  const exactMappings = {
    'date_of_birth': ['date of birth', 'ngày sinh', '出生日期', 'birth'],
    'passport_date_of_issue': ['date of issue', 'ngày cấp', '签发日期', 'issue'],
    'passport_expiry': ['expiry date', 'ngày hết hạn', '有效期终止日期', 'expiry'],
    'visa_valid_from': ['grant e-visa valid from', 'hạn dùng từ', '有效期开始日期', 'valid from', 'from'],
    'visa_valid_to': ['to', 'hết hạn', '有效期'],  // "To" 单独作为标签
    'intended_date_of_entry': ['intended date of entry', 'ngày dự định nhập cảnh', '计划入境日期', 'entry']
  };
  
  // 精确匹配 formLabel
  for (const [key, keywords] of Object.entries(exactMappings)) {
    if (keywords.some(k => {
      const k_lower = k.toLowerCase();
      if (k_lower === 'to' && formLabel === 'to') return true;  // 精确匹配 "to"
      if (k_lower.length < 3) return false;  // 短关键词避免误匹配
      return formLabel.includes(k_lower);
    })) {
      return { key: key, label_cn: key };
    }
  }
  
  // 备选：关键词匹配
  const fieldMappings = {
    'date_of_birth': { keys: ['birth', 'dob', 'ngày sinh', '出生', '生年月日', 'sinh nhật'] },
    'passport_date_of_issue': { keys: ['issue', '签发', 'ngày cấp', '签发日期'] },
    'passport_expiry': { keys: ['expir', 'expiry', '到期', 'hết hạn', '有效期'] },
    'visa_valid_from': { keys: ['valid', 'from', 'hạn dùng', '有效期', 'grant'] },
    'visa_valid_to': { keys: ['valid', 'to', 'hết', '到期'] },
    'intended_date_of_entry': { keys: ['entry', 'arrival', '入境', 'vào', 'ngày', 'intended'] }
  };
  
  for (const [key, config] of Object.entries(fieldMappings)) {
    if (config.keys.some(k => allText.includes(k))) {
      return { key: key, label_cn: key };
    }
  }
  
  // 最后备选：如果标签完全缺失，按 DatePicker 所在位置识别
  // 通常第一个 DatePicker（无标签）是 date_of_birth
  if (!formLabel && !label && !ariaLabel) {
    const allPickers = Array.from(document.querySelectorAll('.ant-picker'));
    const pickerIndex = allPickers.indexOf(picker);
    
    // 基于位置的默认识别
    const defaultByIndex = {
      0: 'date_of_birth'  // 第一个通常是出生日期
    };
    
    if (defaultByIndex[pickerIndex]) {
      return { key: defaultByIndex[pickerIndex], label_cn: defaultByIndex[pickerIndex] };
    }
  }
  
  return null;
}

async function fillPendingAntSelects(stageLabel = '补填 Ant Select') {
  console.log(`📊 ${stageLabel}`);
  const antSelects = Array.from(document.querySelectorAll('.ant-select'));
  let selectSuccess = 0;
  let selectAttempted = 0;

  console.log(`  发现 ${antSelects.length} 个 Ant Select`);

  for (const [idx, selectContainer] of antSelects.entries()) {
    if (selectContainer.classList.contains('vh-filled')) continue;

    const fieldInfo = identifyAntSelectField(selectContainer);
    if (!fieldInfo) {
      console.log(`  ⊘ [${idx}] Ant Select: 无法识别`);
      continue;
    }

    const value = getValueFromUserData(fieldInfo.key);
    if (!value && value !== 0) {
      console.log(`  ⊘ [${idx}] ${fieldInfo.key}: 没有值`);
      continue;
    }

    selectAttempted++;

    if (await fillAntSelectSmart(selectContainer, value, fieldInfo)) {
      selectSuccess++;
      selectContainer.classList.add('vh-filled');
    }
  }

  console.log(`✅ ${stageLabel}: ${selectSuccess}/${selectAttempted} 尝试\n`);
  return {
    total: antSelects.length,
    attempted: selectAttempted,
    success: selectSuccess
  };
}

async function fillPendingStandardInputs(stageLabel = '补填普通输入框') {
  console.log(`📊 ${stageLabel}`);
  const standardInputs = Array.from(document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]), select, textarea'));
  let standardSuccess = 0;
  let standardAttempted = 0;

  console.log(`  发现 ${standardInputs.length} 个普通字段`);

  for (const [idx, input] of standardInputs.entries()) {
    if (isAntManagedFieldElement(input)) continue;

    const fieldInfo = identifyField(input);
    if (!fieldInfo?.key) continue;

    const value = getValueFromUserData(fieldInfo.key);
    if (!value && value !== 0) continue;
    if (isStandardInputValueApplied(input, value, fieldInfo)) continue;

    standardAttempted++;

    try {
      let filled = false;

      if (input.tagName === 'SELECT') {
        fillSelectField(input, value, fieldInfo);
        filled = !!(await waitFor(() => isStandardInputValueApplied(input, value, fieldInfo), 600, 50));
      } else {
        filled = await fillStandardInputSmart(input, value, fieldInfo);
      }

      if (filled) {
        standardSuccess++;
        input.classList.add('vh-filled');
        console.log(`  ✅ [${idx}] 最终回填: ${fieldInfo.label_cn} = ${value}`);
      } else {
        console.warn(`  ⚠️ [${idx}] 最终回填失败: ${fieldInfo.label_cn}`);
      }
    } catch (error) {
      console.warn(`  ❌ [${idx}] 最终回填异常 ${fieldInfo.label_cn}:`, error.message);
    }
  }

  console.log(`✅ ${stageLabel}: ${standardSuccess}/${standardAttempted} 尝试\n`);
  return {
    total: standardInputs.length,
    attempted: standardAttempted,
    success: standardSuccess
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(conditionFn, timeoutMs = 1500, intervalMs = 50) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = conditionFn();
    if (result) return result;
    await sleep(intervalMs);
  }
  return null;
}

async function ensureUploadDocumentsLoaded(force = false) {
  if (!force && uploadDocumentsCache && Object.keys(uploadDocumentsCache).length > 0) {
    return uploadDocumentsCache;
  }

  if (chrome?.storage?.local) {
    try {
      const storageDocuments = await new Promise(resolve => {
        chrome.storage.local.get([UPLOAD_STORAGE_KEY], (result) => {
          if (chrome.runtime.lastError) {
            console.warn('⚠️ 从 storage.local 读取上传文件失败:', chrome.runtime.lastError.message);
            resolve(null);
            return;
          }
          resolve(result?.[UPLOAD_STORAGE_KEY] || {});
        });
      });

      if (storageDocuments && Object.keys(storageDocuments).length > 0) {
        uploadDocumentsCache = storageDocuments;
        return uploadDocumentsCache;
      }
    } catch (error) {
      console.warn('⚠️ 从 storage.local 读取上传文件异常:', error.message);
    }
  }

  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage({ action: 'getUploadDocuments' }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('⚠️ 读取本地上传文件失败:', chrome.runtime.lastError.message);
          uploadDocumentsCache = uploadDocumentsCache || {};
          resolve(uploadDocumentsCache);
          return;
        }

        uploadDocumentsCache = response?.documents || uploadDocumentsCache || {};
        resolve(uploadDocumentsCache);
      });
    } catch (error) {
      console.warn('⚠️ 读取本地上传文件异常:', error.message);
      uploadDocumentsCache = uploadDocumentsCache || {};
      resolve(uploadDocumentsCache);
    }
  });
}

async function waitForUploadDocuments(timeoutMs = 6000, intervalMs = 250) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const documents = await ensureUploadDocumentsLoaded(true);
    const count = Object.keys(documents || {}).filter(key => !!documents[key]).length;
    if (count > 0) {
      return documents;
    }
    await sleep(intervalMs);
  }

  return uploadDocumentsCache || {};
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

function sendRuntimeMessage(message) {
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

function setPanelStatusText(text) {
  const statusNode = document.querySelector('#vh-stats small');
  if (statusNode) {
    statusNode.textContent = text;
  }
}

function clearDisclaimerGuidanceArtifacts() {
  document.querySelector('.vh-disclaimer-guide')?.remove();
  document.getElementById('vh-disclaimer-success-msg')?.remove();

  const styledNodes = document.querySelectorAll('[data-vh-disclaimer-styled="true"]');
  styledNodes.forEach(node => {
    node.classList.remove('vh-checkbox-highlight');
    node.style.boxShadow = '';
    node.style.borderRadius = '';
    node.style.padding = '';
    node.style.transition = '';
    node.style.position = '';
    delete node.dataset.vhDisclaimerStyled;
  });
}

function clearCaptchaGuidanceArtifacts() {
  const highlightedInput = document.querySelector('[data-vh-captcha-highlight="true"]');
  if (!highlightedInput) {
    return;
  }

  highlightedInput.style.outline = '';
  highlightedInput.style.outlineOffset = '';
  delete highlightedInput.dataset.vhCaptchaHighlight;
}

function showPostFillNextGuidance() {
  const nextBtn = findNextButton();
  setPanelStatusText('填充完成，请手动点击 Next');

  if (nextBtn) {
    nextBtn.classList.add('vh-apply-highlight');

    if (!nextBtn.dataset.vhPostFillGuidanceBound) {
      nextBtn.dataset.vhPostFillGuidanceBound = 'true';
      nextBtn.addEventListener('click', () => {
        captchaGuidanceShown = false;
        setPanelStatusText('已点击 Next，等待验证码步骤...');
        showTopGuidance('⏳ 正在进入下一步（验证码）...', {
          persistent: true,
          force: true
        });
        showNotification('下一步通常是验证码页面，请按提示手动输入验证码', 'info');

        // Support SPA-style transitions where content script is not reinjected.
        setTimeout(() => {
          detectPageType();
          handleCurrentPage();
        }, 1400);
      });
    }

    if (nextBtn.offsetParent !== null) {
      nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  showTopGuidance('✅ 填写完成：请手动点击 Next 进入下一步（验证码）', {
    persistent: true,
    force: true
  });
  showNotification('请先核对关键信息，再手动点击 Next', 'success');
}

function handleCaptchaPage() {
  if (captchaGuidanceShown) {
    return;
  }

  captchaGuidanceShown = true;
  const captchaInput = findCaptchaInputField();
  const captchaVisual = findCaptchaVisualElement();
  const nextBtn = findNextButton();

  setPanelStatusText('验证码步骤：请手动输入验证码并点击 Next/Submit');
  showTopGuidance('🔐 已进入验证码步骤：先输入验证码，再手动点击 Next/Submit', {
    persistent: true,
    force: true
  });

  if (captchaVisual) {
    showNotification('验证码看不清可点击图片刷新，输入后手动提交', 'info');
  } else {
    showNotification('请手动输入验证码，确认无误后点击 Next/Submit', 'info');
  }

  if (captchaInput && captchaInput.offsetParent !== null) {
    captchaInput.style.outline = '2px solid #ff9800';
    captchaInput.style.outlineOffset = '2px';
    captchaInput.dataset.vhCaptchaHighlight = 'true';
    captchaInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    captchaInput.focus?.();
  }

  if (nextBtn && !nextBtn.dataset.vhCaptchaGuidanceBound) {
    nextBtn.dataset.vhCaptchaGuidanceBound = 'true';
    nextBtn.addEventListener('click', () => {
      setPanelStatusText('验证码已提交，等待下一步...');
      showTopGuidance('⏳ 验证码已提交，正在进入下一步...', {
        persistent: true,
        force: true
      });
    });
  }
}

function handlePaymentPage() {
  const payBtn = findPayButton();

  if (!paymentGuidanceShown) {
    paymentGuidanceShown = true;
    setPanelStatusText('准备支付：请核对信息后手动点击 Pay');
    showTopGuidance('💳 准备支付：请核对信息后，手动点击 Pay 完成付款', {
      persistent: true,
      force: true
    });
    showNotification('支付前请再次核对姓名、护照号、日期与费用', 'info');
  }

  if (!payBtn) {
    return;
  }

  payBtn.classList.add('vh-apply-highlight');
  if (payBtn.offsetParent !== null) {
    payBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (!payBtn.dataset.vhPayGuidanceBound) {
    payBtn.dataset.vhPayGuidanceBound = 'true';
    payBtn.addEventListener('click', () => {
      setPanelStatusText('支付已发起，请按页面提示完成付款验证');
      showTopGuidance('✅ 已发起支付，请按页面提示完成后续验证', {
        persistent: true,
        force: true
      });
      showNotification('已点击 Pay，请在官方页面完成后续支付验证', 'success');
    });
  }
}

function showUploadSetupGuidance() {
  setPanelStatusText('缺少照片和护照页');
  if (uploadGuidanceShown) return;
  uploadGuidanceShown = true;
  showTopGuidance('📎 请点面板里的“上传照片”，或直接在页面手动选图一次，插件会自动记住', { persistent: true });
  showNotification('未找到本地照片，请先上传“申请人正面照片”和“护照资料页”', 'info');
}

async function openUploadPanel() {
  const uploadPageUrl = chrome.runtime.getURL('popup.html?mode=upload');

  try {
    const response = await sendRuntimeMessage({ action: 'openUploadPanel' });
    if (response?.success) {
      return true;
    }
  } catch (error) {
    console.warn('⚠️ 通过后台打开上传页失败，改用前台窗口打开:', error.message);
  }

  window.open(uploadPageUrl, '_blank', 'noopener,noreferrer');
  return true;
}

async function persistUploadDocumentFromPageFile(fieldInfo, file) {
  if (!fieldInfo?.key || !file) {
    throw new Error('missing_upload_file');
  }

  const response = await sendRuntimeMessage({
    action: 'saveUploadDocumentDataUrl',
    key: fieldInfo.key,
    payload: {
      file_name: file.name,
      mime_type: file.type,
      last_modified: file.lastModified,
      data_url: await readFileAsDataUrl(file)
    }
  });

  if (!response?.success) {
    throw new Error(response?.error || 'save_upload_document_data_url_failed');
  }

  uploadDocumentsCache = response.documents || uploadDocumentsCache || {};
  if (userData) {
    userData.documents = {
      ...(userData.documents || {}),
      [fieldInfo.key]: uploadDocumentsCache[fieldInfo.key]
    };
  }

  return uploadDocumentsCache[fieldInfo.key];
}

function bindUploadPersistence(input, fieldInfo) {
  if (!input || !fieldInfo?.key || !UPLOAD_FIELD_KEYS.has(fieldInfo.key)) return;
  if (input.dataset.vhUploadPersistenceBound === 'true') return;

  input.dataset.vhUploadPersistenceBound = 'true';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;

    console.log(`📎 检测到页面手动上传: ${fieldInfo.label_cn} = ${file.name}`);
    setPanelStatusText(`正在保存 ${fieldInfo.label_cn}`);

    try {
      const savedPayload = await persistUploadDocumentFromPageFile(fieldInfo, file);
      const savedName = savedPayload?.file_name || file.name;
      console.log(`✅ 已记住上传文件: ${fieldInfo.label_cn} -> ${savedName}`);
      setPanelStatusText(`已记住 ${fieldInfo.label_cn}`);
      showNotification(`已记住${fieldInfo.label_cn}，下次可自动上传`, 'success');
    } catch (error) {
      console.warn(`⚠️ 保存 ${fieldInfo.label_cn} 到本地失败: ${error.message}`);
      setPanelStatusText(`保存 ${fieldInfo.label_cn} 失败`);
      showNotification(`保存${fieldInfo.label_cn}失败`, 'error');
    }
  });
}

function normalizeSelectText(text) {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .trim();
}

function isAntManagedFieldElement(element) {
  if (!element) return false;
  return !!(
    element.closest('.ant-select') ||
    element.closest('.ant-picker') ||
    element.matches('.ant-select-selection-search-input') ||
    element.getAttribute?.('role') === 'combobox'
  );
}

function getMeaningfulSelectTokens(text) {
  const ignored = new Set([
    'international',
    'airport',
    'land',
    'border',
    'gate',
    'city',
    'province',
    'option',
    'select',
    'choose',
    'valid',
    'time',
    'times',
    'entry',
    'exit',
    'port'
  ]);
  
  return normalizeSelectText(text)
    .split(' ')
    .filter(token => token && !ignored.has(token) && token.length > 1);
}

function getAntSelectDisplayText(selectContainer) {
  const displayNodes = [
    selectContainer.querySelector('.ant-select-selection-item'),
    selectContainer.querySelector('.ant-select-selection-overflow'),
    selectContainer.querySelector('.ant-select-selection-placeholder'),
    selectContainer.querySelector('.ant-select-selection-search-input'),
    selectContainer.querySelector('.ant-select-selection-search')
  ].filter(Boolean);
  
  for (const node of displayNodes) {
    const text = (node.textContent || node.value || node.getAttribute?.('title') || '').trim();
    if (text) return text;
  }
  
  return '';
}

function setNativeInputValue(input, value) {
  if (!input) return;
  
  const descriptor =
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value') ||
    Object.getOwnPropertyDescriptor(window.HTMLInputElement?.prototype || {}, 'value');
  
  if (descriptor?.set) {
    descriptor.set.call(input, value);
  } else {
    input.value = value;
  }
}

function normalizeStandardComparableValue(value) {
  return (value ?? '').toString().replace(/\s+/g, ' ').trim();
}

function normalizeStandardExpectedValue(value, input, fieldInfo = null) {
  const rawValue = normalizeStandardComparableValue(value);
  if (!rawValue) return '';

  if (input?.type === 'date') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) return rawValue;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawValue)) {
      const [dd, mm, yyyy] = rawValue.split('/');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  if (DATE_FIELD_KEYS.has(fieldInfo?.key)) {
    return normalizeDateFormat(rawValue);
  }

  return rawValue;
}

function getStandardInputCurrentValue(input, fieldInfo = null) {
  if (!input) return '';

  const currentValue = normalizeStandardComparableValue(input.value);
  if (!currentValue) return '';

  if (input.type === 'date') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(currentValue)) return currentValue;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(currentValue)) {
      const [dd, mm, yyyy] = currentValue.split('/');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  if (DATE_FIELD_KEYS.has(fieldInfo?.key) && /\d/.test(currentValue)) {
    return normalizeDateFormat(currentValue);
  }

  return currentValue;
}

function isStandardInputValueApplied(input, value, fieldInfo = null) {
  const currentValue = getStandardInputCurrentValue(input, fieldInfo);
  const expectedValue = normalizeStandardExpectedValue(value, input, fieldInfo);
  return !!expectedValue && currentValue === expectedValue;
}

function getKeyboardCodeForChar(char) {
  if (char === ' ') return 'Space';
  if (char === '/') return 'Slash';
  if (char === '-') return 'Minus';
  if (/^\d$/.test(char)) return `Digit${char}`;
  if (/^[a-z]$/i.test(char)) return `Key${char.toUpperCase()}`;
  return '';
}

function dispatchStandardInputEvent(input, value = '', inputType = 'insertText') {
  try {
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: value,
      inputType
    }));
  } catch (error) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function dispatchStandardBeforeInputEvent(input, value = '', inputType = 'insertText') {
  try {
    input.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      data: value,
      inputType
    }));
  } catch (error) {
    // Ignore unsupported beforeinput environments.
  }
}

async function typeTextIntoStandardInput(input, text) {
  input.focus?.();
  input.select?.();
  setNativeInputValue(input, '');
  dispatchStandardInputEvent(input, '', 'deleteContentBackward');
  await sleep(20);

  for (const char of text) {
    const currentValue = input.value || '';
    const code = getKeyboardCodeForChar(char);

    input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      key: char,
      code
    }));

    dispatchStandardBeforeInputEvent(input, char, 'insertText');
    setNativeInputValue(input, `${currentValue}${char}`);
    dispatchStandardInputEvent(input, char, 'insertText');

    input.dispatchEvent(new KeyboardEvent('keyup', {
      bubbles: true,
      key: char,
      code
    }));

    await sleep(12);
  }
}

async function commitStandardInputValue(input) {
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true,
    key: 'Tab',
    code: 'Tab',
    keyCode: 9,
    which: 9
  }));
  input.dispatchEvent(new KeyboardEvent('keyup', {
    bubbles: true,
    key: 'Tab',
    code: 'Tab',
    keyCode: 9,
    which: 9
  }));
  input.blur?.();
  input.dispatchEvent(new Event('blur', { bubbles: true }));
  await sleep(60);
}

async function fillStandardInputSmart(input, value, fieldInfo) {
  const expectedValue = normalizeStandardExpectedValue(value, input, fieldInfo);
  if (!expectedValue) return false;

  if (isStandardInputValueApplied(input, expectedValue, fieldInfo)) {
    return true;
  }

  if (input.readOnly) input.removeAttribute('readonly');
  if (input.disabled) input.removeAttribute('disabled');

  input.focus?.();
  input.select?.();
  await sleep(20);

  if (input.type === 'date') {
    setNativeInputValue(input, expectedValue);
    dispatchStandardInputEvent(input, expectedValue, 'insertReplacementText');
    await commitStandardInputValue(input);
    return !!(await waitFor(() => isStandardInputValueApplied(input, expectedValue, fieldInfo), 800, 50));
  }

  setNativeInputValue(input, expectedValue);
  dispatchStandardInputEvent(input, expectedValue, 'insertReplacementText');
  await commitStandardInputValue(input);

  let confirmed = await waitFor(() => isStandardInputValueApplied(input, expectedValue, fieldInfo), 900, 50);
  if (confirmed) return true;

  console.warn(`    ⚠️ 普通输入框未确认，尝试逐字符输入回退: ${fieldInfo?.label_cn || fieldInfo?.key}`);
  await typeTextIntoStandardInput(input, expectedValue);
  await commitStandardInputValue(input);

  confirmed = await waitFor(() => isStandardInputValueApplied(input, expectedValue, fieldInfo), 1200, 50);
  return !!confirmed;
}

function guessMimeTypeFromFileName(fileName = '') {
  const lower = (fileName || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  return 'application/octet-stream';
}

function getDefaultUploadFileName(fieldKey, mimeType = '') {
  const normalizedMime = (mimeType || '').toLowerCase();
  let extension = '.bin';
  if (normalizedMime.includes('png')) extension = '.png';
  if (normalizedMime.includes('jpeg') || normalizedMime.includes('jpg')) extension = '.jpg';
  if (normalizedMime.includes('webp')) extension = '.webp';

  if (fieldKey === 'passport_photo') return `portrait-photo${extension}`;
  if (fieldKey === 'passport_copy') return `passport-copy${extension}`;
  return `upload${extension}`;
}

function decodeBase64ToUint8Array(base64) {
  const cleaned = (base64 || '').replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function dataUrlToBlob(dataUrl) {
  const match = (dataUrl || '').match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/);
  if (!match) {
    throw new Error('无效的 data URL');
  }

  const mimeType = match[1] || 'application/octet-stream';
  const isBase64 = !!match[2];
  const payload = match[3] || '';
  const bytes = isBase64
    ? decodeBase64ToUint8Array(payload)
    : new TextEncoder().encode(decodeURIComponent(payload));

  return new Blob([bytes], { type: mimeType });
}

function base64ToBlob(base64, mimeType = 'application/octet-stream') {
  return new Blob([decodeBase64ToUint8Array(base64)], { type: mimeType });
}

async function resolveUploadFile(uploadValue, fieldInfo) {
  if (!uploadValue) return null;

  let payload = uploadValue;
  const rawString = typeof uploadValue === 'string' ? uploadValue.trim() : '';

  if (rawString) {
    if (rawString.startsWith('data:')) {
      payload = { data_url: rawString };
    } else if (/^(https?:|blob:|chrome-extension:)/i.test(rawString)) {
      payload = { url: rawString };
    } else if (/^[A-Za-z0-9+/=\s]+$/.test(rawString) && rawString.length > 128) {
      payload = { base64: rawString };
    }
  }

  const dataUrl = payload?.data_url || payload?.dataUrl || null;
  const base64 = payload?.base64 || payload?.base64_data || payload?.base64Data || null;
  const sourceUrl = payload?.url || payload?.file_url || payload?.fileUrl || null;

  let blob = null;
  let mimeType = payload?.mime_type || payload?.mimeType || '';

  if (dataUrl) {
    blob = dataUrlToBlob(dataUrl);
    mimeType = mimeType || blob.type;
  } else if (base64) {
    mimeType = mimeType || guessMimeTypeFromFileName(payload?.file_name || payload?.fileName || payload?.name || '');
    blob = base64ToBlob(base64, mimeType);
  } else if (sourceUrl) {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`获取文件失败: ${response.status}`);
    }
    blob = await response.blob();
    mimeType = mimeType || blob.type;
  }

  if (!blob) return null;

  const fileName =
    payload?.file_name ||
    payload?.fileName ||
    payload?.name ||
    getDefaultUploadFileName(fieldInfo?.key, mimeType || blob.type);

  return new File([blob], fileName, {
    type: mimeType || blob.type || guessMimeTypeFromFileName(fileName),
    lastModified: payload?.last_modified || payload?.lastModified || Date.now()
  });
}

function dispatchUploadEvents(input) {
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  input.dispatchEvent(new Event('focusout', { bubbles: true }));
}

function assignFileToInput(input, file) {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  input.files = dataTransfer.files;
  dispatchUploadEvents(input);
}

async function confirmFileUploadApplied(input, file, timeoutMs = 2500) {
  return !!await waitFor(() => {
    const currentFile = input.files?.[0];
    if (currentFile && currentFile.name === file.name && currentFile.size === file.size) {
      return true;
    }

    const wrapperText = input.closest('.ant-upload-wrapper, .ant-upload, .ant-upload-select, .ant-upload-btn')?.textContent || '';
    return wrapperText.includes(file.name);
  }, timeoutMs, 80);
}

async function fillFileInputSmart(input, uploadValue, fieldInfo) {
  try {
    console.log(`  → 尝试上传文件: ${fieldInfo?.label_cn || fieldInfo?.key}`);
    const file = await resolveUploadFile(uploadValue, fieldInfo);

    if (!file) {
      console.warn(`    ⚠️ 没有可用的文件数据`);
      return false;
    }

    assignFileToInput(input, file);

    const wrapper = input.closest('.ant-upload-wrapper, .ant-upload, .ant-upload-select, .ant-upload-btn');
    wrapper?.dispatchEvent(new Event('change', { bubbles: true }));

    const confirmed = await confirmFileUploadApplied(input, file);
    if (!confirmed) {
      console.warn(`    ⚠️ 文件设置后未确认生效`);
      return false;
    }

    input.closest('.ant-upload-wrapper, .ant-upload, .ant-upload-select, .ant-upload-btn')?.classList.add('vh-filled');
    const sizeInKb = Math.max(1, Math.round(file.size / 1024));
    console.log(`    ✅ 已设置文件: ${file.name} (${sizeInKb} KB)`);
    return true;
  } catch (error) {
    console.warn(`    ❌ 文件上传失败: ${error.message}`);
    return false;
  }
}

function normalizeComparableDateText(dateStr) {
  const normalized = normalizeDateFormat(dateStr || '');
  return normalized.replace(/[^0-9]/g, '');
}

function getAntPickerInput(picker) {
  if (!picker) return null;
  const candidates = [
    picker.querySelector('.ant-picker-input input'),
    picker.querySelector('input[type="text"]'),
    picker.querySelector('input')
  ];
  
  return candidates.find(candidate => candidate instanceof HTMLInputElement) || null;
}

function getAntPickerDisplayText(picker) {
  const input = getAntPickerInput(picker);
  if (!input) return '';
  return (input.value || input.getAttribute('value') || '').trim();
}

function isActuallyVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return !element.hidden && style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
}

function getVisibleAntPickerPanels() {
  return Array.from(document.querySelectorAll('.ant-picker-dropdown, .ant-picker-popup, .ant-picker-panel-container'))
    .filter(panel => isActuallyVisible(panel));
}

function isAntPickerValueApplied(picker, expectedText) {
  const current = normalizeComparableDateText(getAntPickerDisplayText(picker));
  const expected = normalizeComparableDateText(expectedText);
  
  if (!current || !expected) return false;
  return current === expected;
}

async function typeDateIntoAntPickerInput(input, text) {
  input.focus?.();
  input.select?.();
  setNativeInputValue(input, '');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(40);
  
  for (const char of text) {
    const currentValue = input.value || '';
    const code = char === '/' ? 'Slash' : /^\d$/.test(char) ? `Digit${char}` : '';
    
    input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      key: char,
      code
    }));
    
    try {
      input.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        data: char,
        inputType: 'insertText'
      }));
    } catch (e) {
      // Ignore unsupported InputEvent environments.
    }
    
    setNativeInputValue(input, `${currentValue}${char}`);
    
    try {
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        data: char,
        inputType: 'insertText'
      }));
    } catch (e) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    input.dispatchEvent(new KeyboardEvent('keyup', {
      bubbles: true,
      key: char,
      code
    }));
    
    await sleep(25);
  }
}

async function commitAntPickerValue(input) {
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true,
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13
  }));
  input.dispatchEvent(new KeyboardEvent('keyup', {
    bubbles: true,
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13
  }));
  
  await sleep(80);
  
  const okButton = getVisibleAntPickerPanels()
    .flatMap(panel => Array.from(panel.querySelectorAll('.ant-picker-ok button, .ant-picker-ok')))
    .find(button => isActuallyVisible(button));
  
  if (okButton) {
    dispatchRealClick(okButton);
    await sleep(120);
  }
  
  input.blur?.();
  input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
}

async function confirmAntPickerChange(picker, expectedText, timeoutMs = 2200) {
  return !!await waitFor(() => {
    const input = getAntPickerInput(picker);
    if (!input) return false;
    if (document.activeElement === input) return false;
    return isAntPickerValueApplied(picker, expectedText);
  }, timeoutMs, 80);
}

function addSelectAliases(targetSet, values) {
  values
    .filter(Boolean)
    .forEach(value => targetSet.add(value));
}

function matchesAnySelectPattern(normalizedValue, patterns) {
  return patterns.some(pattern => normalizedValue.includes(pattern));
}

function addFieldSpecificSelectAliases(aliases, rawValue, fieldInfo) {
  const normalized = normalizeSelectText(rawValue);
  const key = fieldInfo?.key;
  if (!normalized || !key) return;

  if (key === 'purpose') {
    if (matchesAnySelectPattern(normalized, ['tourism', 'tourist', 'travel', 'holiday', 'vacation', '旅游'])) {
      addSelectAliases(aliases, ['Tourist', 'tourist', 'Tourism', 'tourism']);
    }
    if (matchesAnySelectPattern(normalized, ['visit', 'relative', 'family', 'thăm thân', '探亲'])) {
      addSelectAliases(aliases, ['Visiting relatives', 'visiting relatives', 'visit relatives']);
    }
    if (matchesAnySelectPattern(normalized, ['work', 'working', 'job', 'labor', 'lao dong', '工作'])) {
      addSelectAliases(aliases, ['Working', 'working', 'work']);
    }
    if (matchesAnySelectPattern(normalized, ['business', '商务', 'trade', 'company'])) {
      addSelectAliases(aliases, ['Business', 'business']);
    }
    if (matchesAnySelectPattern(normalized, ['other', 'others', 'medical', 'study', 'official', 'transit'])) {
      addSelectAliases(aliases, ['Other', 'other', 'others']);
    }
  }

  if (key === 'occupation') {
    if (matchesAnySelectPattern(normalized, ['business owner', 'businessowner', 'entrepreneur', 'merchant', 'businessman', 'company owner', '企业主'])) {
      addSelectAliases(aliases, ['Businessman', 'businessman', 'business']);
    } else if (matchesAnySelectPattern(normalized, ['student', 'pupil', 'undergraduate', 'graduate', 'researcher', '学生'])) {
      addSelectAliases(aliases, ['Student', 'student']);
    } else if (matchesAnySelectPattern(normalized, ['official', 'government', 'civil servant', 'public servant', '公务'])) {
      addSelectAliases(aliases, ['Official', 'official']);
    } else if (matchesAnySelectPattern(normalized, ['retired', 'pensioner', '退休'])) {
      addSelectAliases(aliases, ['Retired', 'retired']);
    } else if (matchesAnySelectPattern(normalized, ['unemployed', 'jobless', '失业'])) {
      addSelectAliases(aliases, ['Unemployed', 'unemployed']);
    } else if (matchesAnySelectPattern(normalized, [
      'engineer', 'developer', 'teacher', 'doctor', 'nurse', 'lawyer', 'accountant',
      'manager', 'staff', 'employee', 'worker', 'consultant', 'designer', 'sales',
      'software', 'professor', 'lecturer', 'architect', '工程师', '教师', '医生'
    ])) {
      addSelectAliases(aliases, ['Employee', 'employee', 'staff']);
    } else if (matchesAnySelectPattern(normalized, ['other', 'others'])) {
      addSelectAliases(aliases, ['Others', 'Other', 'others', 'other']);
    }
  }

  if (key === 'expense_coverage') {
    if (matchesAnySelectPattern(normalized, [
      'myself', 'self', 'personal', 'family', 'parent', 'spouse', 'relative',
      'friend', '本人', '自己', '家人'
    ])) {
      addSelectAliases(aliases, ['Personal', 'personal', 'myself', 'self']);
    }
    if (matchesAnySelectPattern(normalized, [
      'company', 'employer', 'organization', 'business', 'corporate', 'agency',
      'sponsor', '单位', '公司', '雇主'
    ])) {
      addSelectAliases(aliases, ['Company', 'company', 'employer']);
    }
  }

  if (key === 'payment_method') {
    if (matchesAnySelectPattern(normalized, ['cash', '现款', '现金'])) {
      addSelectAliases(aliases, ['Cash', 'cash']);
    }
    if (matchesAnySelectPattern(normalized, [
      'credit card', 'creditcard', 'debit card', 'card', 'visa', 'mastercard', 'master card',
      'amex', 'jcb', 'unionpay', '信用卡', '银行卡'
    ])) {
      addSelectAliases(aliases, ['Credit card', 'credit card', 'credit_card']);
    }
    if (matchesAnySelectPattern(normalized, [
      'traveller cheques', 'traveller cheque', 'traveller_cheques',
      'traveler cheques', 'traveler cheque', 'travel cheque', 'travel cheques', '旅行支票'
    ])) {
      addSelectAliases(aliases, ['Traveller cheques', 'traveller cheques', 'traveller_cheques']);
    }
  }

  if (key === 'visa_type') {
    if (matchesAnySelectPattern(normalized, ['single', 'one entry', 'one time', '单次'])) {
      addSelectAliases(aliases, ['Single entry', 'Single-entry', 'single entry', 'single-entry']);
    }
    if (matchesAnySelectPattern(normalized, ['multiple', 'multi', '多次'])) {
      addSelectAliases(aliases, ['Multiple entry', 'Multiple-entry', 'multiple entry', 'multiple-entry']);
    }
  }
}

function getAntSelectAliases(rawValue, fieldInfo) {
  const canonical = rawValue?.toString().trim() || '';
  const aliases = new Set([canonical]);
  const normalized = normalizeSelectText(canonical);
  
  const builtInAliases = {
    male: ['m', 'male', 'man', '男', '男性'],
    female: ['f', 'female', 'woman', '女', '女性'],
    china: ['china', 'chinese', '中国', '中华人民共和国', 'people republic of china', "people s republic of china", 'peoples republic of china', 'pr china', 'prc'],
    hanoi: ['hanoi', 'ha noi', '河内'],
    ordinary: ['ordinary', 'ordinary passport', '普通', '普通护照'],
    single: ['single', 'single entry', 'single-entry', 'one entry', 'one time', 'one-time', 'single visa', '单次', '单次入境'],
    multiple: ['multiple', 'multiple entry', 'multiple-entry', 'multi entry', 'multi-entry', '多次', '多次入境'],
    cash: ['cash', '现款', '现金'],
    'credit card': ['credit card', 'credit_card', 'card', 'visa card', 'mastercard', 'master card', '信用卡'],
    'traveller cheques': ['traveller cheques', 'traveller cheque', 'traveller_cheques', 'traveler cheques', 'traveler cheque', '旅行支票'],
    no: ['no', '否', 'not', 'none'],
    yes: ['yes', '是', 'agree'],
    myself: ['myself', 'self', 'self-funded', 'self sponsored', 'self-sponsored', 'by myself', '本人', '自己'],
    engineer: ['engineer', 'engineering', '工程师'],
    'ba dinh district hanoi': ['ba dinh district hanoi', 'ba dinh district', 'ba dinh', '巴亭']
  };
  
  if (builtInAliases[normalized]) {
    builtInAliases[normalized].forEach(alias => aliases.add(alias));
  }
  addFieldSpecificSelectAliases(aliases, canonical, fieldInfo);
  
  if (fieldInfo?.options && typeof fieldInfo.options === 'object') {
    Object.entries(fieldInfo.options).forEach(([optionValue, optionLabel]) => {
      if (normalizeSelectText(optionValue) === normalized) {
        aliases.add(optionValue);
        if (typeof optionLabel === 'string') aliases.add(optionLabel);
      }
    });
  }
  
  return Array.from(aliases).filter(Boolean);
}

function extractPreferredOptionSearchLabel(optionLabel, optionValue = '') {
  const label = optionLabel?.toString().trim() || '';
  const fallback = optionValue?.toString().trim() || '';

  if (!label) return fallback;

  const bracketMatch = label.match(/\(([^)]+)\)/);
  if (bracketMatch?.[1]) {
    return bracketMatch[1].trim();
  }

  if (/^[A-Za-z0-9 .,'/-]+$/.test(label)) {
    return label;
  }

  const asciiPart = label.replace(/[^A-Za-z0-9 .,'/-]/g, ' ').replace(/\s+/g, ' ').trim();
  return asciiPart || fallback || label;
}

function getPreferredAntSelectSearchTerm(rawValue, fieldInfo) {
  const canonical = rawValue?.toString().trim() || '';
  const normalized = normalizeSelectText(canonical);
  const key = fieldInfo?.key;

  if (!canonical) return '';

  if (key === 'province_city' && normalized === 'hanoi') {
    return 'ha noi';
  }

  if (key === 'nationality' && normalized === 'china') {
    return 'Chin';
  }

  if ((key === 'intended_border_gate_of_entry' || key === 'intended_border_gate_of_exit') && normalized.includes('noi bai')) {
    return 'Noi Bai';
  }

  if (fieldInfo?.options && typeof fieldInfo.options === 'object') {
    for (const [optionValue, optionLabel] of Object.entries(fieldInfo.options)) {
      if (normalizeSelectText(optionValue) === normalized) {
        const preferredFromOptions = extractPreferredOptionSearchLabel(optionLabel, optionValue);
        if (preferredFromOptions) return preferredFromOptions;
      }
    }
  }

  if (key === 'purpose') {
    if (matchesAnySelectPattern(normalized, ['tourism', 'tourist', 'travel', 'holiday', 'vacation', '旅游'])) return 'Tourist';
    if (matchesAnySelectPattern(normalized, ['visit', 'relative', 'family', 'thăm thân', '探亲'])) return 'Visiting relatives';
    if (matchesAnySelectPattern(normalized, ['work', 'working', 'job', 'labor', 'lao dong', '工作'])) return 'Working';
    if (matchesAnySelectPattern(normalized, ['business', '商务', 'trade', 'company'])) return 'Business';
    if (matchesAnySelectPattern(normalized, ['other', 'others', 'medical', 'study', 'official', 'transit'])) return 'Other';
  }

  if (key === 'occupation') {
    if (matchesAnySelectPattern(normalized, ['business owner', 'businessowner', 'entrepreneur', 'merchant', 'businessman', 'company owner', '企业主'])) return 'Businessman';
    if (matchesAnySelectPattern(normalized, ['student', 'pupil', 'undergraduate', 'graduate', 'researcher', '学生'])) return 'Student';
    if (matchesAnySelectPattern(normalized, ['official', 'government', 'civil servant', 'public servant', '公务'])) return 'Official';
    if (matchesAnySelectPattern(normalized, ['retired', 'pensioner', '退休'])) return 'Retired';
    if (matchesAnySelectPattern(normalized, ['unemployed', 'jobless', '失业'])) return 'Unemployed';
    if (matchesAnySelectPattern(normalized, [
      'engineer', 'developer', 'teacher', 'doctor', 'nurse', 'lawyer', 'accountant',
      'manager', 'staff', 'employee', 'worker', 'consultant', 'designer', 'sales',
      'software', 'professor', 'lecturer', 'architect', '工程师', '教师', '医生'
    ])) return 'Employee';
    if (matchesAnySelectPattern(normalized, ['other', 'others'])) return 'Others';
  }

  if (key === 'expense_coverage') {
    if (matchesAnySelectPattern(normalized, [
      'myself', 'self', 'personal', 'family', 'parent', 'spouse', 'relative',
      'friend', '本人', '自己', '家人'
    ])) return 'Personal';
    if (matchesAnySelectPattern(normalized, [
      'company', 'employer', 'organization', 'business', 'corporate', 'agency',
      'sponsor', '单位', '公司', '雇主'
    ])) return 'Company';
  }

  if (key === 'payment_method') {
    if (matchesAnySelectPattern(normalized, ['cash', '现款', '现金'])) return 'Cash';
    if (matchesAnySelectPattern(normalized, [
      'credit card', 'creditcard', 'debit card', 'card', 'visa', 'mastercard', 'master card',
      'amex', 'jcb', 'unionpay', '信用卡', '银行卡'
    ])) return 'Credit card';
    if (matchesAnySelectPattern(normalized, [
      'traveller cheques', 'traveller cheque', 'traveller_cheques',
      'traveler cheques', 'traveler cheque', 'travel cheque', 'travel cheques', '旅行支票'
    ])) return 'Traveller cheques';
  }

  if (key === 'passport_type') {
    if (matchesAnySelectPattern(normalized, ['ordinary', '普通'])) return 'Ordinary Passport';
    if (matchesAnySelectPattern(normalized, ['official', '公务'])) return 'Official Passport';
    if (matchesAnySelectPattern(normalized, ['diplomatic', '外交'])) return 'Diplomatic Passport';
  }

  if (key === 'bought_insurance') {
    if (matchesAnySelectPattern(normalized, ['yes', '是'])) return 'Yes';
    if (matchesAnySelectPattern(normalized, ['no', '否'])) return 'No';
  }

  return canonical;
}

function extractSelectSearchTerms(value) {
  const raw = value?.toString().trim();
  if (!raw) return [];
  
  const terms = new Set([raw]);
  const bracketMatches = raw.match(/\(([^)]+)\)/g) || [];
  bracketMatches.forEach(match => {
    const inner = match.slice(1, -1).trim();
    if (inner) terms.add(inner);
  });
  
  raw.split(/[,/|]/).forEach(part => {
    const trimmed = part.trim();
    if (trimmed) terms.add(trimmed);
  });
  
  const asciiPart = raw.replace(/[^A-Za-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (asciiPart) terms.add(asciiPart);
  
  return Array.from(terms).filter(Boolean);
}

function getAntSelectSearchTerms(rawValue, fieldInfo, aliases) {
  const normalizedRaw = normalizeSelectText(rawValue);
  const terms = new Map();
  
  const pushTerm = (term) => {
    const trimmed = term?.toString().trim();
    const normalized = normalizeSelectText(trimmed);
    if (!trimmed || !normalized || terms.has(normalized)) return;
    terms.set(normalized, trimmed);
  };
  
  pushTerm(rawValue);
  aliases.forEach(alias => {
    extractSelectSearchTerms(alias).forEach(pushTerm);
  });
  
  return Array.from(terms.values()).sort((a, b) => {
    const aNorm = normalizeSelectText(a);
    const bNorm = normalizeSelectText(b);
    const aStarts = aNorm.startsWith(normalizedRaw) || normalizedRaw.startsWith(aNorm);
    const bStarts = bNorm.startsWith(normalizedRaw) || normalizedRaw.startsWith(bNorm);
    if (aStarts !== bStarts) return aStarts ? -1 : 1;
    return b.length - a.length;
  });
}

function getSelectSearchFallbacks(term) {
  const clean = term?.toString().trim();
  if (!clean) return [];
  
  const variants = new Set([clean]);
  const withoutParentheses = clean.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (withoutParentheses) variants.add(withoutParentheses);
  
  const normalized = clean
    .replace(/\b(district|province|city|commune|ward|international|airport|border|gate|port|int)\b/gi, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized) variants.add(normalized);
  
  if (/^[A-Za-z]+$/.test(clean) && clean.length >= 5) {
    const spaced = clean.replace(/([a-z])([A-Z])/g, '$1 $2');
    if (spaced !== clean) variants.add(spaced);
  }
  
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length >= 2) {
    variants.add(tokens.slice(0, 2).join(' '));
  }
  if (tokens.length >= 1) {
    variants.add(tokens[0]);
  }
  
  return Array.from(variants).filter(Boolean);
}

function getVisibleAntSelectDropdowns(selectContainer, input) {
  const controls = [
    input?.getAttribute?.('aria-controls'),
    input?.getAttribute?.('aria-owns')
  ].filter(Boolean);
  const results = [];
  const seen = new Set();
  const addDropdown = (dropdown) => {
    if (!dropdown || seen.has(dropdown)) return;
    seen.add(dropdown);
    results.push(dropdown);
  };
  
  for (const controlId of controls) {
    const owned = document.getElementById(controlId);
    if (owned && owned.offsetParent !== null) {
      addDropdown(owned.closest('.ant-select-dropdown') || owned);
    }
  }
  
  const dropdowns = Array.from(document.querySelectorAll('.ant-select-dropdown')).filter(dropdown => {
    const style = window.getComputedStyle(dropdown);
    return style.display !== 'none' && style.visibility !== 'hidden' && !dropdown.classList.contains('ant-select-dropdown-hidden');
  });
  
  const selectRect = selectContainer.getBoundingClientRect();
  dropdowns
    .map(dropdown => {
      const rect = dropdown.getBoundingClientRect();
      const distance = Math.abs(rect.left - selectRect.left) + Math.abs(rect.top - selectRect.bottom);
      return { dropdown, distance };
    })
    .sort((a, b) => a.distance - b.distance)
    .forEach(({ dropdown }) => addDropdown(dropdown));
  
  return results;
}

function getVisibleAntSelectDropdown(selectContainer, input) {
  return getVisibleAntSelectDropdowns(selectContainer, input)[0] || null;
}

async function waitForAntSelectOptions(selectContainer, input, timeoutMs = 1400) {
  return waitFor(() => {
    const dropdowns = getVisibleAntSelectDropdowns(selectContainer, input);
    const options = dropdowns.flatMap(getSelectableAntOptions);
    if (options.length > 0) {
      return { dropdowns, options };
    }
    return null;
  }, timeoutMs, 80);
}

function getSelectableAntOptions(dropdown) {
  if (!dropdown) return [];
  
  return Array.from(
    dropdown.querySelectorAll('[role="option"], .ant-select-item-option')
  ).filter(option => {
    const style = window.getComputedStyle(option);
    const text = (option.textContent || '').trim();
    return (
      text &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      !option.classList.contains('ant-select-item-option-disabled') &&
      option.getAttribute('aria-disabled') !== 'true'
    );
  });
}

function scoreAntSelectOption(optionText, aliases) {
  const normalizedOption = normalizeSelectText(optionText);
  if (!normalizedOption) return -1;
  
  let bestScore = -1;
  
  aliases.forEach(alias => {
    const normalizedAlias = normalizeSelectText(alias);
    if (!normalizedAlias) return;
    
    if (normalizedOption === normalizedAlias) {
      bestScore = Math.max(bestScore, 100);
      return;
    }
    
    if (normalizedOption.startsWith(normalizedAlias) || normalizedAlias.startsWith(normalizedOption)) {
      bestScore = Math.max(bestScore, 90);
    }
    
    if (normalizedOption.includes(normalizedAlias) || normalizedAlias.includes(normalizedOption)) {
      bestScore = Math.max(bestScore, 82);
    }
    
    const optionWords = getMeaningfulSelectTokens(normalizedOption);
    const aliasWords = getMeaningfulSelectTokens(normalizedAlias);
    const overlap = aliasWords.filter(word => optionWords.includes(word)).length;
    if (aliasWords.length > 0 && overlap === aliasWords.length) {
      bestScore = Math.max(bestScore, 88);
    } else if (overlap >= 2) {
      bestScore = Math.max(bestScore, 68 + overlap * 6);
    } else if (overlap === 1 && aliasWords.length === 1) {
      bestScore = Math.max(bestScore, 72);
    }
  });
  
  return bestScore;
}

function findBestAntSelectOption(options, aliases) {
  let best = null;
  
  options.forEach(option => {
    const text = (option.getAttribute('title') || option.textContent || '').trim().replace(/\s+/g, ' ');
    const score = scoreAntSelectOption(text, aliases);
    if (!best || score > best.score) {
      best = { option, text, score };
    }
  });
  
  return best && best.score >= 75 ? best : null;
}

function getTopAntSelectCandidates(options, aliases, limit = 5) {
  return options
    .map(option => {
      const text = (option.getAttribute('title') || option.textContent || '').trim().replace(/\s+/g, ' ');
      return { text, score: scoreAntSelectOption(text, aliases) };
    })
    .filter(candidate => candidate.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function findBestAntSelectMatch(dropdowns, aliases) {
  let best = null;
  
  dropdowns.forEach(dropdown => {
    const options = getSelectableAntOptions(dropdown);
    const candidate = findBestAntSelectOption(options, aliases);
    if (candidate && (!best || candidate.score > best.score)) {
      best = { ...candidate, dropdown };
    }
  });
  
  return best;
}

function dispatchRealClick(target) {
  if (!target) return;
  
  ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(type => {
    const EventCtor = type.startsWith('pointer') ? window.PointerEvent || window.MouseEvent : window.MouseEvent;
    target.dispatchEvent(new EventCtor(type, { bubbles: true, cancelable: true, button: 0 }));
  });
  
  target.click?.();
}

async function openAntSelectDropdown(selectContainer, input) {
  const selector = selectContainer.querySelector('.ant-select-selector') || selectContainer;
  document.activeElement?.blur?.();
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await sleep(50);
  
  dispatchRealClick(selector);
  await sleep(80);
  
  if (input) {
    input.focus?.();
    input.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown', code: 'ArrowDown' }));
  }
  
  return waitFor(() => getVisibleAntSelectDropdown(selectContainer, input), 1800, 60);
}

async function searchAntSelectOptions(input, searchValue) {
  if (!input) return;
  
  input.focus?.();
  input.click?.();
  setNativeInputValue(input, '');
  input.dispatchEvent(new InputEvent('input', { bubbles: true, data: '', inputType: 'deleteContentBackward' }));
  await sleep(50);
  
  setNativeInputValue(input, searchValue);
  input.dispatchEvent(new InputEvent('input', { bubbles: true, data: searchValue, inputType: 'insertText' }));
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: searchValue.slice(-1) || 'a' }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function submitAntSelectWithKeyboard(input) {
  if (!input) return;
  
  input.focus?.();
  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown', code: 'ArrowDown' }));
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'ArrowDown', code: 'ArrowDown' }));
  await sleep(80);
  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
  await sleep(120);
  input.blur?.();
  input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
}

async function confirmAntSelectChange(selectContainer, input, bestMatch, aliases, beforeText, timeoutMs = 2500) {
  return waitFor(() => {
    if ([bestMatch.text, ...aliases].some(text => isAntSelectValueApplied(selectContainer, text))) return true;
    
    const currentText = normalizeSelectText(getAntSelectCurrentText(selectContainer));
    const dropdownStillOpen = !!getVisibleAntSelectDropdown(selectContainer, input);
    return !dropdownStillOpen && currentText && currentText !== normalizeSelectText(beforeText);
  }, timeoutMs, 60);
}

async function tryAntSelectTextSubmitFallback(selectContainer, input, rawValue, aliases, beforeText) {
  const retryTerms = new Set([
    rawValue,
    ...aliases,
    ...aliases.flatMap(alias => getSelectSearchFallbacks(alias))
  ]);
  
  for (const retryTerm of retryTerms) {
    const reopened = await openAntSelectDropdown(selectContainer, input);
    if (!reopened) continue;
    await searchAntSelectOptions(input, retryTerm);
    await sleep(450);
    await submitAntSelectWithKeyboard(input);
    const confirmed = await waitFor(() => {
      if ([rawValue, ...aliases].some(text => isAntSelectValueApplied(selectContainer, text))) return true;
      const currentText = normalizeSelectText(getAntSelectCurrentText(selectContainer));
      return currentText && currentText !== normalizeSelectText(beforeText);
    }, 1800, 60);
    if (confirmed) return true;
  }
  
  return false;
}

async function tryAntSelectFreeTextFallback(selectContainer, input, rawValue, beforeText, options = {}) {
  if (!input || !rawValue) return false;
  
  const shouldAttemptOpen = options.attemptOpen !== false;
  if (shouldAttemptOpen) {
    const reopened = await openAntSelectDropdown(selectContainer, input);
    if (!reopened) return false;
  }
  
  input.focus?.();
  input.click?.();
  setNativeInputValue(input, '');
  input.dispatchEvent(new InputEvent('input', { bubbles: true, data: '', inputType: 'deleteContentBackward' }));
  await sleep(50);
  await searchAntSelectOptions(input, rawValue);
  await sleep(150);
  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
  input.blur?.();
  input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  
  return waitFor(() => {
    const currentText = normalizeSelectText(getAntSelectCurrentText(selectContainer));
    const expected = normalizeSelectText(rawValue);
    const currentInputValue = normalizeSelectText(input.value);
    return (
      currentText.includes(expected) ||
      currentInputValue.includes(expected) ||
      (currentText && currentText !== normalizeSelectText(beforeText))
    );
  }, 1800, 60);
}

function getAntSelectCurrentText(selectContainer) {
  const pieces = [
    getAntSelectDisplayText(selectContainer),
    selectContainer.querySelector('.ant-select-selection-item')?.getAttribute?.('title') || '',
    selectContainer.querySelector('.ant-select-selection-overflow')?.textContent || '',
    selectContainer.querySelector('.ant-select-selection-search-input')?.value || '',
    selectContainer.querySelector('input[type="hidden"]')?.value || '',
    selectContainer.getAttribute('title') || ''
  ];
  
  return pieces.filter(Boolean).join(' ');
}

function isAntSelectValueApplied(selectContainer, expectedText) {
  const current = normalizeSelectText(getAntSelectCurrentText(selectContainer));
  const expected = normalizeSelectText(expectedText);
  
  if (!current || !expected) return false;
  return current === expected || current.includes(expected) || expected.includes(current);
}

// ===== 新方法：Ant Select 填充 - 等待真正选择成功后再返回 =====
async function fillAntSelectSmart(selectContainer, value, fieldInfo) {
  try {
    console.log(`  → 填充 Ant Select: ${fieldInfo?.label_cn || fieldInfo?.key} = ${value}`);
    
    const rawValue = value.toString().trim();
    const input = selectContainer.querySelector('.ant-select-selection-search-input, input[role="combobox"]');
    
    if (!input) {
      console.warn(`    ⚠️ 输入框未找到`);
      return false;
    }
    
    const aliases = getAntSelectAliases(rawValue, fieldInfo);
    const preferredSearchTerm = getPreferredAntSelectSearchTerm(rawValue, fieldInfo);
    const beforeText = getAntSelectDisplayText(selectContainer);
    const initialOptionWaitMs = fieldInfo?.key === 'passport_type' ? 2200 : 900;
    const searchOptionWaitMs = fieldInfo?.key === 'passport_type' ? 3200 : 1600;
    if (aliases.some(alias => isAntSelectValueApplied(selectContainer, alias))) {
      console.log(`    ℹ️ 当前值已匹配，无需重复选择`);
      return true;
    }
    
    const dropdown = await openAntSelectDropdown(selectContainer, input);
    if (!dropdown) {
      if (fieldInfo?.key === 'destiny_residential_address') {
        const freeTextSubmitted = await tryAntSelectFreeTextFallback(
          selectContainer,
          input,
          rawValue,
          beforeText,
          { attemptOpen: false }
        );
        if (freeTextSubmitted) {
          console.log(`    ✓ 地址字段已在无菜单模式下通过自由输入回退确认`);
          return true;
        }
      }
      console.warn(`    ⚠️ 菜单未打开`);
      return false;
    }

    if (fieldInfo?.key === 'destiny_residential_address') {
      const freeTextSubmitted = await tryAntSelectFreeTextFallback(
        selectContainer,
        input,
        rawValue,
        beforeText,
        { attemptOpen: false }
      );
      if (freeTextSubmitted) {
        console.log(`    ✓ 地址字段已通过自由输入快速回退确认`);
        return true;
      }
    }
    
    let optionsState = await waitForAntSelectOptions(selectContainer, input, initialOptionWaitMs);
    let dropdowns = optionsState?.dropdowns || getVisibleAntSelectDropdowns(selectContainer, input);
    let bestMatch = findBestAntSelectMatch(dropdowns, aliases);
    
    if (!bestMatch && input && preferredSearchTerm) {
      console.log(`    🔍 使用预设选项搜索 "${preferredSearchTerm}"`);
      await searchAntSelectOptions(input, preferredSearchTerm);
      optionsState = await waitForAntSelectOptions(selectContainer, input, searchOptionWaitMs);
      dropdowns = optionsState?.dropdowns || getVisibleAntSelectDropdowns(selectContainer, input);
      bestMatch = findBestAntSelectMatch(dropdowns, aliases);
    }

    if (!bestMatch && fieldInfo?.key === 'passport_type') {
      console.log('    🔄 护照类型选项仍未出现，额外等待接口返回...');
      optionsState = await waitForAntSelectOptions(selectContainer, input, 4000);
      dropdowns = optionsState?.dropdowns || getVisibleAntSelectDropdowns(selectContainer, input);
      bestMatch = findBestAntSelectMatch(dropdowns, aliases);
    }
    
    if (!bestMatch) {
      const fallbackOptions = dropdowns.flatMap(getSelectableAntOptions);
      const candidates = getTopAntSelectCandidates(fallbackOptions, aliases);
      if (candidates.length > 0) {
        console.warn(`    ℹ️ 候选分数: ${candidates.map(candidate => `"${candidate.text}"(${candidate.score})`).join(', ')}`);
      }
      if (fieldInfo?.key === 'destiny_residential_address') {
        const freeTextSubmitted = await tryAntSelectFreeTextFallback(selectContainer, input, rawValue, beforeText);
        if (freeTextSubmitted) {
          console.log(`    ✓ 地址字段已通过自由输入回退确认`);
          return true;
        }
      }
      const textSubmitted = await tryAntSelectTextSubmitFallback(selectContainer, input, rawValue, aliases, beforeText);
      if (textSubmitted) {
        console.log(`    ✓ Select 已通过文本提交回退确认`);
        return true;
      }
      console.warn(`    ⚠️ 没有找到与 "${rawValue}" 匹配的选项`);
      return false;
    }
    
    console.log(`    ✅ 匹配到选项: "${bestMatch.text}" (score=${bestMatch.score})`);
    bestMatch.option.scrollIntoView?.({ behavior: 'auto', block: 'nearest' });
    dispatchRealClick(bestMatch.option.querySelector('.ant-select-item-option-content') || bestMatch.option);
    input.blur?.();
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    
    let confirmed = await confirmAntSelectChange(selectContainer, input, bestMatch, aliases, beforeText);
    
    if (!confirmed) {
      console.warn(`    ⚠️ 点击后未确认，尝试键盘提交回退`);
      const retryTerms = new Set([preferredSearchTerm || bestMatch.text || rawValue]);
      
      for (const retryTerm of retryTerms) {
        const reopened = await openAntSelectDropdown(selectContainer, input);
        if (!reopened) continue;
        await searchAntSelectOptions(input, retryTerm);
        await sleep(250);
        await submitAntSelectWithKeyboard(input);
        confirmed = await confirmAntSelectChange(selectContainer, input, bestMatch, aliases, beforeText, 1800);
        if (confirmed) break;
      }
    }
    
    if (!confirmed) {
      console.warn(`    ⚠️ 选项点击后未确认生效`);
      return false;
    }
    
    console.log(`    ✓ Select 已确认: ${getAntSelectDisplayText(selectContainer) || bestMatch.text}`);
    return true;
    
  } catch (e) {
    console.warn(`  ❌ Select 异常:`, e.message);
    return false;
  }
}

// ===== 智能填充 Ant DatePicker - 等待真正提交后再返回 =====
async function fillAntPickerSmart(picker, value, fieldInfo) {
  try {
    console.log(`  → 尝试填充 Ant DatePicker: ${fieldInfo?.label_cn || fieldInfo?.key} = ${value}`);
    
    const normalizedDate = normalizeDateFormat(value);
    const input = getAntPickerInput(picker);
    
    if (!input) {
      console.warn(`    ⚠️ DatePicker 输入框未找到`);
      return false;
    }
    
    if (isAntPickerValueApplied(picker, normalizedDate)) {
      console.log(`    ℹ️ 当前日期已匹配，无需重复填写`);
      return true;
    }
    
    // Step 1: 移除 readonly 和禁用属性
    if (input.readOnly) input.removeAttribute('readonly');
    if (input.disabled) input.removeAttribute('disabled');
    
    // Step 2: 打开组件并逐字符输入实际 input
    dispatchRealClick(picker.querySelector('.ant-picker-input') || input);
    input.focus?.();
    await sleep(60);
    
    console.log(`    📝 逐字符输入日期: ${normalizedDate}`);
    await typeDateIntoAntPickerInput(input, normalizedDate);
    
    // Step 3: 提交并等待组件真正接受这个值
    await commitAntPickerValue(input);
    
    let confirmed = await confirmAntPickerChange(picker, normalizedDate);
    if (!confirmed) {
      console.warn(`    ⚠️ 日期输入后未确认，尝试直接赋值回退`);
      setNativeInputValue(input, normalizedDate);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await commitAntPickerValue(input);
      confirmed = await confirmAntPickerChange(picker, normalizedDate, 1800);
    }
    
    if (!confirmed) {
      console.warn(`    ⚠️ 日期填写后未确认生效`);
      return false;
    }
    
    console.log(`    ✅ 已输入日期: ${getAntPickerDisplayText(picker) || normalizedDate}`);
    return true;
  } catch (e) {
    console.warn(`  ❌ DatePicker 错误:`, e.message);
    return false;
  }
}

function fillAntDesignComponents() {
  console.log('🔍 尝试填充 Ant Design 组件...');
  
  // Find all Ant Design Select components
  const antSelects = document.querySelectorAll('.ant-select');
  antSelects.forEach((selectContainer, idx) => {
    const hiddenInput = selectContainer.querySelector('input[type="hidden"]');
    const displayInput = selectContainer.querySelector('input.ant-select-selection-search-input');
    const labelText = selectContainer.previousElementSibling?.textContent || 
                      selectContainer.parentElement?.textContent || '';
    
    if (!hiddenInput) return;
    
    // Try to identify the field
    const allText = `${labelText} ${selectContainer.className}`.toLowerCase();
    
    // Try to find a matching value
    for (const [key, fieldInfo] of Object.entries(fieldMappings)) {
      if (!allText.includes(key.replace(/_/g, ' '))) continue;
      
      const value = getValueFromUserData(key);
      if (!value) continue;
      
      // Click to open the select
      selectContainer.click();
      
      setTimeout(() => {
        const options = document.querySelectorAll('.ant-select-item');
        let found = false;
        
        options.forEach(opt => {
          const optText = opt.textContent.toLowerCase();
          const optValue = opt.getAttribute('data-value') || '';
          
          if (optText.includes(value.toString().toLowerCase()) ||
              optValue.toLowerCase() === value.toString().toLowerCase()) {
            opt.click();
            found = true;
            console.log(`✅ 填充 Ant Select: ${value}`);
          }
        });
        
        if (!found) {
          // Try to type in the input
          if (displayInput) {
            displayInput.value = value.toString();
            triggerEvents(displayInput);
          }
        }
      }, 100);
      
      return;
    }
  });
  
  // Handle Ant Design Date Pickers
  const datePickers = document.querySelectorAll('.ant-picker');
  datePickers.forEach((picker, idx) => {
    const label = picker.previousElementSibling?.textContent || '';
    const input = picker.querySelector('.ant-picker-input');
    
    if (!input) return;
    
    // Check if this is a date field
    if (!label.toLowerCase().includes('date') && !label.toLowerCase().includes('birth')) return;
    
    // Try to fill the date
    for (const key of Object.keys(fieldMappings)) {
      if (!label.toLowerCase().includes(key.replace(/_/g, ' '))) continue;
      
      const value = getValueFromUserData(key);
      if (!value) continue;
      
      const dateValue = normalizeDateFormat(value);
      
      // Click to open date picker
      input.click?.();
      
      setTimeout(() => {
        const dateInput = document.querySelector('.ant-picker-input, .ant-calendar-input');
        if (dateInput) {
          dateInput.value = dateValue;
          triggerEvents(dateInput);
        }
        
        // Confirm date
        const confirmBtn = document.querySelector('.ant-picker-ok');
        confirmBtn?.click();
      }, 150);
      
      return;
    }
  });
}

function triggerEvents(element) {
  if (!element) return;
  
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
  element.dispatchEvent(new Event('click', { bubbles: true }));
  
  // For Ant Design components
  element.dispatchEvent(new Event('mousedown', { bubbles: true }));
  element.dispatchEvent(new Event('focusin', { bubbles: true }));
  element.dispatchEvent(new Event('focusout', { bubbles: true }));
}

const USER_DATA_PATHS = {
  // Personal Information
  'full_name': 'personalInfo.full_name',
  'surname': 'personalInfo.surname',
  'given_name': 'personalInfo.given_name',
  'date_of_birth': 'personalInfo.date_of_birth',
  'gender': 'personalInfo.gender',
  'nationality': 'personalInfo.nationality',
  'religion': 'personalInfo.religion',
  'place_of_birth': 'personalInfo.place_of_birth',
  'identity_card': 'personalInfo.identity_card',
  'multiple_nationalities': 'personalInfo.multiple_nationalities',
  'violation_of_laws': 'personalInfo.violation_of_laws',

  // Passport Information
  'passport_number': 'personalInfo.passport_number',
  'passport_issue_authority': 'personalInfo.passport_issue_authority',
  'passport_type': 'personalInfo.passport_type',
  'passport_date_of_issue': 'personalInfo.passport_date_of_issue',
  'passport_expiry': 'personalInfo.passport_expiry',
  'other_passports': 'personalInfo.other_passports',

  // Contact Information
  'email': 'contactInfo.email',
  're_enter_email': 'contactInfo.email',
  'phone': 'contactInfo.phone',
  'phone_in_vietnam': 'contactInfo.phone_in_vietnam',
  'emergency_contact_name': 'contactInfo.emergency_contact_name',
  'emergency_contact_relationship': 'contactInfo.emergency_contact_relationship',
  'emergency_contact_phone': 'contactInfo.emergency_contact_phone',
  'emergency_contact_current_address': 'contactInfo.emergency_contact_current_address',

  // Occupation Information
  'occupation': 'occupationInfo.occupation',
  'occupation_info': 'occupationInfo.occupation_info',
  'company_name': 'occupationInfo.company_name',
  'position_course': 'occupationInfo.position_course',
  'company_address': 'occupationInfo.company_address',
  'company_phone': 'occupationInfo.company_phone',

  // Travel Information
  'purpose': 'travelInfo.purpose',
  'duration': 'travelInfo.duration',
  'intended_length_of_stay': 'travelInfo.duration',
  'arrival_date': 'travelInfo.arrival_date',
  'intended_date_of_entry': 'travelInfo.intended_date_of_entry',
  'departure_date': 'travelInfo.departure_date',
  'arrival_city': 'travelInfo.arrival_city',
  'destination_address': 'travelInfo.destination_address',
  'destiny_residential_address': 'travelInfo.destination_address',
  'residential_address_in_vietnam': 'travelInfo.destination_address',
  'contact_address': 'travelInfo.contact_address',
  'province_city': 'travelInfo.province_city',
  'ward_commune': 'travelInfo.ward_commune',

  // Visa Information
  'visa_type': 'visaInfo.visa_type',
  'visa_valid_from': 'visaInfo.visa_valid_from',
  'visa_valid_to': 'visaInfo.visa_valid_to',
  'intended_border_gate_of_entry': 'visaInfo.intended_border_gate_of_entry',
  'intended_border_gate_of_exit': 'visaInfo.intended_border_gate_of_exit',

  // Confirmations
  'temporary_residence_declaration': 'confirmations.temporary_residence_declaration',
  'agree_to_create_account': 'confirmations.agree_to_create_account',
  'legal_declaration': 'confirmations.legal_declaration',

  // Trip Expenses
  'intended_expenses': 'tripExpenses.intended_expenses',
  'bought_insurance': 'tripExpenses.bought_insurance',
  'expense_coverage': 'tripExpenses.expense_coverage',
  'payment_method': 'tripExpenses.payment_method',
  'insurance_form': 'tripExpenses.payment_method',
  'relatives_in_vietnam': 'tripExpenses.relatives_in_vietnam',

  // Upload Documents
  'passport_photo': 'documents.passport_photo',
  'passport_copy': 'documents.passport_copy'
};

function getValueFromUserData(key) {
  const path = USER_DATA_PATHS[key];
  if (!path) return undefined;
  
  let value = userData;
  for (const p of path.split('.')) {
    value = value?.[p];
  }

  if (value !== undefined) {
    return value;
  }

  if (key === 'passport_photo') {
    return uploadDocumentsCache?.passport_photo || userData?.documents?.passport_photo;
  }

  if (key === 'passport_copy') {
    return uploadDocumentsCache?.passport_copy || userData?.documents?.passport_copy;
  }

  return value;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function shouldPersistValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
}

function setValueInUserData(key, value, target) {
  const path = USER_DATA_PATHS[key];
  if (!path) return false;

  const segments = path.split('.');
  let node = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    if (!node[segment] || typeof node[segment] !== 'object') {
      node[segment] = {};
    }
    node = node[segment];
  }

  node[segments[segments.length - 1]] = value;
  return true;
}

function extractFieldValue(input) {
  if (!input) return undefined;

  if (input.tagName === 'SELECT') {
    const option = input.selectedOptions?.[0];
    const textValue = option?.textContent?.trim();
    return input.value || textValue || '';
  }

  if (input.type === 'checkbox') {
    return input.checked ? (input.value || 'on') : '';
  }

  if (input.type === 'radio') {
    return input.checked ? (input.value || 'on') : '';
  }

  const antSelect = input.closest?.('.ant-select');
  if (antSelect) {
    const selectedText = antSelect.querySelector('.ant-select-selection-item')?.textContent?.trim();
    if (selectedText) return selectedText;
  }

  const rawValue = input.value;
  return typeof rawValue === 'string' ? rawValue.trim() : rawValue;
}

function collectUserProfileFromForm() {
  const baseProfile = deepClone(userData || {});
  const inputs = document.querySelectorAll('input, select, textarea');

  inputs.forEach((input) => {
    if (input.type === 'file') return;
    const fieldInfo = identifyField(input);
    if (!fieldInfo?.key || fieldInfo.key === 'generic_date') return;
    if (UPLOAD_FIELD_KEYS.has(fieldInfo.key)) return;

    const value = extractFieldValue(input);
    if (!shouldPersistValue(value)) return;
    setValueInUserData(fieldInfo.key, value, baseProfile);
  });

  if (uploadDocumentsCache) {
    baseProfile.documents = {
      ...(baseProfile.documents || {}),
      ...uploadDocumentsCache
    };
  }

  return baseProfile;
}

async function saveUserProfileToSupabase() {
  if (!userData) {
    showNotification('没有可保存的数据', 'warn');
    return;
  }

  setPanelStatusText('正在保存到云端...');
  showNotification('正在保存到 Supabase...', 'info');

  try {
    const profile = collectUserProfileFromForm();
    const response = await sendRuntimeMessage({
      action: 'saveProfile',
      profile
    });

    if (response?.success) {
      userData = response.profile || profile;
      setPanelStatusText('已保存到云端');
      showNotification('已保存到 Supabase', 'success');
      return;
    }

    setPanelStatusText('保存失败');
    showNotification(`保存失败: ${response?.error || 'unknown'}`, 'error');
  } catch (error) {
    setPanelStatusText('保存失败');
    showNotification(`保存失败: ${error.message}`, 'error');
  }
}

// ===== DISCLAIMER PAGE HANDLER =====

function handleDisclaimerPage() {
  console.log('📋 处理Disclaimer页面 - 需要勾选两个复选框');
  showTopGuidance('📋 请勾选页面下方的两个复选框', { persistent: true });
  
  // Show guide with down arrow animation - USE FIXED POSITIONING TO ENSURE VISIBILITY
  const guide = document.createElement('div');
  guide.className = 'vh-disclaimer-guide';
  guide.innerHTML = `
    <div style="margin-bottom: 15px;">
      <strong style="font-size: 16px; display: block; margin-bottom: 10px; color: #03346e;">📋 操作步骤:</strong>
      <ol style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #3d3d3d;">
        <li>向下滚动阅读完整条款</li>
        <li>在下方找到两个复选框并勾选</li>
        <li>两个都勾选后，Next按钮会自动高亮</li>
        <li>点击Next继续申请</li>
      </ol>
    </div>
    <div style="text-align: center;">
      <div style="
        display: inline-block;
        animation: vh-bounce 2s infinite;
        color: #03346e;
        font-size: 28px;
        font-weight: bold;
      ">
        ⬇️
      </div>
      <div style="color: rgba(0, 0, 0, 0.52); font-size: 12px; margin-top: 6px;">
        向下滚动继续
      </div>
    </div>
  `;
  
  // Add animation
  const animStyle = document.createElement('style');
  animStyle.textContent = `
    @keyframes vh-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
  `;
  if (!document.querySelector('style[data-vh-bounce]')) {
    animStyle.setAttribute('data-vh-bounce', 'true');
    document.head.appendChild(animStyle);
  }
  
  // Remove old guide if exists and insert new one
  const oldGuide = document.querySelector('.vh-disclaimer-guide');
  if (oldGuide) oldGuide.remove();
  document.body.appendChild(guide);
  console.log('✅ Disclaimer指南已添加到页面（固定位置）');
  
  // Find all checkboxes on the disclaimer page
  setTimeout(() => {
    const allCheckboxes = findAllDisclaimerCheckboxes();
    console.log(`✅ 找到 ${allCheckboxes.length} 个复选框`);
    
    // Add pulsing animation to all checkboxes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes vh-pulse {
        0%, 100% { box-shadow: 0 0 0 3px rgba(3, 52, 110, 0.12), inset 0 0 8px rgba(3, 52, 110, 0.12); }
        50% { box-shadow: 0 0 0 6px rgba(3, 52, 110, 0.18), inset 0 0 12px rgba(3, 52, 110, 0.18); }
      }
      .vh-checkbox-highlight { animation: vh-pulse 1.5s infinite; }
    `;
    if (!document.querySelector('style[data-vh-pulse]')) {
      style.setAttribute('data-vh-pulse', 'true');
      document.head.appendChild(style);
    }
    
    // Highlight each checkbox
    allCheckboxes.forEach((checkbox, index) => {
      const wrapper = checkbox.closest('.ant-checkbox') || checkbox.parentElement;
      if (wrapper && wrapper.offsetParent !== null) {
        console.log(`✅ 高亮复选框 ${index + 1}`);
        
        wrapper.dataset.vhDisclaimerStyled = 'true';
        wrapper.style.position = 'relative';
        wrapper.style.boxShadow = '0 0 0 3px rgba(3, 52, 110, 0.12), inset 0 0 8px rgba(3, 52, 110, 0.12)';
        wrapper.style.borderRadius = '8px';
        wrapper.style.padding = '8px';
        wrapper.style.transition = 'all 0.3s ease';
        wrapper.classList.add('vh-checkbox-highlight');
      }
    });
  }, 600);
  
  // Setup next button - initially disabled
  const nextBtn = findNextButton();
  if (nextBtn) {
    console.log('✅ 找到Next按钮，初始状态为禁用');
    nextBtn.disabled = true;
    nextBtn.style.opacity = '0.5';
    nextBtn.style.cursor = 'not-allowed';
    
    // Remove old highlight class if exists
    nextBtn.classList.remove('vh-apply-highlight');
    nextBtn.style.background = '';
    nextBtn.style.boxShadow = '';
    
    // Get all checkboxes and setup monitoring
    const allCheckboxes = findAllDisclaimerCheckboxes();
    let completionShown = false;
    
    const checkAllBoxes = () => {
      const allChecked = allCheckboxes.every(checkbox => 
        checkbox.checked || checkbox.getAttribute('aria-checked') === 'true'
      );
      
      if (allChecked && allCheckboxes.length >= 2) {
        console.log('✅ 所有复选框已勾选，启用Next按钮');
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
        nextBtn.style.cursor = 'pointer';
        nextBtn.classList.add('vh-apply-highlight');
        
        // Hide the guide box
        const guideBox = document.querySelector('.vh-disclaimer-guide');
        if (guideBox) {
          guideBox.style.transition = 'opacity 0.5s ease';
          guideBox.style.opacity = '0';
          setTimeout(() => {
            if (guideBox.parentElement) {
              guideBox.remove();
            }
          }, 500);
        }
        
        // Show only ONE success message - green box
        if (!completionShown) {
          completionShown = true;
          const panelBody = document.querySelector('.vh-panel-body');
          document.getElementById('vh-disclaimer-success-msg')?.remove();
          const successMsg = document.createElement('div');
          successMsg.id = 'vh-disclaimer-success-msg';
          successMsg.style.cssText = `
            background: linear-gradient(135deg, #c8e6c9 0%, #a5d6a7 100%);
            border: 2px solid #4caf50;
            color: #1b5e20;
            padding: 12px 15px;
            border-radius: 4px;
            margin-bottom: 15px;
            font-weight: 600;
            text-align: center;
          `;
          successMsg.innerHTML = `✅ 已勾选所有条款，可以点击 Next 继续`;
          
          if (panelBody) {
            panelBody.insertBefore(successMsg, panelBody.firstChild);
          }
        }
      } else {
        // Keep disabled until all checked
        nextBtn.disabled = true;
        nextBtn.style.opacity = '0.5';
        nextBtn.style.cursor = 'not-allowed';
        nextBtn.classList.remove('vh-apply-highlight');
        document.getElementById('vh-disclaimer-success-msg')?.remove();
        completionShown = false;
      }
    };
    
    // Monitor all checkboxes for changes
    allCheckboxes.forEach((checkbox) => {
      // Listen to direct input changes
      checkbox.addEventListener('change', checkAllBoxes);
      checkbox.addEventListener('click', () => {
        setTimeout(checkAllBoxes, 200);
      });
      
      // Listen to wrapper clicks (for Ant Design)
      const wrapper = checkbox.closest('.ant-checkbox');
      if (wrapper) {
        wrapper.addEventListener('click', () => {
          setTimeout(checkAllBoxes, 200);
        });
      }
    });
    
    // Initial check
    checkAllBoxes();
  } else {
    console.warn('⚠️ 未找到Next按钮');
  }
}

function findAllDisclaimerCheckboxes() {
  // Find all checkboxes on the page
  const checkboxes = [];
  
  // Method 1: Ant Design checkboxes
  const antCheckboxes = document.querySelectorAll('.ant-checkbox-input');
  checkboxes.push(...Array.from(antCheckboxes));
  
  // Method 2: Standard HTML checkboxes
  const htmlCheckboxes = document.querySelectorAll('input[type="checkbox"]');
  htmlCheckboxes.forEach(cb => {
    // Avoid duplicates
    if (!checkboxes.includes(cb)) {
      checkboxes.push(cb);
    }
  });
  
  // Filter to only checkboxes related to disclaimer (ignore header checkboxes etc)
  return checkboxes.filter(cb => {
    // Check if checkbox is visible and in viewport
    if (cb.offsetParent === null) return false;
    
    // Check context - look for disclaimer/terms/agree keywords
    const parentText = (cb.parentElement?.textContent || '').toLowerCase();
    const grandParentText = (cb.parentElement?.parentElement?.textContent || '').toLowerCase();
    const allText = (parentText + ' ' + grandParentText).toLowerCase();
    
    return (allText.includes('compliance') || allText.includes('confirm') || 
            allText.includes('agree') || allText.includes('同意') || 
            allText.includes('disclaimer') || allText.includes('条款') ||
            allText.includes('instruction') || allText.includes('application'));
  });
}

function findDisclaimerContent() {
  const selectors = [
    '.disclaimer-content',
    '.terms-content',
    '.modal-body',
    'article',
    'main',
    '.content-scroll',
    'div[style*="overflow"]',
    '[class*="disclaimer"]',
    '[class*="terms"]',
    '[class*="modal"]',
    '.steps',
    '.step-content',
    '.wizard-content'
  ];
  
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el && el.scrollHeight > 200) {
        console.log('✅ 找到Disclaimer容器:', sel);
        return el;
      }
    } catch (e) {}
  }
  
  console.log('⚠️ 未找到Disclaimer容器，将使用window滚动检测');
  return null;
}

function setupScrollDetection(element) {
  // Just monitor scroll - don't auto-check
  element.addEventListener('scroll', () => {
    const scrolled = element.scrollTop + element.clientHeight;
    const total = element.scrollHeight;
    const percent = (scrolled / total) * 100;
    
    if (percent >= 80) {
      console.log(`📊 用户已读到${Math.round(percent)}%`);
      showNotification('👇 请找到下方的复选框并勾选', 'info');
    }
  }, { passive: true });
}

function setupWindowScrollDetection() {
  // Monitor page scroll - just for feedback, don't auto-check
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY + window.innerHeight;
    const total = document.documentElement.scrollHeight;
    const percent = (scrolled / total) * 100;
    
    if (percent >= 80) {
      console.log(`📊 页面滚动进度: ${Math.round(percent)}%`);
    }
  }, { passive: true });
}

function findDisclaimerCheckbox() {
  // Try multiple methods to find checkbox
  
  // Method 1: Ant Design checkbox (most common for Vietnamese visa site)
  let checkbox = document.querySelector('.ant-checkbox-input');
  if (checkbox) {
    console.log('✅ 找到Ant Design checkbox');
    return checkbox;
  }
  
  // Method 2: Standard HTML checkbox
  checkbox = document.querySelector('input[type="checkbox"]');
  if (checkbox) {
    console.log('✅ 找到标准checkbox');
    return checkbox;
  }
  
  // Method 3: Look for checkbox by common attributes/classes
  const selectors = [
    'input[name*="agree"]',
    'input[name*="disclaimer"]',
    'input[name*="term"]',
    'input[name*="accept"]',
    'input[class*="checkbox"]',
    '[role="checkbox"]',
    '.checkbox-input',
    '.terms-accept',
    '.ant-checkbox',
    '.agree-checkbox'
  ];
  
  for (const selector of selectors) {
    try {
      checkbox = document.querySelector(selector);
      if (checkbox) {
        console.log('✅ 通过选择器找到checkbox: ' + selector);
        return checkbox;
      }
    } catch (e) {}
  }
  
  // Method 4: Search by nearby text (context-based)
  const allInputs = document.querySelectorAll('input[type="checkbox"], .ant-checkbox-input, [role="checkbox"]');
  for (const input of allInputs) {
    const parentText = (input.parentElement?.textContent || '').toLowerCase();
    const grandParentText = (input.parentElement?.parentElement?.textContent || '').toLowerCase();
    const allText = (parentText + ' ' + grandParentText).toLowerCase();
    
    if ((allText.includes('agree') || allText.includes('同意') || allText.includes('disclaimer') || allText.includes('条款')) && 
        (input.type === 'checkbox' || input.getAttribute('role') === 'checkbox' || input.className.includes('checkbox'))) {
      console.log('✅ 通过文本上下文找到checkbox');
      return input;
    }
  }
  
  console.log('⚠️ 未找到任何checkbox');
  return null;
}

function setupDisclaimerCheckbox() {
  const checkbox = findDisclaimerCheckbox();
  if (checkbox) {
    // Handler for Ant Design checkbox
    const handleCheckboxChange = (e) => {
      const isChecked = checkbox.checked || checkbox.getAttribute('aria-checked') === 'true';
      console.log('✅ Checkbox状态变化:', isChecked);
      showNotification(isChecked ? '✅ 已勾选同意' : '⚠️ 请勾选同意', 'info');
    };
    
    // Attach multiple event listeners for different checkbox implementations
    checkbox.addEventListener('change', handleCheckboxChange);
    checkbox.addEventListener('click', handleCheckboxChange);
    checkbox.addEventListener('input', handleCheckboxChange);
    
    // For Ant Design, also listen to parent wrapper changes
    const wrapper = checkbox.closest('.ant-checkbox');
    if (wrapper) {
      wrapper.addEventListener('click', () => {
        console.log('🔄 Ant Design checkbox wrapper clicked');
        setTimeout(handleCheckboxChange, 100);
      });
    }
    
    console.log('✅ Checkbox事件监听已设置');
  } else {
    console.log('⚠️ 无法设置checkbox监听');
  }
}

function findNextButton() {
  // Expanded search - look in more places
  const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'));
  
  // More flexible text matching
  const nextBtn = buttons.find(btn => {
    const text = btn.textContent?.toLowerCase() || '';
    const value = btn.value?.toLowerCase() || '';
    const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
    return (text.includes('next') || text.includes('下一步') || text.includes('继续') ||
            value.includes('next') || value.includes('下一步') ||
            ariaLabel.includes('next') || ariaLabel.includes('下一步'));
  });
  
  if (nextBtn) {
    console.log('✅ 找到Next按钮:', nextBtn.textContent?.trim() || nextBtn.value);
  } else {
    console.log('⚠️ 未找到Next按钮');
  }
  
  return nextBtn;
}

function findPayButton() {
  const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'));

  const payBtn = buttons.find(btn => {
    const text = (btn.textContent || '').toLowerCase();
    const value = (btn.value || '').toLowerCase();
    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
    const combined = `${text} ${value} ${ariaLabel}`;

    return (
      combined.includes('pay now') ||
      combined.includes('make payment') ||
      combined.includes('payment') ||
      combined.includes('pay') ||
      combined.includes('thanh toán') ||
      combined.includes('thanh toan') ||
      combined.includes('付款') ||
      combined.includes('支付') ||
      combined.includes('缴费')
    );
  });

  if (payBtn) {
    console.log('✅ 找到Pay按钮:', payBtn.textContent?.trim() || payBtn.value);
  }

  return payBtn || null;
}

// ===== UI HELPERS =====

function injectFloatingPanel() {
  if (document.getElementById('visa-helper-panel')) return;
  
  const panel = document.createElement('div');
  panel.id = 'visa-helper-panel';
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'Vietnam Visa Helper');
  panel.tabIndex = 0;
  panel.innerHTML = `
    <div class="vh-panel-header">
      <span id="vh-panel-title">🇻🇳 v${EXTENSION_VERSION}</span>
      <button id="vh-minimize" type="button" aria-label="最小化助手面板" title="最小化助手面板">−</button>
    </div>
    <div class="vh-panel-body">
      <button id="vh-toggle-autofill" class="vh-btn">
        <span id="vh-autofill-status">🔴</span> 一键填表
      </button>
      <button id="vh-open-upload-panel" class="vh-btn">📎 上传照片</button>
      <button id="vh-show-data" class="vh-btn">📋 数据</button>
      <button id="vh-help" class="vh-btn">🆘 帮助</button>
      <div id="vh-stats"><small>就绪</small></div>
    </div>
  `;
  document.body.appendChild(panel);
  
  document.getElementById('vh-toggle-autofill')?.addEventListener('click', toggleAutoFill);
  document.getElementById('vh-open-upload-panel')?.addEventListener('click', openUploadPanel);
  document.getElementById('vh-show-data')?.addEventListener('click', showUserData);
  document.getElementById('vh-help')?.addEventListener('click', showHelp);
  const minimizeButton = document.getElementById('vh-minimize');

  const syncPanelMinimizedState = () => {
    const minimized = panel.classList.contains('minimized');
    const title = document.getElementById('vh-panel-title');
    if (title) {
      title.textContent = minimized ? 'VN\nV1' : `🇻🇳 v${EXTENSION_VERSION}`;
      title.title = minimized ? '点击展开越南签证助手' : `Vietnam Visa Helper v${EXTENSION_VERSION}`;
    }
    if (minimizeButton) {
      minimizeButton.textContent = minimized ? '+' : '−';
      minimizeButton.setAttribute('aria-label', minimized ? '展开助手面板' : '最小化助手面板');
      minimizeButton.title = minimized ? '展开助手面板' : '最小化助手面板';
    }
    panel.setAttribute('aria-expanded', minimized ? 'false' : 'true');
  };

  const setPanelMinimized = (nextState) => {
    panel.classList.toggle('minimized', nextState);
    syncPanelMinimizedState();
  };

  minimizeButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    setPanelMinimized(!panel.classList.contains('minimized'));
  });

  panel.addEventListener('click', (event) => {
    if (!panel.classList.contains('minimized')) return;
    const clickedInsideBody = !!event.target.closest('.vh-panel-body');
    if (clickedInsideBody) return;
    setPanelMinimized(false);
  });

  panel.addEventListener('keydown', (event) => {
    if (!panel.classList.contains('minimized')) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setPanelMinimized(false);
    }
  });

  syncPanelMinimizedState();
}

function showUserData() {
  const modal = document.createElement('div');
  modal.className = 'vh-modal';
  modal.innerHTML = `
    <div class="vh-modal-content">
      <div class="vh-modal-header">
        <h3>📋 你的信息</h3>
        <button class="vh-modal-close" id="vh-close-modal" type="button" aria-label="关闭">×</button>
      </div>
      <div class="vh-modal-body">
        <pre class="vh-modal-pre" id="vh-user-data-json"></pre>
        <div class="vh-modal-actions">
          <button class="vh-action-btn vh-action-btn-primary" id="vh-save-profile" type="button">☁️ 保存到云端</button>
          <button class="vh-action-btn" id="vh-close-modal-secondary" type="button">关闭</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const dataPreview = modal.querySelector('#vh-user-data-json');
  if (dataPreview) dataPreview.textContent = JSON.stringify(userData, null, 2);
  modal.querySelector('#vh-save-profile')?.addEventListener('click', () => {
    saveUserProfileToSupabase();
  });
  modal.querySelector('#vh-close-modal')?.addEventListener('click', () => modal.remove());
  modal.querySelector('#vh-close-modal-secondary')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function showHelp() {
  showNotification('📖 首页:点Apply | 表单:填完后手动点Next | 验证码页:手动输入验证码 | 支付页:核对后手动点Pay', 'info');
}

function showTopGuidance(msg, options = {}) {
  const persistent = options.persistent !== false;
  const force = !!options.force;
  let banner = document.querySelector('.vh-top-banner');

  if (banner && banner.dataset.persistent === 'true' && !persistent && !force) {
    return;
  }

  if (banner && banner.dataset.persistent === 'true' && persistent && !force) {
    return;
  }

  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'vh-top-banner';
    document.body.insertBefore(banner, document.body.firstChild);
  }

  banner.textContent = msg;
  banner.dataset.persistent = persistent ? 'true' : 'false';

  if (topGuidanceTimeoutId) {
    clearTimeout(topGuidanceTimeoutId);
    topGuidanceTimeoutId = null;
  }

  if (!persistent) {
    topGuidanceTimeoutId = setTimeout(() => {
      if (banner?.parentElement) {
        banner.remove();
      }
      topGuidanceTimeoutId = null;
    }, 5000);
  }
}

function showNotification(msg, type = 'info') {
  const notif = document.createElement('div');
  const normalizedType = type === 'warn' ? 'warning' : type;
  notif.className = `vh-notification vh-notification-${normalizedType}`;
  notif.textContent = msg;
  document.body.appendChild(notif);
  requestAnimationFrame(() => notif.classList.add('show'));
  setTimeout(() => {
    notif.classList.remove('show');
    setTimeout(() => notif.remove(), 240);
  }, 3000);
}

console.log(`✅ v${EXTENSION_VERSION} 加载完成`);
