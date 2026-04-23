/**
 * 改进的越南签证表单自动填充逻辑（集成版本）
 * 这将替代现有的 fillAllFields 函数，提供更好的字段识别和填充能力
 */

// ===== 改进的 fillAllFields 函数 =====
async function fillAllFieldsImproved() {
  console.log('📝 开始改进的自动填表...');
  
  // 第 1 阶段：填充标准输入字段
  console.log('\n📊 第 1 阶段：填充标准输入字段');
  const standardInputs = document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
  let standardSuccess = 0;
  
  standardInputs.forEach((input, idx) => {
    const fieldInfo = identifyField(input);
    if (!fieldInfo?.key) return;
    
    const value = getValueFromUserData(fieldInfo.key);
    if (!value) return;
    
    try {
      if (input.tagName === 'SELECT') {
        fillSelectField(input, value, fieldInfo);
      } else if (input.type === 'date' || isDateField(input)) {
        fillDateField(input, value, fieldInfo);
      } else {
        fillTextInput(input, value);
      }
      standardSuccess++;
      input.classList.add('vh-filled');
    } catch (e) {
      console.warn(`❌ ${fieldInfo.label_cn}:`, e.message);
    }
  });
  
  console.log(`✅ 标准字段填充: ${standardSuccess}/${standardInputs.length}`);
  
  // 等待浏览器渲染
  await new Promise(r => setTimeout(r, 300));
  
  // 第 2 阶段：填充 Ant Design 组件（Select 和 DatePicker）
  console.log('\n📊 第 2 阶段：填充 Ant Design 组件');
  
  // 处理 Ant Design Select
  console.log('\n  → 处理 Ant Select...');
  const antSelects = document.querySelectorAll('.ant-select');
  let selectSuccess = 0;
  
  for (const selectContainer of antSelects) {
    // 跳过已经填充的
    if (selectContainer.classList.contains('vh-filled')) continue;
    
    const fieldInfo = identifyAntSelectField(selectContainer);
    if (!fieldInfo) continue;
    
    const value = getValueFromUserData(fieldInfo.key);
    if (!value) continue;
    
    if (await fillAntSelectSmart(selectContainer, value)) {
      selectSuccess++;
      selectContainer.classList.add('vh-filled');
    }
  }
  
  console.log(`  ✅ Ant Select: ${selectSuccess}`);
  
  await new Promise(r => setTimeout(r, 300));
  
  // 处理 Ant Design DatePicker
  console.log('\n  → 处理 Ant DatePicker...');
  const antPickers = document.querySelectorAll('.ant-picker');
  let pickerSuccess = 0;
  
  for (const picker of antPickers) {
    // 跳过已经填充的
    if (picker.classList.contains('vh-filled')) continue;
    
    const fieldInfo = identifyAntPickerField(picker);
    if (!fieldInfo) continue;
    
    const value = getValueFromUserData(fieldInfo.key);
    if (!value) continue;
    
    if (await fillAntPickerSmart(picker, value)) {
      pickerSuccess++;
      picker.classList.add('vh-filled');
    }
  }
  
  console.log(`  ✅ Ant DatePicker: ${pickerSuccess}`);
  
  await new Promise(r => setTimeout(r, 300));
  
  // 第 3 阶段：填充复选框和单选框
  console.log('\n📊 第 3 阶段：填充复选框和单选框');
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  let checkboxSuccess = 0;
  
  checkboxes.forEach(checkbox => {
    const fieldInfo = identifyField(checkbox);
    if (!fieldInfo?.key) return;
    
    const value = getValueFromUserData(fieldInfo.key);
    if (value === 'on' || value === true || value === 'yes' || value === 'Yes') {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      checkbox.dispatchEvent(new Event('click', { bubbles: true }));
      checkboxSuccess++;
      
      // 也点击父容器（Ant Design 样式）
      const wrapper = checkbox.closest('.ant-checkbox');
      if (wrapper) wrapper.click?.();
    }
  });
  
  console.log(`✅ 复选框: ${checkboxSuccess}`);
  
  // 最终报告
  const totalSuccess = standardSuccess + selectSuccess + pickerSuccess + checkboxSuccess;
  console.log(`\n✨ 总计填充: ${totalSuccess} 个字段\n`);
  
  return {
    standardSuccess,
    selectSuccess,
    pickerSuccess,
    checkboxSuccess,
    totalSuccess
  };
}

// ===== 识别 Ant Design Select =====
function identifyAntSelectField(selectContainer) {
  // 从 Select 容器的文本推断字段
  const parentText = selectContainer.parentElement?.textContent || '';
  const label = selectContainer.previousElementSibling?.textContent || parentText;
  const allText = `${label} ${selectContainer.className}`.toLowerCase();
  
  // 检查与已知字段的匹配
  const fieldMappings = {
    'gender': { keys: ['gender', 'sex', 'giới tính', '性别'], field: 'gender' },
    'nationality': { keys: ['nationality', 'quốc tịch', '国籍'], field: 'nationality' },
    'visa_type': { keys: ['single', 'multiple', 'entry type'], field: 'visa_type' },
    'passport_type': { keys: ['passport', 'type', 'loại'], field: 'passport_type' },
    'purpose': { keys: ['purpose', 'entry', 'mục đích', '目的'], field: 'purpose' },
    'occupation': { keys: ['occupation', 'nghề', '职业'], field: 'occupation' },
    'province_city': { keys: ['province', 'city', 'tỉnh/thành phố', '省市'], field: 'province_city' },
    'ward_commune': { keys: ['ward', 'commune', 'xã phường', '乡镇'], field: 'ward_commune' },
    'intended_border_gate_of_entry': { keys: ['border', 'entry', 'cửa khẩu vào', '边境入口'], field: 'intended_border_gate_of_entry' },
    'intended_border_gate_of_exit': { keys: ['border', 'exit', 'cửa khẩu ra', '边境出口'], field: 'intended_border_gate_of_exit' },
    'bought_insurance': { keys: ['insurance', 'buy', 'bảo hiểm', '保险'], field: 'bought_insurance' },
    'expense_coverage': { keys: ['cover', 'expense', 'ai sẽ', 'who will', '谁会'], field: 'expense_coverage' }
  };
  
  for (const [key, config] of Object.entries(fieldMappings)) {
    if (config.keys.some(k => allText.includes(k))) {
      return { key: config.field, label_cn: key };
    }
  }
  
  return null;
}

// ===== 识别 Ant Design DatePicker =====
function identifyAntPickerField(picker) {
  const parentText = picker.parentElement?.textContent || '';
  const label = picker.previousElementSibling?.textContent || parentText;
  const allText = `${label} ${picker.className}`.toLowerCase();
  
  const fieldMappings = {
    'date_of_birth': { keys: ['birth', 'dob', 'ngày sinh', '出生日期'], field: 'date_of_birth' },
    'passport_date_of_issue': { keys: ['issue', 'issued', 'ngày cấp', '签发日期'], field: 'passport_date_of_issue' },
    'passport_expiry': { keys: ['expir', 'expiry', 'hết hạn', '到期日期'], field: 'passport_expiry' },
    'intended_date_of_entry': { keys: ['entry', 'arrival', 'ngày vào', '入境日期'], field: 'intended_date_of_entry' },
    'visa_valid_from': { keys: ['valid', 'from', 'hạn dùng', '有效期'], field: 'visa_valid_from' },
    'visa_valid_to': { keys: ['valid', 'to', 'hết hạn', '到期'], field: 'visa_valid_to' }
  };
  
  for (const [key, config] of Object.entries(fieldMappings)) {
    if (config.keys.some(k => allText.includes(k))) {
      return { key: config.field, label_cn: key };
    }
  }
  
  return null;
}

// ===== 智能填充 Ant Design Select =====
async function fillAntSelectSmart(selectContainer, value) {
  return new Promise((resolve) => {
    try {
      // 点击打开下拉菜单
      selectContainer.click();
      
      // 等待菜单打开
      setTimeout(() => {
        const dropdown = document.querySelector('.ant-select-dropdown');
        if (!dropdown) {
          console.warn('   ⚠️ 下拉菜单未打开');
          resolve(false);
          return;
        }
        
        const options = dropdown.querySelectorAll('.ant-select-item');
        let found = false;
        
        // 尝试找到匹配的选项
        for (const opt of options) {
          const optText = opt.textContent.toLowerCase().trim();
          const optValue = opt.getAttribute('data-value') || '';
          const searchValue = value.toString().toLowerCase().trim();
          
          // 多重匹配条件
          if (
            optText === searchValue ||
            optText.includes(searchValue) ||
            optValue === value ||
            optValue.toLowerCase() === searchValue
          ) {
            opt.click();
            found = true;
            console.log(`   ✅ 找到并选择: ${opt.textContent}`);
            break;
          }
        }
        
        if (!found) {
          console.warn(`   ⚠️ 未找到选项: ${value}`);
        }
        
        resolve(found);
      }, 150);
    } catch (e) {
      console.error('   ❌ Select 填充错误:', e.message);
      resolve(false);
    }
  });
}

// ===== 智能填充 Ant Design DatePicker =====
async function fillAntPickerSmart(picker, value) {
  return new Promise((resolve) => {
    try {
      const input = picker.querySelector('.ant-picker-input');
      if (!input) {
        console.warn('   ⚠️ DatePicker 输入框未找到');
        resolve(false);
        return;
      }
      
      // 直接设置输入框的值
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      
      console.log(`   ✅ 设置日期: ${value}`);
      
      // 点击以打开日期选择器（可选）
      const trigger = picker.querySelector('.ant-picker-suffix');
      if (trigger) {
        trigger.click();
        
        setTimeout(() => {
          // 尝试点击确认按钮
          const okBtn = document.querySelector('.ant-picker-ok');
          if (okBtn) {
            okBtn.click();
            console.log(`   ✅ 确认日期选择`);
          }
        }, 200);
      }
      
      resolve(true);
    } catch (e) {
      console.error('   ❌ DatePicker 填充错误:', e.message);
      resolve(false);
    }
  });
}

// ===== 辅助函数：填充文本输入 =====
function fillTextInput(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
}

// ===== 辅助函数：检查是否是日期字段 =====
function isDateField(input) {
  const placeholder = (input.placeholder || '').toLowerCase();
  const name = (input.name || '').toLowerCase();
  const id = (input.id || '').toLowerCase();
  const parent = (input.parentElement?.textContent || '').toLowerCase();
  
  const dateKeywords = ['date', 'birth', 'issue', 'expir', 'entry', 'exit', 'valid', 'dd/mm', 'mm/dd', 'ngày', '日期'];
  const allText = `${placeholder} ${name} ${id} ${parent}`;
  
  return dateKeywords.some(keyword => allText.includes(keyword));
}

// ===== 导出 =====
window.fillAllFieldsImproved = fillAllFieldsImproved;

console.log('✅ 改进的自动填充脚本已加载');
console.log('🚀 运行: await fillAllFieldsImproved()\n');
