// Content Script v1.2.1 - Final fixes for all reported issues

let userData = null;
let fieldMappings = null;
let isAutoFillEnabled = false;
let currentPageType = null;
let disclaimerScrolled = false;
let fieldCache = {};
let applyHighlightApplied = false; // Prevent duplicate highlights

// Initialize
(function init() {
  console.log('🇻🇳 越南签证助手 v1.2.1 已激活 - 最终修复版本');
  
  chrome.runtime.sendMessage({ action: 'getUserData' }, (response) => {
    if (!response) {
      console.error('❌ 获取用户数据失败');
      return;
    }
    
    userData = response.userData;
    fieldMappings = response.fieldMappings;
    
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
  });
})();

// Detect page type
function detectPageType() {
  const url = window.location.href.toLowerCase();
  const pageText = document.body.innerText.toLowerCase();
  const hasForm = !!document.querySelector('form input, form select, form textarea, input[type="text"], select');
  
  currentPageType = 'HOME';
  
  if (hasForm && (url.includes('/form') || url.includes('/application') || url.includes('personal') || url.includes('information'))) {
    currentPageType = 'FORM';
    console.log('📝 表单页面');
  } 
  else if (url.includes('disclaimer') || pageText.includes('disclaimer') || pageText.includes('条款')) {
    currentPageType = 'DISCLAIMER';
    console.log('📋 Disclaimer页面');
  } 
  else if (findApplyButton()) {
    currentPageType = 'HOME'; // Keep as HOME but note we found apply button
    console.log('🏠 首页');
  } 
  else if (hasForm) {
    currentPageType = 'FORM';
    console.log('📝 表单页面(自动识别)');
  }
}

// Handle current page - FIXED: prevent Apply highlight on every page
function handleCurrentPage() {
  switch(currentPageType) {
    case 'FORM':
      console.log('🚀 处理表单页面...');
      setTimeout(() => detectAndLabelFields(), 500);
      break;
    case 'DISCLAIMER':
      console.log('📋 处理Disclaimer页面...');
      setTimeout(() => handleDisclaimerPage(), 500);
      break;
    default: // HOME page
      // Only highlight once per page load
      if (!applyHighlightApplied && findApplyButton()) {
        console.log('🏠 首页 - 高亮Apply按钮');
        applyHighlightApplied = true;
        findAndHighlightApplyButton();
        showTopGuidance('👆 请点击红色"Apply now"按钮开始申请');
      }
      break;
  }
}

// ===== APPLY BUTTON DETECTION =====

function findApplyButton() {
  let btn = null;
  
  // Strategy 1: Text-based search (most reliable for dynamic content)
  const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
  btn = buttons.find(b => {
    const text = b.innerText?.toLowerCase() || b.textContent?.toLowerCase() || '';
    return (text.includes('apply') && text.includes('now')) || 
           (text === 'apply') ||
           text.includes('开始申请');
  });
  
  if (btn) {
    console.log('✅ Apply按钮已找到');
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
    'button[data-test*="apply"]'
  ];
  
  for (const selector of classSelectors) {
    try {
      btn = document.querySelector(selector);
      if (btn && btn.offsetParent !== null) {
        console.log(`✅ 通过${selector}找到按钮`);
        return btn;
      }
    } catch (e) {}
  }
  
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
  const inputs = document.querySelectorAll('input, select, textarea');
  console.log(`🔍 发现 ${inputs.length} 个表单元素`);
  
  if (inputs.length === 0) {
    console.warn('⚠️ 页面上没有发现表单元素');
    return;
  }
  
  let fieldCount = 0;
  
  inputs.forEach((input, index) => {
    if (input.dataset.vhLabeled) return;
    
    const fieldInfo = identifyField(input);
    if (fieldInfo) {
      fieldCount++;
      fieldCache[fieldInfo.key] = input;
      addChineseLabel(input, fieldInfo);
      
      input.addEventListener('focus', () => {
        const hint = input.parentElement?.querySelector('.vh-hint-box');
        if (hint) hint.style.display = 'block';
      }, { once: false });
    }
  });
  
  const countEl = document.getElementById('vh-field-count');
  if (countEl) countEl.textContent = fieldCount;
  
  console.log(`✅ 已识别 ${fieldCount} 个字段`);
}

function identifyField(input) {
  const label = input.placeholder?.toLowerCase() || '';
  const name = (input.name || '').toLowerCase();
  const id = (input.id || '').toLowerCase();
  const parentText = (input.parentElement?.textContent || '').toLowerCase();
  const prevLabel = (input.previousElementSibling?.textContent || '').toLowerCase();
  
  const allText = `${label} ${name} ${id} ${parentText} ${prevLabel}`;
  
  // Surname / Last name
  if (allText.includes('surname') || allText.includes('last name') || allText.includes('family name')) {
    return { key: 'surname', ...fieldMappings.surname };
  }
  // Given name / First name
  if (allText.includes('given') || allText.includes('first name') || (allText.includes('middle') && allText.includes('name'))) {
    return { key: 'given_name', ...fieldMappings.given_name };
  }
  // Full name
  if (allText.includes('full name')) {
    return { key: 'full_name', ...fieldMappings.full_name };
  }
  // Date of birth
  if (allText.includes('date of birth') || allText.includes('birth date') || allText.includes('dob')) {
    return { key: 'date_of_birth', ...fieldMappings.date_of_birth };
  }
  // Sex / Gender
  if (allText.includes('sex') || allText.includes('gender')) {
    return { key: 'gender', ...fieldMappings.gender };
  }
  // Nationality
  if (allText.includes('nationality')) {
    return { key: 'nationality', ...fieldMappings.nationality };
  }
  // Passport number
  if (allText.includes('passport') && allText.includes('number')) {
    return { key: 'passport_number', ...fieldMappings.passport_number };
  }
  // Passport expiry
  if ((allText.includes('passport') && allText.includes('expir')) || allText.includes('passport validity')) {
    return { key: 'passport_expiry', ...fieldMappings.passport_expiry };
  }
  // Email
  if (allText.includes('email')) {
    return { key: 'email', ...fieldMappings.email };
  }
  // Phone
  if (allText.includes('phone') || allText.includes('mobile')) {
    return { key: 'phone', ...fieldMappings.phone };
  }
  // Purpose
  if (allText.includes('purpose') || allText.includes('reason')) {
    return { key: 'purpose', ...fieldMappings.purpose };
  }
  // Duration / Stay
  if (allText.includes('duration') || allText.includes('stay')) {
    return { key: 'duration', ...fieldMappings.duration };
  }
  // Arrival date
  if (allText.includes('arrival') && allText.includes('date')) {
    return { key: 'arrival_date', ...fieldMappings.arrival_date };
  }
  // Departure date
  if (allText.includes('departure')) {
    return { key: 'departure_date', ...fieldMappings.departure_date };
  }
  // City
  if (allText.includes('arrival') && allText.includes('city')) {
    return { key: 'arrival_city', ...fieldMappings.arrival_city };
  }
  // Address
  if (allText.includes('address') || allText.includes('destination')) {
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
  
  return null;
}

function addChineseLabel(input, fieldInfo) {
  if (input.dataset.vhLabeled) return;
  input.dataset.vhLabeled = 'true';
  
  const wrapper = document.createElement('div');
  wrapper.className = 'vh-field-wrapper';
  
  const label = document.createElement('div');
  label.className = 'vh-chinese-label';
  label.innerHTML = `<span class="vh-label-text">${fieldInfo.label_cn}</span><span class="vh-hint-icon">❓</span>`;
  
  const hintBox = document.createElement('div');
  hintBox.className = 'vh-hint-box';
  hintBox.innerHTML = `
    <strong>💡 提示</strong>
    <p>${fieldInfo.hint || ''}</p>
    ${fieldInfo.example ? `<p><em>示例: ${fieldInfo.example}</em></p>` : ''}
  `;
  hintBox.style.display = 'none';
  
  label.querySelector('.vh-hint-icon').addEventListener('click', () => {
    hintBox.style.display = hintBox.style.display === 'none' ? 'block' : 'none';
  });
  
  input.parentNode.insertBefore(label, input);
  input.parentNode.insertBefore(hintBox, input.nextSibling);
}

function toggleAutoFill() {
  isAutoFillEnabled = !isAutoFillEnabled;
  const icon = document.getElementById('vh-autofill-status');
  if (icon) icon.textContent = isAutoFillEnabled ? '🟢' : '🔴';
  
  if (isAutoFillEnabled) {
    console.log('🟢 自动填表已启用');
    fillAllFields();
  } else {
    console.log('🔴 自动填表已禁用');
    showNotification('已关闭自动填表', 'info');
  }
}

function fillAllFields() {
  console.log('📝 开始自动填表...');
  
  const inputs = document.querySelectorAll('input, select, textarea');
  let success = 0;
  
  inputs.forEach((input, idx) => {
    const fieldInfo = identifyField(input);
    if (!fieldInfo?.key) return;
    
    const value = getValueFromUserData(fieldInfo.key);
    if (!value) return;
    
    try {
      if (input.tagName === 'SELECT') {
        const options = Array.from(input.options || []);
        const matched = options.find(opt => 
          opt.value.toLowerCase() === value.toString().toLowerCase() ||
          opt.text.toLowerCase().includes(value.toString().toLowerCase())
        );
        if (matched) input.value = matched.value;
      } else if (input.type === 'radio' || input.type === 'checkbox') {
        if (input.value.toLowerCase() === value.toString().toLowerCase()) {
          input.checked = true;
        }
      } else {
        input.value = value;
      }
      
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      input.classList.add('vh-filled');
      
      success++;
      console.log(`✅ [${idx}] ${fieldInfo.label_cn} = ${value}`);
    } catch (e) {
      console.warn(`❌ [${idx}] ${fieldInfo.label_cn} 失败`, e);
    }
  });
  
  console.log(`✅ 填充完成: ${success}个字段`);
  if (success > 0) {
    showNotification(`✅ 已填充 ${success} 个字段`, 'success');
  } else {
    showNotification('⚠️ 未能填充任何字段', 'warning');
  }
}

function getValueFromUserData(key) {
  const paths = {
    'full_name': 'personalInfo.full_name',
    'surname': 'personalInfo.surname',
    'given_name': 'personalInfo.given_name',
    'date_of_birth': 'personalInfo.date_of_birth',
    'gender': 'personalInfo.gender',
    'nationality': 'personalInfo.nationality',
    'passport_number': 'personalInfo.passport_number',
    'passport_expiry': 'personalInfo.passport_expiry',
    'religion': 'personalInfo.religion',
    'place_of_birth': 'personalInfo.place_of_birth',
    'email': 'contactInfo.email',
    'phone': 'contactInfo.phone',
    'purpose': 'travelInfo.purpose',
    'duration': 'travelInfo.duration',
    'arrival_date': 'travelInfo.arrival_date',
    'departure_date': 'travelInfo.departure_date',
    'arrival_city': 'travelInfo.arrival_city',
    'destination_address': 'travelInfo.destination_address'
  };
  
  const path = paths[key];
  if (!path) return undefined;
  
  let value = userData;
  for (const p of path.split('.')) {
    value = value?.[p];
  }
  return value;
}

// ===== DISCLAIMER PAGE HANDLER =====

function handleDisclaimerPage() {
  console.log('📋 处理Disclaimer页面');
  showTopGuidance('📋 请阅读并勾选同意条款');
  
  // Show guide
  const guide = document.createElement('div');
  guide.className = 'vh-disclaimer-guide';
  guide.innerHTML = `
    <div style="background:#fff3cd;border:2px solid#ffc107;border-radius:8px;padding:15px;margin:15px 0;color:#856404">
      <strong>👇 按照以下步骤操作:</strong>
      <ol style="margin-top:10px">
        <li>向下滚动阅读完整条款</li>
        <li>阅读到底部时会自动勾选</li>
        <li>Next按钮会自动启用</li>
        <li>点击Next继续申请</li>
      </ol>
    </div>
  `;
  document.querySelector('.vh-panel-body')?.insertBefore(guide, document.querySelector('.vh-panel-body').firstChild);
  
  const content = findDisclaimerContent();
  if (content) {
    setupScrollDetection(content);
  }
  
  setupDisclaimerCheckbox();
  
  const nextBtn = findNextButton();
  if (nextBtn) {
    nextBtn.disabled = true;
    nextBtn.style.opacity = '0.5';
  }
}

function findDisclaimerContent() {
  const selectors = [
    '.disclaimer-content',
    '.terms-content',
    '.modal-body',
    'article',
    'main',
    '.content-scroll',
    'div[style*="overflow"]'
  ];
  
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.scrollHeight > 200) return el;
  }
  
  return null;
}

function setupScrollDetection(element) {
  element.addEventListener('scroll', () => {
    const scrolled = element.scrollTop + element.clientHeight;
    const total = element.scrollHeight;
    const percent = (scrolled / total) * 100;
    
    if (percent >= 90) {
      disclaimerScrolled = true;
      console.log('✅ 已阅读到底部');
      
      const checkbox = findDisclaimerCheckbox();
      if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('✅ 已自动勾选同意');
      }
      
      const nextBtn = findNextButton();
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
        nextBtn.classList.add('vh-apply-highlight');
        showNotification('✅ 现在可以点击Next', 'success');
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
      showNotification(e.target.checked ? '✅ 已勾选' : '⚠️ 请勾选', 'info');
    });
  }
}

function findNextButton() {
  const buttons = Array.from(document.querySelectorAll('button, a'));
  return buttons.find(btn => {
    const text = btn.textContent?.toLowerCase() || '';
    return text.includes('next') || text.includes('下一步') || text.includes('继续');
  });
}

// ===== UI HELPERS =====

function injectFloatingPanel() {
  if (document.getElementById('visa-helper-panel')) return;
  
  const panel = document.createElement('div');
  panel.id = 'visa-helper-panel';
  panel.innerHTML = `
    <div class="vh-panel-header">
      <span>🇻🇳 v1.2.1</span>
      <button id="vh-minimize">−</button>
    </div>
    <div class="vh-panel-body">
      <button id="vh-toggle-autofill" class="vh-btn">
        <span id="vh-autofill-status">🔴</span> 一键填表
      </button>
      <button id="vh-show-data" class="vh-btn">📋 数据</button>
      <button id="vh-help" class="vh-btn">🆘 帮助</button>
      <div id="vh-stats"><small>就绪</small></div>
    </div>
  `;
  document.body.appendChild(panel);
  
  document.getElementById('vh-toggle-autofill')?.addEventListener('click', toggleAutoFill);
  document.getElementById('vh-show-data')?.addEventListener('click', showUserData);
  document.getElementById('vh-help')?.addEventListener('click', showHelp);
  document.getElementById('vh-minimize')?.addEventListener('click', () => {
    panel.classList.toggle('minimized');
  });
}

function showUserData() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10001';
  modal.innerHTML = `
    <div style="background:white;padding:20px;border-radius:8px;max-width:500px;max-height:80vh;overflow-y:auto">
      <h3>📋 你的信息</h3>
      <pre style="font-size:12px;background:#f5f5f5;padding:10px;border-radius:4px">${JSON.stringify(userData, null, 2)}</pre>
      <button onclick="this.closest('div').parentElement.remove()" style="background:#28a745;color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer">关闭</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function showHelp() {
  showNotification('📖 首页:点Apply | 表单:点"一键填表" | Disclaimer:下滑+勾选', 'info');
}

function showTopGuidance(msg) {
  if (document.querySelector('.vh-top-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'vh-top-banner';
  banner.textContent = msg;
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#28a745;color:white;padding:12px;text-align:center;z-index:10000;animation:slideDown .3s';
  document.body.insertBefore(banner, document.body.firstChild);
  setTimeout(() => banner.remove(), 5000);
}

function showNotification(msg, type = 'info') {
  const notif = document.createElement('div');
  notif.style.cssText = `position:fixed;bottom:80px;right:20px;background:${type==='success'?'#28a745':type==='error'?'#dc3545':'#17a2b8'};color:white;padding:12px 20px;border-radius:6px;z-index:10000`;
  notif.textContent = msg;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

console.log('✅ v1.2.1 加载完成');
