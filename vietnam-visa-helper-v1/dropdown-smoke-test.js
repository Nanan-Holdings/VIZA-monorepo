function normalizeSelectText(text) {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .trim();
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

function getAntSelectAliases(rawValue, fieldInfo) {
  const canonical = rawValue?.toString().trim() || '';
  const aliases = new Set([canonical]);
  const normalized = normalizeSelectText(canonical);
  
  const builtInAliases = {
    male: ['m', 'male', 'man', '男', '男性'],
    female: ['f', 'female', 'woman', '女', '女性'],
    china: ['china', 'chinese', '中国', '中华人民共和国', 'people republic of china', 'peoples republic of china', 'pr china', 'prc'],
    ordinary: ['ordinary', 'ordinary passport', '普通', '普通护照'],
    single: ['single', 'single entry', 'single-entry', 'one entry', 'one time', 'one-time', 'single visa', '单次', '单次入境'],
    multiple: ['multiple', 'multiple entry', 'multiple-entry', 'multi entry', 'multi-entry', '多次', '多次入境'],
    cash: ['cash', '现款', '现金'],
    'credit card': ['credit card', 'credit_card', 'card', 'visa card', 'mastercard', 'master card', '信用卡'],
    'traveller cheques': ['traveller cheques', 'traveller cheque', 'traveller_cheques', 'traveler cheques', 'traveler cheque', '旅行支票'],
    no: ['no', '否', 'not', 'none'],
    yes: ['yes', '是', 'agree'],
    myself: ['myself', 'self', 'self-funded', '本人', '自己']
  };
  
  if (builtInAliases[normalized]) {
    builtInAliases[normalized].forEach(alias => aliases.add(alias));
  }

  if (fieldInfo?.key === 'purpose' && ['tourism', 'tourist', 'travel', 'holiday', 'vacation'].some(token => normalized.includes(token))) {
    ['Tourist', 'tourist', 'Tourism', 'tourism'].forEach(alias => aliases.add(alias));
  }
  if (fieldInfo?.key === 'occupation' && ['engineer', 'teacher', 'doctor', 'employee', 'staff', 'worker'].some(token => normalized.includes(token))) {
    ['Employee', 'employee', 'staff'].forEach(alias => aliases.add(alias));
  }
  if (fieldInfo?.key === 'expense_coverage' && ['myself', 'self', 'personal', 'family'].some(token => normalized.includes(token))) {
    ['Personal', 'personal', 'myself', 'self'].forEach(alias => aliases.add(alias));
  }
  if (fieldInfo?.key === 'payment_method') {
    if (['cash', '现款', '现金'].some(token => normalized.includes(token))) {
      ['Cash', 'cash'].forEach(alias => aliases.add(alias));
    }
    if ([
      'credit card', 'creditcard', 'debit card', 'card', 'visa', 'mastercard', 'master card',
      '信用卡', '银行卡'
    ].some(token => normalized.includes(token))) {
      ['Credit card', 'credit card', 'credit_card'].forEach(alias => aliases.add(alias));
    }
    if ([
      'traveller cheques', 'traveller cheque', 'traveller_cheques',
      'traveler cheques', 'traveler cheque', '旅行支票'
    ].some(token => normalized.includes(token))) {
      ['Traveller cheques', 'traveller cheques', 'traveller_cheques'].forEach(alias => aliases.add(alias));
    }
  }
  
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
  
  options.forEach(optionText => {
    const score = scoreAntSelectOption(optionText, aliases);
    if (!best || score > best.score) {
      best = { text: optionText, score };
    }
  });
  
  return best && best.score >= 75 ? best : null;
}

function isAntSelectValueApplied(currentDisplay, expectedText) {
  const current = normalizeSelectText(currentDisplay);
  const expected = normalizeSelectText(expectedText);
  
  if (!current || !expected) return false;
  return current === expected || current.includes(expected) || expected.includes(current);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const cases = [
  {
    name: 'gender male alias match',
    value: 'male',
    options: ['Female', 'Male', 'Other'],
    expect: 'Male'
  },
  {
    name: 'passport type ordinary matches full label',
    value: 'ordinary',
    fieldInfo: {
      options: {
        ordinary: '普通护照 (Ordinary Passport)'
      }
    },
    options: ['Diplomatic Passport', 'Official Passport', 'Ordinary Passport'],
    expect: 'Ordinary Passport'
  },
  {
    name: 'nationality china matches alias chinese',
    value: 'China',
    options: ['American', 'Chinese', 'Singaporean'],
    expect: 'Chinese'
  },
  {
    name: 'single entry matches hyphenated option',
    value: 'single',
    options: ['Multiple-entry', 'Single-entry'],
    expect: 'Single-entry'
  },
  {
    name: 'purpose tourism maps to tourist option',
    value: 'Tourism',
    fieldInfo: {
      key: 'purpose',
      options: {
        Tourist: '旅游 (Tourist)'
      }
    },
    options: ['Business', 'Tourist', 'Other'],
    expect: 'Tourist'
  },
  {
    name: 'occupation engineer maps to employee option',
    value: 'Engineer',
    fieldInfo: {
      key: 'occupation',
      options: {
        Employee: '雇员 (Employee)'
      }
    },
    options: ['Businessman', 'Employee', 'Retired'],
    expect: 'Employee'
  },
  {
    name: 'expense coverage myself maps to personal option',
    value: 'Myself',
    fieldInfo: {
      key: 'expense_coverage',
      options: {
        Personal: '个人承担 (Personal)'
      }
    },
    options: ['Company', 'Personal'],
    expect: 'Personal'
  },
  {
    name: 'payment method credit card maps to credit card option',
    value: 'credit_card',
    fieldInfo: {
      key: 'payment_method',
      options: {
        credit_card: '信用卡 (Credit card)'
      }
    },
    options: ['Cash', 'Credit card', 'Traveller cheques'],
    expect: 'Credit card'
  },
  {
    name: 'noi bai does not false positive can tho',
    value: 'Noi Bai',
    fieldInfo: {
      options: {
        'Noi Bai': '河内内排机场 (Noi Bai International Airport)'
      }
    },
    options: ['Can Tho International Airport', 'Noi Bai International Airport'],
    expect: 'Noi Bai International Airport'
  },
  {
    name: 'generic airport words alone are not enough',
    value: 'Noi Bai',
    fieldInfo: {
      options: {
        'Noi Bai': '河内内排机场 (Noi Bai International Airport)'
      }
    },
    options: ['Can Tho International Airport', 'Tan Son Nhat International Airport'],
    expect: null
  }
];

for (const testCase of cases) {
  const aliases = getAntSelectAliases(testCase.value, testCase.fieldInfo);
  const best = findBestAntSelectOption(testCase.options, aliases);
  
  if (testCase.expect === null) {
    assert(best === null, `${testCase.name}: expected no match, got ${best?.text}`);
    continue;
  }
  
  assert(best?.text === testCase.expect, `${testCase.name}: expected ${testCase.expect}, got ${best?.text}`);
  assert(isAntSelectValueApplied(best.text, testCase.expect), `${testCase.name}: confirmation check failed`);
}

console.log('dropdown smoke test passed');
