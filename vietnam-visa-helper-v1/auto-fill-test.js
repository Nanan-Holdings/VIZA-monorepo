/**
 * 越南签证表单完整的自动填充脚本 v2
 * 这个脚本会自动尝试填充表单中的所有字段
 */

const formFiller = {
  // 测试数据
  testData: {
    personalInfo: {
      surname: "ZHANG",
      given_name: "SAN",
      date_of_birth: "01/01/1990",
      gender: "male",
      nationality: "China",
      identity_card: "310101199001011234",
      religion: "Buddhism",
      place_of_birth: "Shanghai, China"
    },
    contactInfo: {
      email: "zhangsan@example.com",
      phone: "+8612345678901",
      phone_in_vietnam: "+84912345678"
    },
    emergencyContact: {
      emergency_contact_name: "Li Si",
      emergency_contact_relationship: "friend",
      emergency_contact_phone: "+8612345678902",
      emergency_contact_current_address: "123 Tran Hung Dao Street, Hanoi, Vietnam"
    },
    occupationInfo: {
      occupation: "Engineer",
      occupation_info: "Software Engineer",
      company_name: "Tech Company Ltd.",
      position_course: "Senior Software Engineer",
      company_address: "123 Business District, Hanoi, Vietnam",
      company_phone: "+84912345678"
    },
    travelInfo: {
      purpose: "Tourism",
      intended_date_of_entry: "15/06/2026",
      intended_length_of_stay: "14",
      destination_address: "123 Tran Hung Dao Street, Hanoi, Vietnam",
      contact_address: "123 Tran Hung Dao Street, Hanoi, Vietnam",
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
    tripExpenses: {
      intended_expenses: "1000",
      bought_insurance: "No",
      expense_coverage: "Myself"
    },
    confirmations: {
      legal_declaration: true,
      temporary_residence_declaration: true
    }
  },

  // 字段映射：如何识别和填充每个字段
  fieldMappings: {
    // 文本字段映射 - 根据 label、placeholder、name、id 匹配
    textFields: {
      surname: { matchers: ['surname', 'last name', 'family name'], value: 'ZHANG' },
      given_name: { matchers: ['given', 'first name', 'middle name'], value: 'SAN' },
      identity_card: { matchers: ['identity card', 'id card', 'identity number'], value: '310101199001011234' },
      email: { matchers: ['email'], value: 'zhangsan@example.com' },
      phone: { matchers: ['phone number', 'telephone', 'mobile'], value: '+8612345678901' },
      phone_in_vietnam: { matchers: ['phone', 'vietnam'], value: '+84912345678' },
      place_of_birth: { matchers: ['place of birth', 'born'], value: 'Shanghai, China' },
      passport_number: { matchers: ['passport', 'passport number'], value: 'E12345678' },
      passport_issue_authority: { matchers: ['issuing', 'issue', 'authority'], value: 'Shanghai Public Security Bureau' },
      company_name: { matchers: ['company', 'agency', 'school', 'name'], value: 'Tech Company Ltd.' },
      position_course: { matchers: ['position', 'course', 'study'], value: 'Senior Software Engineer' },
      company_address: { matchers: ['company', 'address'], value: '123 Business District, Hanoi, Vietnam' },
      company_phone: { matchers: ['company', 'phone'], value: '+84912345678' },
      destination_address: { matchers: ['address', 'destination', 'residential'], value: '123 Tran Hung Dao Street, Hanoi, Vietnam' },
      contact_address: { matchers: ['contact', 'address'], value: '123 Tran Hung Dao Street, Hanoi, Vietnam' },
      emergency_contact_name: { matchers: ['emergency', 'full name'], value: 'Li Si' },
      emergency_contact_phone: { matchers: ['emergency', 'phone', 'telephone'], value: '+8612345678902' },
      emergency_contact_current_address: { matchers: ['emergency', 'address'], value: '123 Tran Hung Dao Street, Hanoi, Vietnam' },
      occupation_info: { matchers: ['occupation', 'info'], value: 'Software Engineer' },
      intended_expenses: { matchers: ['expense', 'expenses'], value: '1000' },
      intended_length_of_stay: { matchers: ['stay', 'length'], value: '14' }
    },

    // 日期字段映射
    dateFields: {
      date_of_birth: { matchers: ['birth', 'dob'], value: '01/01/1990' },
      passport_date_of_issue: { matchers: ['issue', 'issued'], value: '01/01/2020' },
      passport_expiry: { matchers: ['expiry', 'expir', 'valid'], value: '01/01/2030' },
      intended_date_of_entry: { matchers: ['entry', 'arrival'], value: '15/06/2026' },
      visa_valid_from: { matchers: ['visa', 'valid', 'from'], value: '15/06/2026' },
      visa_valid_to: { matchers: ['visa', 'valid', 'to'], value: '15/07/2026' }
    },

    // 选择字段映射
    selectFields: {
      gender: { matchers: ['gender', 'sex'], options: { male: ['male', 'm', '男'], female: ['female', 'f', '女'] }, value: 'male' },
      nationality: { matchers: ['nationality'], options: { China: ['china', '中国'] }, value: 'China' },
      religion: { matchers: ['religion'], options: { Buddhism: ['buddhism', 'buddhist', '佛教'] }, value: 'Buddhism' },
      visa_type: { matchers: ['issue', 'single', 'multiple', 'entry type'], options: { single: ['single'], multiple: ['multiple'] }, value: 'single' },
      passport_type: { matchers: ['passport', 'type'], options: { ordinary: ['ordinary', '普通'], official: ['official'], diplomatic: ['diplomatic'] }, value: 'ordinary' },
      purpose: { matchers: ['purpose', 'reason'], options: { Tourism: ['tourism', '旅游'], Business: ['business', '商务'], Visiting: ['visiting', '访问'] }, value: 'Tourism' },
      occupation: { matchers: ['occupation'], options: { Engineer: ['engineer', '工程师'] }, value: 'Engineer' },
      province_city: { matchers: ['province', 'city'], options: { Hanoi: ['hanoi', '河内'] }, value: 'Hanoi' },
      ward_commune: { matchers: ['ward', 'commune', 'district'], options: { 'Ba Dinh': ['ba dinh', '巴亭'] }, value: 'Ba Dinh' },
      intended_border_gate_of_entry: { matchers: ['border', 'entry', 'gate'], options: { 'Noi Bai': ['noi bai'] }, value: 'Noi Bai' },
      intended_border_gate_of_exit: { matchers: ['border', 'exit', 'gate'], options: { 'Noi Bai': ['noi bai'] }, value: 'Noi Bai' },
      bought_insurance: { matchers: ['insurance'], options: { Yes: ['yes', '是'], No: ['no', '否'] }, value: 'No' },
      expense_coverage: { matchers: ['cover', 'expense'], options: { Myself: ['myself'], Family: ['family'], Employer: ['employer'] }, value: 'Myself' }
    },

    // 复选框字段映射
    checkboxFields: {
      legal_declaration: { matchers: ['declare', 'statement', 'responsible'], checked: true },
      temporary_residence_declaration: { matchers: ['temporary', 'residence'], checked: true }
    }
  },

  // 日志数组
  log: [],
  success: [],
  failed: [],
  warnings: [],

  report() {
    console.log("\n" + "=".repeat(60));
    console.log("📋 表单填充报告");
    console.log("=".repeat(60) + "\n");

    if (this.success.length > 0) {
      console.log(`✅ 成功填充 ${this.success.length} 个字段:`);
      this.success.forEach(s => console.log(`   ✓ ${s}`));
    }

    if (this.warnings.length > 0) {
      console.log(`\n⚠️ 警告 ${this.warnings.length} 个:`);
      this.warnings.forEach(w => console.log(`   ! ${w}`));
    }

    if (this.failed.length > 0) {
      console.log(`\n❌ 失败 ${this.failed.length} 个字段:`);
      this.failed.forEach(f => console.log(`   ✗ ${f}`));
    }

    console.log("\n" + "=".repeat(60) + "\n");

    // 保存报告
    window.fillFormReport = {
      success: this.success,
      warnings: this.warnings,
      failed: this.failed,
      timestamp: new Date().toISOString()
    };
  },

  // 获取字段的所有文本信息
  getFieldText(element) {
    const texts = [];
    
    // placeholder
    if (element.placeholder) texts.push(element.placeholder.toLowerCase());
    
    // name
    if (element.name) texts.push(element.name.toLowerCase());
    
    // id
    if (element.id) texts.push(element.id.toLowerCase());
    
    // label
    const labelElement = element.closest('label') || document.querySelector(`label[for="${element.id}"]`);
    if (labelElement) texts.push(labelElement.textContent.toLowerCase());
    
    // aria-label
    if (element.getAttribute('aria-label')) texts.push(element.getAttribute('aria-label').toLowerCase());
    
    // parent text
    let parent = element.parentElement;
    for (let i = 0; i < 3 && parent; i++) {
      texts.push(parent.textContent.substring(0, 100).toLowerCase());
      parent = parent.parentElement;
    }
    
    return texts.join(' ');
  },

  // 检查字段是否匹配
  matchField(fieldText, matchers) {
    if (!Array.isArray(matchers)) matchers = [matchers];
    return matchers.some(matcher => fieldText.includes(matcher.toLowerCase()));
  },

  // 填充文本字段
  fillTextInput(element, value) {
    try {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));
      this.success.push(`Text: ${value}`);
      return true;
    } catch (e) {
      this.failed.push(`Text input: ${e.message}`);
      return false;
    }
  },

  // 填充日期选择器 (Ant Design DatePicker)
  fillAntDatePicker(pickerElement, value) {
    try {
      const input = pickerElement.querySelector('.ant-picker-input');
      if (!input) throw new Error('DatePicker input not found');

      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      
      // 尝试打开并确认
      const trigger = pickerElement.querySelector('.ant-picker-suffix');
      if (trigger) {
        trigger.click();
        setTimeout(() => {
          const okBtn = document.querySelector('.ant-picker-ok');
          if (okBtn) okBtn.click();
        }, 100);
      }
      
      this.success.push(`DatePicker: ${value}`);
      return true;
    } catch (e) {
      this.warnings.push(`DatePicker failed: ${e.message}, will retry with direct input`);
      return false;
    }
  },

  // 填充 Ant Design Select
  fillAntSelect(selectElement, value) {
    try {
      selectElement.click();
      
      setTimeout(() => {
        const options = document.querySelectorAll('.ant-select-item');
        let found = false;
        
        options.forEach(opt => {
          const optText = opt.textContent.toLowerCase().trim();
          if (optText.includes(value.toLowerCase()) || optText === value.toLowerCase()) {
            opt.click();
            found = true;
          }
        });
        
        if (found) {
          this.success.push(`Select: ${value}`);
        } else {
          this.warnings.push(`Select value not found for: ${value}`);
        }
      }, 100);
      
      return true;
    } catch (e) {
      this.failed.push(`Select filling: ${e.message}`);
      return false;
    }
  },

  // 填充复选框
  fillCheckbox(element, checked = true) {
    try {
      let checkbox = element;
      if (element.type !== 'checkbox') {
        checkbox = element.querySelector('input[type="checkbox"]') || element;
      }
      
      checkbox.checked = checked;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      checkbox.dispatchEvent(new Event('click', { bubbles: true }));
      
      this.success.push(`Checkbox: ${checked ? 'checked' : 'unchecked'}`);
      return true;
    } catch (e) {
      this.failed.push(`Checkbox: ${e.message}`);
      return false;
    }
  },

  // 主填充函数
  async fillAllFields() {
    console.clear();
    console.log("🚀 开始自动填充表单...\n");

    // 获取所有输入字段
    const allInputs = document.querySelectorAll(
      'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="submit"]):not([type="button"]), ' +
      'select, textarea, [role="combobox"], .ant-select, .ant-picker, input[type="checkbox"]'
    );

    console.log(`📊 发现 ${allInputs.length} 个潜在字段\n`);

    let textFilledCount = 0;
    let dateFilledCount = 0;
    let selectFilledCount = 0;
    let checkboxFilledCount = 0;

    // 遍历所有字段
    allInputs.forEach((element, idx) => {
      const fieldText = this.getFieldText(element);
      const isAntSelect = element.closest('.ant-select') !== null;
      const isAntPicker = element.closest('.ant-picker') !== null;
      const isCheckbox = element.type === 'checkbox';

      // 尝试匹配文本字段
      for (const [key, config] of Object.entries(this.fieldMappings.textFields)) {
        if (this.matchField(fieldText, config.matchers)) {
          if (isAntSelect) {
            this.fillAntSelect(element.closest('.ant-select'), config.value);
            selectFilledCount++;
          } else if (!isAntPicker && !isCheckbox && (element.type === 'text' || element.tagName === 'TEXTAREA' || element.type === '')) {
            this.fillTextInput(element, config.value);
            textFilledCount++;
          }
          return;
        }
      }

      // 尝试匹配日期字段
      for (const [key, config] of Object.entries(this.fieldMappings.dateFields)) {
        if (this.matchField(fieldText, config.matchers)) {
          if (isAntPicker) {
            this.fillAntDatePicker(element.closest('.ant-picker'), config.value);
            dateFilledCount++;
          } else if (element.type === 'date' || element.type === 'text') {
            this.fillTextInput(element, config.value);
            dateFilledCount++;
          }
          return;
        }
      }

      // 尝试匹配选择字段
      for (const [key, config] of Object.entries(this.fieldMappings.selectFields)) {
        if (this.matchField(fieldText, config.matchers)) {
          if (isAntSelect) {
            this.fillAntSelect(element.closest('.ant-select'), config.value);
            selectFilledCount++;
          } else if (element.tagName === 'SELECT') {
            element.value = config.value;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            this.success.push(`Native Select: ${config.value}`);
            selectFilledCount++;
          }
          return;
        }
      }

      // 尝试匹配复选框
      for (const [key, config] of Object.entries(this.fieldMappings.checkboxFields)) {
        if (this.matchField(fieldText, config.matchers)) {
          if (isCheckbox) {
            this.fillCheckbox(element, config.checked);
            checkboxFilledCount++;
          }
          return;
        }
      }
    });

    // 等待异步操作完成
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(
      `\n📈 填充统计:\n` +
      `   文本字段: ${textFilledCount}\n` +
      `   日期字段: ${dateFilledCount}\n` +
      `   选择字段: ${selectFilledCount}\n` +
      `   复选框: ${checkboxFilledCount}\n`
    );

    this.report();
  }
};

// 导出到全局作用域
window.formFiller = formFiller;

console.log("✅ 表单填充脚本已加载");
console.log("🚀 运行: formFiller.fillAllFields()\n");
