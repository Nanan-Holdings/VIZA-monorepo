/**
 * 越南签证表单填充测试脚本
 * 在浏览器控制台中运行此脚本来测试所有字段的读取和填充
 */

const testData = {
  personalInfo: {
    surname: "ZHANG",
    given_name: "SAN",
    full_name: "Zhang San",
    date_of_birth: "01/01/1990",
    gender: "male",
    nationality: "China",
    identity_card: "310101199001011234",
    religion: "Buddhism",
    place_of_birth: "Shanghai, China"
  },
  contactInfo: {
    email: "zhangsan@example.com",
    phone: "+8601234567890",
    phone_in_vietnam: "+84912345678"
  },
  travelInfo: {
    purpose: "Tourism",
    duration: "14",
    arrival_date: "15/06/2026",
    departure_date: "29/06/2026",
    intended_date_of_entry: "15/06/2026",
    intended_length_of_stay: "14",
    arrival_city: "Hanoi",
    destination_address: "123 Tran Hung Dao Street, Hanoi, Vietnam",
    province_city: "Hanoi",
    ward_commune: "Ba Dinh"
  },
  visaInfo: {
    visa_type: "single",
    visa_valid_from: "15/06/2026",
    visa_valid_to: "15/07/2026",
    passport_number: "E12345678",
    passport_issue_authority: "Shanghai Public Security Bureau",
    passport_type: "ordinary",
    passport_date_of_issue: "01/01/2020",
    passport_expiry: "01/01/2030",
    intended_border_gate_of_entry: "Noi Bai",
    intended_border_gate_of_exit: "Noi Bai"
  },
  occupationInfo: {
    occupation: "Engineer",
    occupation_info: "Software Engineer",
    company_name: "Tech Company Ltd.",
    position_course: "Senior Software Engineer",
    company_address: "123 Business District, Hanoi, Vietnam",
    company_phone: "+84912345678"
  },
  confirmations: {
    legal_declaration: "on",
    temporary_residence_declaration: "on"
  },
  contactInfo_emergency: {
    emergency_contact_name: "Li Si",
    emergency_contact_relationship: "friend",
    emergency_contact_phone: "+8612345678902",
    emergency_contact_current_address: "123 Tran Hung Dao Street, Hanoi, Vietnam"
  },
  tripExpenses: {
    intended_expenses: "1000",
    bought_insurance: "No",
    expense_coverage: "Myself"
  }
};

console.clear();
console.log("🔍 开始分析表单字段...\n");

// ===== 第 1 步：分析所有输入字段 =====
const allInputs = document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
console.log(`📊 发现 ${allInputs.length} 个表单字段\n`);

let fieldAnalysis = {
  textInputs: [],
  dateInputs: [],
  selectFields: [],
  textareas: [],
  antSelects: [],
  antPickers: [],
  other: []
};

allInputs.forEach((field, idx) => {
  const fieldInfo = {
    index: idx,
    type: field.type || field.tagName.toLowerCase(),
    placeholder: field.placeholder || '',
    name: field.name || '',
    id: field.id || '',
    value: field.value || '',
    label: field.previousElementSibling?.textContent?.substring(0, 40) || '',
    parentLabel: field.parentElement?.textContent?.substring(0, 60) || '',
    ariaLabel: field.getAttribute('aria-label') || '',
    element: field
  };

  // 分类字段
  if (field.type === 'date') {
    fieldAnalysis.dateInputs.push(fieldInfo);
  } else if (field.tagName === 'SELECT') {
    fieldAnalysis.selectFields.push(fieldInfo);
  } else if (field.tagName === 'TEXTAREA') {
    fieldAnalysis.textareas.push(fieldInfo);
  } else if (field.closest('.ant-select')) {
    // Ant Design Select
    fieldAnalysis.antSelects.push({
      ...fieldInfo,
      antContainer: field.closest('.ant-select')
    });
  } else if (field.closest('.ant-picker')) {
    // Ant Design DatePicker
    fieldAnalysis.antPickers.push({
      ...fieldInfo,
      antContainer: field.closest('.ant-picker')
    });
  } else {
    fieldAnalysis.textInputs.push(fieldInfo);
  }
});

// 输出分析结果
console.log("=== 文本输入字段 ===");
fieldAnalysis.textInputs.forEach((f, i) => {
  console.log(`[${i}] ${f.label || f.parentLabel} | type: ${f.type} | current: "${f.value}"`);
});

console.log("\n=== 日期输入字段 (HTML5 <input type='date'>) ===");
fieldAnalysis.dateInputs.forEach((f, i) => {
  console.log(`[${i}] ${f.label || f.parentLabel} | type: ${f.type} | current: "${f.value}"`);
});

console.log("\n=== 原始 SELECT 选择框 ===");
fieldAnalysis.selectFields.forEach((f, i) => {
  const options = Array.from(f.element.querySelectorAll('option')).map(o => o.textContent).join(', ');
  console.log(`[${i}] ${f.label || f.parentLabel} | options: ${options}`);
});

console.log("\n=== Ant Design Select 组件 ===");
fieldAnalysis.antSelects.forEach((f, i) => {
  const displayText = f.antContainer?.querySelector('.ant-select-selection-item')?.textContent || 'empty';
  console.log(`[${i}] ${f.label || f.parentLabel} | current: "${displayText}"`);
});

console.log("\n=== Ant Design DatePicker 组件 ===");
fieldAnalysis.antPickers.forEach((f, i) => {
  const displayText = f.antContainer?.querySelector('.ant-picker-input')?.value || 'empty';
  console.log(`[${i}] ${f.label || f.parentLabel} | current: "${displayText}"`);
});

console.log("\n=== 其他字段 ===");
if (fieldAnalysis.textareas.length > 0) {
  fieldAnalysis.textareas.forEach((f, i) => {
    console.log(`[${i}] TEXTAREA | ${f.label || f.parentLabel}`);
  });
}

// ===== 第 2 步：尝试填充字段的辅助函数 =====
window.testFillForm = {
  // 通用的 Ant Design DatePicker 填充函数
  fillAntDatePicker(pickerElement, dateValue) {
    if (!pickerElement) return false;
    
    const input = pickerElement.querySelector('.ant-picker-input');
    if (!input) return false;
    
    console.log(`   ↳ 尝试填充 DatePicker: ${dateValue}`);
    
    // 方法 1：直接设置 input 值
    input.value = dateValue;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    
    // 方法 2：点击打开选择器
    const trigger = pickerElement.querySelector('.ant-picker-suffix');
    if (trigger) {
      trigger.click();
      setTimeout(() => {
        // 尝试在打开的日期选择器中输入
        const activeInput = document.querySelector('.ant-picker-input:focus') || document.querySelector('.ant-picker-input');
        if (activeInput && activeInput !== input) {
          activeInput.value = dateValue;
          activeInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        // 尝试点击确认按钮
        document.querySelector('.ant-picker-ok')?.click();
      }, 200);
    }
    
    return true;
  },

  // 通用的 Ant Design Select 填充函数
  fillAntSelect(selectElement, value) {
    if (!selectElement) return false;
    
    console.log(`   ↳ 尝试填充 Select: ${value}`);
    
    // method 1: 点击打开
    selectElement.click();
    
    setTimeout(() => {
      // 查找下拉菜单中的选项
      const dropdown = document.querySelector('.ant-select-dropdown');
      if (!dropdown) {
        console.log(`   ⚠️ 没有找到下拉菜单`);
        return;
      }
      
      const options = dropdown.querySelectorAll('.ant-select-item');
      let found = false;
      
      options.forEach(opt => {
        const optText = opt.textContent.toLowerCase().trim();
        const optValue = opt.getAttribute('data-value') || '';
        const searchValue = value.toString().toLowerCase().trim();
        
        if (optText.includes(searchValue) || optText === searchValue || optValue === value) {
          console.log(`   ✅ 找到匹配的选项: ${opt.textContent}`);
          opt.click();
          found = true;
        }
      });
      
      if (!found) {
        console.log(`   ℹ️ 没有找到精确匹配，可用选项:`);
        options.forEach(opt => {
          console.log(`      - ${opt.textContent}`);
        });
      }
    }, 150);
    
    return true;
  },

  // 填充文本输入
  fillTextInput(inputElement, value) {
    if (!inputElement) return false;
    inputElement.value = value;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  },

  // 勾选复选框
  checkCheckbox(checkboxElement) {
    if (!checkboxElement) return false;
    
    // Try to find the actual checkbox or its wrapper
    let checkbox = checkboxElement;
    if (!checkbox.type || checkbox.type !== 'checkbox') {
      checkbox = checkboxElement.querySelector('input[type="checkbox"]');
    }
    if (!checkbox) return false;
    
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    checkbox.dispatchEvent(new Event('click', { bubbles: true }));
    return true;
  }
};

// ===== 第 3 步：报告信息 =====
console.log("\n\n✅ 分析完成！可用的函数:");
console.log("  • testFillForm.fillTextInput(element, value)");
console.log("  • testFillForm.fillAntDatePicker(element, 'DD/MM/YYYY')");
console.log("  • testFillForm.fillAntSelect(element, 'option-value')");
console.log("  • testFillForm.checkCheckbox(element)");
console.log("\n📋 测试数据已保存到 testData 变量");
console.log("📊 字段分析已保存到 fieldAnalysis 变量\n");

// 导出用于测试
window.fieldAnalysis = fieldAnalysis;
window.testData = testData;

console.log("🧪 现在你可以手动测试填充，例如:\n");
console.log("  testFillForm.fillTextInput(fieldAnalysis.textInputs[0].element, testData.personalInfo.surname)");
console.log("  testFillForm.fillAntDatePicker(fieldAnalysis.antPickers[0].antContainer, '01/01/1990')");
console.log("  testFillForm.fillAntSelect(fieldAnalysis.antSelects[0].antContainer, 'male')");
