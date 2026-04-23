// Content Script v1.2 - Fixed version with better button detection and autofill

let userData = null;
let fieldMappings = null;
let isAutoFillEnabled = false;
let currentPageType = null;
let disclaimerScrolled = false;
let fieldCache = {};

// Initialize
(function init() {
  console.log('🇻🇳 越南签证助手 v1.2 已激活 - Bug修复版本');
  
  // Get data from background
  chrome.runtime.sendMessage({ action: 'getUserData' }, (response) => {
    if (!response) {
      console.error('❌ 获取用户数据失败');
      return;
    }
    
    userData = response.userData;
    fieldMappings = response.fieldMappings;
    
    console.log('✅ 用户数据已加载', userData);
    console.log('✅ 字段映射已加载，共', Object.keys(fieldMappings).length, '个字段');
    
    // Inject floating control panel
    injectFloatingPanel();
    
    // Detect current page type with retry
    let retryCount = 0;
    const detectAndInit = () => {
      detectPageType();
      console.log('🔍 页面类型检测: ' + currentPageType);
      
      // Try to handle page
      handleCurrentPage();
      
      // Retry if needed (for slow-loading pages)
      if (retryCount < 2) {
        retryCount++;
        setTimeout(detectAndInit, 1500);
      }
    };
    
    setTimeout(detectAndInit, 800);
  });
})();

// Detect page type
function detectPageType() {
  const url = window.location.href.toLowerCase();
  const pageText = document.body.innerText.toLowerCase();
  const hasForm = !!document.querySelector('form input, form select, form textarea, input[type="text"], select');
  
  // Reset type
  currentPageType = 'HOME';
  
  // Check for form page first (most specific)
  if (hasForm && (url.includes('/form') || url.includes('/application') || url.includes('personal'))) {
    currentPageType = 'FORM';
    console.log('📝 检测到: 表单页面 (有表单元素)');
  }
  // Check for disclaimer
  else if (url.includes('disclaimer') || pageText.includes('disclaimer') || pageText.includes('条款')) {
    currentPageType = 'DISCLAIMER';
    console.log('📋 检测到: Disclaimer 页面');
  }
  // Check for apply button
  else if (findApplyButton()) {
    currentPageType = 'APPLY';
    console.log('✋ 检测到: Apply 页面 (有Apply按钮)');
  }
  // Form with no specific URL pattern
  else if (hasForm) {
    currentPageType = 'FORM';
    console.log('📝 检测到: 表单页面 (自动识别)');
  }
}

// Handle current page
function handleCurrentPage() {
  switch(currentPageType) {
    case 'APPLY':
      handleApplyPage();
      break;
    case 'DISCLAIMER':
      handleDisclaimerPage();
      break;
    case 'FORM':
      console.log('🚀 开始检测和标签化表单字段...');
      detectAndLabelFields();
      break;
    default:
      // Only highlight on HOME page, not on every page type
      if (!window.__applyHighlighted) {
        console.log('📱 首页，尝试查找Apply按钮...');
        const btn = findAndHighlightApplyButton();
        if (btn) window.__applyHighlighted = true;
      }
      break;
  }
}

// ========== APPLY PAGE HANDLER ==========

function handleApplyPage() {
  console.log('🎯 处理 Apply 页面...');
  showTopGuidance('👆 点击红色的 "Apply now" 按钮开始申请');
  
  const applyBtn = findAndHighlightApplyButton();
  if (applyBtn) {
    // Scroll to button
    setTimeout(() => {
      applyBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showNotification('👇 已为你定位申请按钮！', 'info');
    }, 500);
  } else {
    console.warn('⚠️ 未找到Apply按钮，但已检测到Apply页面');
  }
}

// Find apply button using multiple strategies
function findApplyButton() {
  let btn = null;
  
  // Strategy 1: Direct selector lookups
  const selectors = [
    'button:contains("Apply")',
    'button[class*="apply"]',
    'a[href*="apply"]',
    '[data-test*="apply"]',
    '.apply-button',
    '.apply-btn',
    'button.btn-primary:not([disabled])',
    'button[onclick*="apply"]',
    'a.btn-danger' // red button pattern
  ];
  
  for (const selector of selectors) {
    try {
      const elem = document.querySelector(selector);
      if (elem && elem.offsetParent !== null) {
        btn = elem;
        console.log('✅ 用选择器找到Apply按钮:', selector);
        break;
      }
    } catch (e) {
      // Invalid selector, continue
    }
  }
  
  // Strategy 2: Text search in all buttons
  if (!btn) {
    const buttons = Array.from(document.querySelectorAll('button, a.btn, a[role="button"], input[type="button"]'));
    btn = buttons.find(b => {
      const text = b.textContent.toLowerCase();
      return text.includes('apply') && (text.includes('now') || text.length < 30);
    });
    
    if (btn) {
      console.log('✅ 用文本搜索找到Apply按钮');
    }
  }
  
  // Strategy 3: Look for red/primary colored buttons that are prominent
  if (!btn) {
    const buttons = Array.from(document.querySelectorAll('button, a.btn'));
    btn = buttons.find(b => {
      const style = window.getComputedStyle(b);
      const bgColor = style.backgroundColor;
      const text = b.textContent.toLowerCase();
      // Look for red-ish color and prominent button
      return (bgColor.includes('rgb(') || bgColor.includes('red')) && 
              (text.length < 20) && 
              b.offsetHeight > 40;
    });
    
    if (btn) {
      console.log('✅ 用颜色和样式找到Apply按钮');
    }
  }
  
  return btn;
}

function findAndHighlightApplyButton() {
  const applyBtn = findApplyButton();
  
  if (applyBtn) {
    // Add highlight class
    applyBtn.classList.add('vh-apply-highlight');
    applyBtn.style.position = 'relative';
    console.log('✅ Apply按钮已高亮');
    
    // Track clicks
    applyBtn.addEventListener('click', () => {
      console.log('👆 用户点击了Apply按钮');
      showNotification('⏳ 正在加载申请页面...', 'info');
      setTimeout(() => {
        detectPageType();
        handleCurrentPage();
      }, 1000);
    });
    
    return applyBtn;
  } else {
    console.warn('⚠️ 未找到Apply按钮');
    return null;
  }
}

// ========== FORM PAGE HANDLER ==========

// Detect and label all form fields
function detectAndLabelFields() {
  const inputs = document.querySelectorAll('input, select, textarea');
  console.log(`🔍 发现 ${inputs.length} 个表单元素`);
  
  let fieldCount = 0;
  const processedIds = new Set();
  
  inputs.forEach((input, index) => {
    // Skip if already processed
    const id = input.id || input.name || index;
    if (processedIds.has(id) || input.dataset.vhLabeled) {
      return;
    }
    processedIds.add(id);
    
    // Try to identify field
    const fieldInfo = identifyField(input);
    
    if (fieldInfo) {
      fieldCount++;
      console.log(`✅ 识别字段[${fieldCount}]: ${fieldInfo.label_cn} (${fieldInfo.key})`);
      
      // Cache for autofill
      fieldCache[fieldInfo.key] = input;
      
      // Add label and hints
      addChineseLabel(input, fieldInfo);
      
      // Add focus listener
      input.addEventListener('focus', () => {
        showFieldHint(input, fieldInfo);
      });
    }
  });
  
  // Update panel stats
  const fieldCountEl = document.getElementById('vh-field-count');
  if (fieldCountEl) {
    fieldCountEl.textContent = fieldCount;
  }
  
  console.log(`📊 成功识别 ${fieldCount} 个字段，缓存可填充字段: ${Object.keys(fieldCache).length}`);
}

// Identify field type by label, name, placeholder, etc.
function identifyField(input) {
  // Get all identifying attributes
  const label = input.placeholder?.toLowerCase() || '';
  const name = (input.name || '').toLowerCase();
  const id = (input.id || '').toLowerCase();
  const parentText = (input.parentElement?.textContent || '').toLowerCase();
  const prevLabel = (input.previousElementSibling?.textContent || '').toLowerCase();
  const associatedLabel = document.querySelector(`label[for="${input.id}"]`)?.textContent?.toLowerCase() || '';
  
  const allText = `${label} ${name} ${id} ${parentText} ${prevLabel} ${associatedLabel}`.toLowerCase();
  
  console.log(`🔎 识别字段: label="${label}" name="${name}" id="${id}"`);
  
  // Exact key matches (order matters - most specific first)
  if (allText.includes('surname') || allText.includes('last name') || allText.includes('family name')) {
    return { key: 'surname', ...fieldMappings.surname };
  }
  if (allText.includes('given') || allText.includes('first name') || (allText.includes('middle') && allText.includes('name'))) {
    return { key: 'given_name', ...fieldMappings.given_name };
  }
  if (allText.includes('full name')) {
    return { key: 'full_name', ...fieldMappings.full_name };
  }
  if (allText.includes('date of birth') || allText.includes('birth date') || allText.includes('dob')) {
    return { key: 'date_of_birth', ...fieldMappings.date_of_birth };
  }
  if (allText.includes('sex') || allText.includes('gender')) {
    return { key: 'gender', ...fieldMappings.gender };
  }
  if (allText.includes('nationality') || allText.includes('country of citizenship')) {
    return { key: 'nationality', ...fieldMappings.nationality };
  }
  if (allText.includes('passport') && allText.includes('number')) {
    return { key: 'passport_number', ...fieldMappings.passport_number };
  }
  if ((allText.includes('passport') && allText.includes('expir')) || allText.includes('passport validity')) {
    return { key: 'passport_expiry', ...fieldMappings.passport_expiry };
  }
  if (allText.includes('email')) {
    // Distinguish between email and re-enter email
    if (allText.includes('re-enter') || allText.includes('-enter')) {
      return { key: 'email', ...fieldMappings.email }; // Will be filled again
    }
    return { key: 'email', ...fieldMappings.email };
  }
  if (allText.includes('phone') || allText.includes('telephone') || allText.includes('mobile')) {
    return { key: 'phone', ...fieldMappings.phone };
  }
  if (allText.includes('identity') || allText.includes('id card') || allText.includes('national id')) {
    return { key: 'passport_number', ...fieldMappings.passport_number }; // Fallback
  }
  if (allText.includes('purpose')) {
    return { key: 'purpose', ...fieldMappings.purpose };
  }
  if (allText.includes('duration') || allText.includes('stay')) {
    return { key: 'duration', ...fieldMappings.duration };
  }
  if (allText.includes('arrival') && allText.includes('date')) {
    return { key: 'arrival_date', ...fieldMappings.arrival_date };
  }
  if (allText.includes('departure') || allText.includes('departure date')) {
    return { key: 'departure_date', ...fieldMappings.departure_date };
  }
  if (allText.includes('arrival') && allText.includes('city')) {
    return { key: 'arrival_city', ...fieldMappings.arrival_city };
  }
  if (allText.includes('address') || allText.includes('destination')) {
    return { key: 'destination_address', ...fieldMappings.destination_address };
  }
  if (allText.includes('religion')) {
    return { key: 'religion', ...fieldMappings.religion || { label_cn: '宗教', hint: '选择你的宗教信仰' } };
  }
  if (allText.includes('place of birth')) {
    return { key: 'place_of_birth', ...fieldMappings.place_of_birth || { label_cn: '出生地', hint: '输入你的出生城市和国家' } };
  }
  
  // If input is passport-related but couldn't be identified precisely
  if (allText.includes('identity card')) {
    return { key: 'identity_card', ...fieldMappings.identity_card || { label_cn: '身份证号', hint: '输入你的身份证或护照号码' } };
  }
  
  return null;
}

// Add Chinese label to field
function addChineseLabel(input, fieldInfo) {
  if (input.dataset.vhLabeled) return;
  input.dataset.vhLabeled = 'true';
  
  const label = document.createElement('div');
  label.className = 'vh-chinese-label';
  label.innerHTML = `
    <span class="vh-label-text">${fieldInfo.label_cn || '字段'}</span>
    <span class="vh-hint-icon" title="${fieldInfo.hint}">❓</span>
  `;
  
  // Insert before input
  input.parentNode.insertBefore(label, input);
  
  // Add hint box
  const hintBox = document.createElement('div');
  hintBox.className = 'vh-hint-box';
  hintBox.innerHTML = `
    <div class="vh-hint-content">
      <strong>💡 填写提示：</strong>
      <p>${fieldInfo.hint || '请填写这个字段'}</p>
      ${fieldInfo.example ? `<p><em>示例：${fieldInfo.example}</em></p>` : ''}
      ${fieldInfo.options ? renderOptions(fieldInfo.options) : ''}
    </div>
  `;
  hintBox.style.display = 'none';
  input.parentNode.insertBefore(hintBox, input.nextSibling);
  
  // Toggle hint on icon click
  label.querySelector('.vh-hint-icon').addEventListener('click', (e) => {
    e.stopPropagation();
    hintBox.style.display = hintBox.style.display === 'none' ? 'block' : 'none';
  });
}

// Render options
function renderOptions(options) {
  if (!options || typeof options !== 'object') return '';
  return '<ul>' + Object.entries(options).map(([val, cn]) => 
    `<li><code>${val}</code> = ${cn}</li>`
  ).join('') + '</ul>';
}

// Show field hint
function showFieldHint(input, fieldInfo) {
  const hintBox = input.parentNode.querySelector('.vh-hint-box');
  if (hintBox) {
    hintBox.style.display = 'block';
    setTimeout(() => {
      hintBox.style.display = 'none';
    }, 5000);
  }
}

// ========== AUTO-FILL FUNCTION ==========

function toggleAutoFill() {
  isAutoFillEnabled = !isAutoFillEnabled;
  const statusIcon = document.getElementById('vh-autofill-status');
  
  if (statusIcon) {
    statusIcon.textContent = isAutoFillEnabled ? '🟢' : '🔴';
  }
  
  if (isAutoFillEnabled) {
    console.log('🟢 自动填表已启用');
    fillAllFields();
  } else {
    console.log('🔴 自动填表已禁用');
    showNotification('⏸️ 自动填表已暂停', 'info');
  }
}

// Fill all fields with user data
function fillAllFields() {
  console.log('📝 开始自动填表...');
  
  const inputs = document.querySelectorAll('input, select, textarea');
  let filledCount = 0;
  let failedCount = 0;
  
  inputs.forEach((input, index) => {
    // Skip if already filled (marked with vh-filled)
    if (input.classList.contains('vh-filled') && input.value) {
      console.log(`⏭️ [${index}] 字段已填充，跳过`);
      return;
    }
    
    const fieldInfo = identifyField(input);
    
    if (fieldInfo && fieldInfo.key) {
      const value = getValueFromUserData(fieldInfo.key);
      
      if (value !== undefined && value !== null && value !== '') {
        try {
          fillField(input, value, fieldInfo);
          filledCount++;
          console.log(`✅ 填充[${index}]: ${fieldInfo.label_cn} = ${value}`);
        } catch (e) {
          console.warn(`⚠️ 填充失败[${index}]: ${fieldInfo.label_cn}`, e);
          failedCount++;
        }
      } else {
        console.log(`⏭️ 跳过[${index}]: ${fieldInfo.label_cn} (无值)`);
      }
    } else {
      console.log(`❌ 跳过[${index}]: 无法识别字段 (name=${input.name}, id=${input.id})`);
    }
  });
  
  console.log(`📊 填充完成: 成功 ${filledCount}, 失败 ${failedCount}`);
  
  if (filledCount > 0) {
    showNotification(`✅ 已自动填充 ${filledCount} 个字段`, 'success');
  } else if (failedCount === 0 && inputs.length === 0) {
    showNotification('⚠️ 页面上没有找到表单字段', 'warning');
  } else if (failedCount > 0) {
    showNotification(`⚠️ 只填充了 ${filledCount} 个字段，${failedCount} 个失败`, 'warning');
  } else {
    showNotification('⚠️ 未找到可填充的字段，请检查数据配置', 'warning');
  }
}

// Get value from user data
function getValueFromUserData(key) {
  // Map field keys to data paths
  const dataPaths = {
    'full_name': 'personalInfo.full_name',
    'surname': 'personalInfo.surname',
    'given_name': 'personalInfo.given_name',
    'date_of_birth': 'personalInfo.date_of_birth',
    'gender': 'personalInfo.gender',
    'nationality': 'personalInfo.nationality',
    'passport_number': 'personalInfo.passport_number',
    'passport_expiry': 'personalInfo.passport_expiry',
    'email': 'contactInfo.email',
    'phone': 'contactInfo.phone',
    'purpose': 'travelInfo.purpose',
    'duration': 'travelInfo.duration',
    'arrival_date': 'travelInfo.arrival_date',
    'departure_date': 'travelInfo.departure_date',
    'arrival_city': 'travelInfo.arrival_city',
    'destination_address': 'travelInfo.destination_address'
  };
  
  const path = dataPaths[key];
  if (!path) {
    console.warn(`⚠️ 未知的字段key: ${key}`);
    return undefined;
  }
  
  const keys = path.split('.');
  let value = userData;
  
  for (const k of keys) {
    value = value?.[k];
  }
  
  return value;
}

// Fill single field
function fillField(input, value, fieldInfo) {
  const tagName = input.tagName.toUpperCase();
  
  if (tagName === 'SELECT') {
    // Handle select dropdown
    const options = Array.from(input.options || []);
    let matched = false;
    
    // Try exact match first
    for (const opt of options) {
      if (opt.value.toLowerCase() === value.toString().toLowerCase()) {
        input.value = opt.value;
        matched = true;
        break;
      }
    }
    
    // Try text match
    if (!matched) {
      for (const opt of options) {
        if (opt.text.toLowerCase().includes(value.toString().toLowerCase())) {
          input.value = opt.value;
          matched = true;
          break;
        }
      }
    }
  } else if (input.type === 'radio' || input.type === 'checkbox') {
    // Handle radio/checkbox
    if (input.value.toLowerCase() === value.toString().toLowerCase()) {
      input.checked = true;
    }
  } else if (input.type === 'date') {
    // Handle date input
    input.value = value;
  } else {
    // Handle text input
    input.value = value;
  }
  
  // Trigger events
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
  
  // Mark as filled
  input.classList.add('vh-filled');
}

// ========== DISCLAIMER PAGE HANDLER ==========

function handleDisclaimerPage() {
  console.log('📋 处理 Disclaimer 页面...');
  showTopGuidance('📋 请阅读并勾选同意条款');
  
  const disclaimerContent = findDisclaimerContent();
  
  if (!disclaimerContent) {
    console.warn('⚠️ 未找到 Disclaimer 内容');
    return;
  }
  
  setupScrollDetection(disclaimerContent);
  setupDisclaimerCheckbox();
  
  const nextBtn = findNextButton();
  if (nextBtn && !disclaimerScrolled) {
    nextBtn.disabled = true;
    nextBtn.style.opacity = '0.5';
    nextBtn.style.cursor = 'not-allowed';
  }
}

function findDisclaimerContent() {
  const selectors = [
    '.disclaimer-content',
    '.terms-content',
    '[data-test="disclaimer"]',
    '.disclaimer',
    '.terms',
    'article',
    '.modal-body',
    '[role="document"]',
    '.content-scroll',
    '.form-content'
  ];
  
  for (const selector of selectors) {
    const elem = document.querySelector(selector);
    if (elem && elem.offsetHeight > 100) {
      return elem;
    }
  }
  
  return null;
}

function setupScrollDetection(element) {
  element.addEventListener('scroll', () => {
    const scrollPercentage = (element.scrollTop / (element.scrollHeight - element.clientHeight)) * 100;
    
    if (scrollPercentage >= 90) {
      disclaimerScrolled = true;
      
      // Enable next button
      const nextBtn = findNextButton();
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
        nextBtn.style.cursor = 'pointer';
        nextBtn.classList.add('vh-apply-highlight');
        showNotification('✅ 现在可以点击 Next 继续', 'success');
      }
      
      // Auto-check checkbox
      const checkbox = findDisclaimerCheckbox();
      if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });
}

function findDisclaimerCheckbox() {
  return document.querySelector('input[type="checkbox"]');
}

function setupDisclaimerCheckbox() {
  const checkbox = findDisclaimerCheckbox();
  if (checkbox) {
    checkbox.addEventListener('change', (e) => {
      showNotification(e.target.checked ? '✅ 已同意' : '⚠️ 请同意以继续', 'info');
    });
  }
}

function findNextButton() {
  const buttons = Array.from(document.querySelectorAll('button, a.btn'));
  return buttons.find(btn => {
    const text = btn.textContent.toLowerCase();
    return text.includes('next') || text.includes('下一步') || text.includes('继续');
  });
}

// ========== UI HELPERS ==========

// Inject floating control panel
function injectFloatingPanel() {
  if (document.getElementById('visa-helper-panel')) return;
  
  const panel = document.createElement('div');
  panel.id = 'visa-helper-panel';
  panel.innerHTML = `
    <div class="vh-panel-header">
      <span>🇻🇳 签证助手 v1.2</span>
      <button id="vh-minimize">−</button>
    </div>
    <div class="vh-panel-body">
      <button id="vh-toggle-autofill" class="vh-btn" style="display:${currentPageType === 'FORM' ? 'flex' : 'none'};">
        <span id="vh-autofill-status">🔴</span> 一键自动填表
      </button>
      <button id="vh-show-data" class="vh-btn">📋 查看数据</button>
      <button id="vh-toggle-hints" class="vh-btn" style="display:${currentPageType === 'FORM' ? 'flex' : 'none'};">💡 切换提示</button>
      <button id="vh-need-help" class="vh-btn">🆘 需要帮助</button>
      <div id="vh-stats">
        <small>🔄 页面: <span id="vh-page-type">${currentPageType}</span></small><br>
        <small>📝 字段: <span id="vh-field-count">0</span></small>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  
  // Bind events
  const autoFillBtn = document.getElementById('vh-toggle-autofill');
  if (autoFillBtn) {
    autoFillBtn.addEventListener('click', toggleAutoFill);
  }
  
  document.getElementById('vh-show-data')?.addEventListener('click', showUserData);
  document.getElementById('vh-toggle-hints')?.addEventListener('click', toggleHints);
  document.getElementById('vh-minimize')?.addEventListener('click', minimizePanel);
  document.getElementById('vh-need-help')?.addEventListener('click', showHelpGuide);
}

function showUserData() {
  const modal = document.createElement('div');
  modal.className = 'vh-modal';
  modal.innerHTML = `
    <div class="vh-modal-content">
      <div class="vh-modal-header">
        <h3>📋 当前填表数据</h3>
        <button class="vh-modal-close">✕</button>
      </div>
      <div class="vh-modal-body">
        <pre style="background: #f5f5f5; padding: 15px; border-radius: 6px; overflow-x: auto; max-height: 400px;">
${JSON.stringify(userData, null, 2)}
        </pre>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('.vh-modal-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function toggleHints() {
  const hints = document.querySelectorAll('.vh-hint-box');
  const allVisible = Array.from(hints).some(h => h.style.display !== 'none');
  
  hints.forEach(hint => {
    hint.style.display = allVisible ? 'none' : 'block';
  });
  
  showNotification(allVisible ? '❌ 已隐藏提示' : '✅ 已显示提示', 'info');
}

function minimizePanel() {
  const panel = document.getElementById('visa-helper-panel');
  panel?.classList.toggle('minimized');
}

function showHelpGuide() {
  let helpContent = '';
  
  if (currentPageType === 'FORM') {
    helpContent = `
      <div class="vh-guide-step"><span class="vh-guide-step-num">1</span> 每个字段旁有❓，点击查看说明</div>
      <div class="vh-guide-step"><span class="vh-guide-step-num">2</span> 点击"一键自动填表"快速填充信息</div>
      <div class="vh-guide-step"><span class="vh-guide-step-num">3</span> 绿色✓表示已填充，可修改</div>
      <div class="vh-guide-step"><span class="vh-guide-step-num">4</span> 检查无误后点击提交</div>
    `;
  } else if (currentPageType === 'APPLY') {
    helpContent = `
      <div class="vh-guide-step"><span class="vh-guide-step-num">1</span> 点击红色"Apply now"按钮</div>
      <div class="vh-guide-step"><span class="vh-guide-step-num">2</span> 等待页面加载</div>
      <div class="vh-guide-step"><span class="vh-guide-step-num">3</span> 插件会自动继续引导</div>
    `;
  } else if (currentPageType === 'DISCLAIMER') {
    helpContent = `
      <div class="vh-guide-step"><span class="vh-guide-step-num">1</span> 向下滚动阅读条款</div>
      <div class="vh-guide-step"><span class="vh-guide-step-num">2</span> 插件自动检测进度</div>
      <div class="vh-guide-step"><span class="vh-guide-step-num">3</span> 自动勾选同意</div>
      <div class="vh-guide-step"><span class="vh-guide-step-num">4</span> 点击Next继续</div>
    `;
  } else {
    helpContent = `
      <div class="vh-guide-step"><span class="vh-guide-step-num">1</span> 访问 evisa.gov.vn</div>
      <div class="vh-guide-step"><span class="vh-guide-step-num">2</span> 点击 Apply now 按钮</div>
      <div class="vh-guide-step"><span class="vh-guide-step-num">3</span> 按照插件指引完成申请</div>
    `;
  }
  
  const guide = document.createElement('div');
  guide.className = 'vh-modal';
  guide.innerHTML = `
    <div class="vh-disclaimer-guide">
      <h2>📖 使用指南 (${currentPageType})</h2>
      ${helpContent}
      <button onclick="this.closest('.vh-modal').remove()" style="margin-top: 20px; padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer;">
        关闭
      </button>
    </div>
  `;
  
  document.body.appendChild(guide);
  guide.addEventListener('click', (e) => {
    if (e.target === guide) guide.remove();
  });
}

function showTopGuidance(message) {
  if (document.querySelector('.vh-apply-hint')) return;
  
  const banner = document.createElement('div');
  banner.className = 'vh-apply-hint';
  banner.innerHTML = message;
  document.body.insertBefore(banner, document.body.firstChild);
  
  setTimeout(() => {
    banner.style.opacity = '0';
    banner.style.transition = 'opacity 0.3s ease';
    setTimeout(() => banner.remove(), 300);
  }, 5000);
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `vh-notification vh-notification-${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Listen for URL changes and re-detect page type
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log('🔄 检测到URL变化，重新初始化');
    setTimeout(() => {
      detectPageType();
      handleCurrentPage();
    }, 1000);
  }
}).observe(document, { subtree: true, childList: true });

console.log('✅ Content Script v1.2 加载完成');
