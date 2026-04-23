// 在真实表单页的浏览器控制台中运行
// 用来抓取剩余失败 dropdown 的真实选项文本和搜索结果

(async () => {
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const normalize = (text) => (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .trim();

  const visible = (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };

  const getSelectFingerprint = (select) => {
    const input = select.querySelector('.ant-select-selection-search-input, input[role="combobox"]');
    const formItem = select.closest('.ant-form-item, .field, .form-group, .ant-col, .ant-row') || select.parentElement;
    const formLabel = formItem?.querySelector('.ant-form-item-label label, label')?.textContent?.trim() || '';
    const nearbyText = [
      formLabel,
      select.previousElementSibling?.textContent || '',
      formItem?.textContent || '',
      select.id || '',
      select.className || '',
      input?.id || '',
      input?.name || '',
      input?.getAttribute('aria-label') || '',
      input?.placeholder || ''
    ].join(' ');

    return {
      input,
      formLabel,
      nearbyText,
      normalizedText: normalize(nearbyText)
    };
  };

  const targetConfigs = [
    {
      key: 'occupation',
      label: '职业',
      keywords: ['occupation', '职业', 'nghề', 'basic occupation'],
      searchTerms: ['Engineer', 'engineering', '工程师', 'Doctor', 'Teacher']
    },
    {
      key: 'visa_type',
      label: '签证类型',
      keywords: ['visa type', 'type of visa', 'entry type', 'single-entry', 'multiple-entry', '签证类型', 'thi thuc'],
      searchTerms: ['single', 'single entry', 'single-entry', 'multiple', 'multiple-entry']
    },
    {
      key: 'destiny_residential_address',
      label: '临时居住地址',
      keywords: ['temporary residential address', 'destiny residential address', 'tam tru', 'ttcddctamtru', '临时居住地址'],
      searchTerms: ['123 Tran Hung Dao Street, Hanoi, Vietnam', 'Tran Hung Dao', 'Hanoi']
    },
    {
      key: 'expense_coverage',
      label: '费用承担人',
      keywords: ['expense coverage', 'cover expense', 'who will cover', '费用', '承担', 'myself'],
      searchTerms: ['Myself', 'self sponsored', 'self-sponsored', 'Family', 'Employer']
    }
  ];

  const allSelects = Array.from(document.querySelectorAll('.ant-select'));
  console.log(`🔍 共发现 ${allSelects.length} 个 Ant Select`);

  const findTargetSelect = (target) => {
    const matches = allSelects
      .map((select, index) => ({ select, index, fingerprint: getSelectFingerprint(select) }))
      .filter(({ fingerprint }) =>
        target.keywords.some(keyword => fingerprint.normalizedText.includes(normalize(keyword)))
      );

    return matches[0] || null;
  };

  const getDropdownsForSelect = (select, input) => {
    const results = [];
    const seen = new Set();
    const add = (dropdown) => {
      if (!dropdown || seen.has(dropdown) || !visible(dropdown)) return;
      seen.add(dropdown);
      results.push(dropdown);
    };

    const controlIds = [
      input?.getAttribute('aria-controls'),
      input?.getAttribute('aria-owns')
    ].filter(Boolean);

    controlIds.forEach(id => {
      const owned = document.getElementById(id);
      if (owned) add(owned.closest('.ant-select-dropdown') || owned);
    });

    const selectRect = select.getBoundingClientRect();
    Array.from(document.querySelectorAll('.ant-select-dropdown'))
      .filter(visible)
      .map(dropdown => {
        const rect = dropdown.getBoundingClientRect();
        const distance = Math.abs(rect.left - selectRect.left) + Math.abs(rect.top - selectRect.bottom);
        return { dropdown, distance };
      })
      .sort((a, b) => a.distance - b.distance)
      .forEach(({ dropdown }) => add(dropdown));

    return results;
  };

  const getOptions = (dropdowns) => dropdowns.flatMap(dropdown =>
    Array.from(dropdown.querySelectorAll('[role="option"], .ant-select-item-option'))
      .filter(visible)
      .map((option, index) => ({
        index,
        text: (option.textContent || '').trim().replace(/\s+/g, ' '),
        title: option.getAttribute('title') || '',
        ariaLabel: option.getAttribute('aria-label') || '',
        className: option.className || ''
      }))
      .filter(option => option.text)
  );

  const openSelect = async (select, input) => {
    const selector = select.querySelector('.ant-select-selector') || select;
    selector.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
    selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    selector.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
    selector.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    selector.click?.();
    await sleep(80);

    if (input) {
      input.focus?.();
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown', code: 'ArrowDown' }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'ArrowDown', code: 'ArrowDown' }));
    }

    await sleep(260);
    return getDropdownsForSelect(select, input);
  };

  const setInputValue = (input, value) => {
    const descriptor =
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value') ||
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (descriptor?.set) {
      descriptor.set.call(input, value);
    } else {
      input.value = value;
    }
  };

  const searchSelect = async (select, input, term) => {
    if (!input) return [];
    await openSelect(select, input);
    setInputValue(input, '');
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: '', inputType: 'deleteContentBackward' }));
    await sleep(80);
    setInputValue(input, term);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: term, inputType: 'insertText' }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: term.slice(-1) || 'a' }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(1200);
    return getOptions(getDropdownsForSelect(select, input));
  };

  const results = [];

  for (const target of targetConfigs) {
    const match = findTargetSelect(target);
    if (!match) {
      console.warn(`❌ 未找到目标字段: ${target.label}`);
      results.push({ key: target.key, found: false });
      continue;
    }

    const { select, index, fingerprint } = match;
    const { input, formLabel } = fingerprint;
    console.group(`\n📌 ${target.label} [select #${index}]`);
    console.log('label:', formLabel || '(空)');
    console.log('select.id:', select.id || '(空)');
    console.log('input.id:', input?.id || '(空)');
    console.log('input.name:', input?.name || '(空)');
    console.log('aria-controls:', input?.getAttribute('aria-controls') || '(空)');
    console.log('aria-expanded:', input?.getAttribute('aria-expanded') || '(空)');

    const openedDropdowns = await openSelect(select, input);
    const initialOptions = getOptions(openedDropdowns);
    console.log(`初始可见选项数: ${initialOptions.length}`);
    if (initialOptions.length > 0) {
      console.table(initialOptions);
    }

    const searchResults = {};
    for (const term of target.searchTerms) {
      const options = await searchSelect(select, input, term);
      searchResults[term] = options;
      console.log(`搜索 "${term}" 后选项数: ${options.length}`);
      if (options.length > 0) {
        console.table(options);
      }
    }

    results.push({
      key: target.key,
      found: true,
      selectIndex: index,
      label: formLabel,
      selectId: select.id || '',
      inputId: input?.id || '',
      initialOptions,
      searchResults
    });

    console.groupEnd();
  }

  window.__VH_lastDropdownDiagnosis = results;
  console.log('\n✅ 诊断完成，复制下面这个对象发给我即可:');
  console.log(window.__VH_lastDropdownDiagnosis);
})();
