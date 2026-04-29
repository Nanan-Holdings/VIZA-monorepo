// Background Script v1.1 - Enhanced field mappings and translations

// User data and field mappings (hardcoded for demo)
const userData = {
  personalInfo: {
    // Name Information
    full_name: "Zhang San",
    surname: "Zhang",
    given_name: "San",
    
    // Birth Information
    date_of_birth: "01/01/1990",
    place_of_birth: "Shanghai, China",
    
    // Personal Details
    gender: "male",
    nationality: "China",
    religion: "Buddhism",
    identity_card: "310101199001011234",
    multiple_nationalities: "No",
    violation_of_laws: "No",
    
    // Passport Information
    passport_number: "E12345678",
    passport_issue_authority: "Shanghai Public Security Bureau",
    passport_type: "ordinary",
    passport_date_of_issue: "01/01/2020",
    passport_expiry: "01/01/2030",
    other_passports: "No"
  },
  
  contactInfo: {
    // Primary Contact
    email: "zhangsan@example.com",
    phone: "+8612345678901",
    
    // Vietnam Contact
    phone_in_vietnam: "+84912345678",
    
    // Emergency Contact
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
    // Trip Purpose
    purpose: "Tourism",
    
    // Trip Duration
    duration: "14",
    
    // Entry/Exit Dates
    arrival_date: "15/06/2026",
    departure_date: "29/06/2026",
    intended_date_of_entry: "15/06/2026",
    intended_length_of_stay: "14",
    
    // Destinations
    arrival_city: "Hanoi",
    destination_address: "123 Tran Hung Dao Street, Hanoi, Vietnam",
    residential_address_in_vietnam: "123 Tran Hung Dao Street, Hanoi, Vietnam",
    contact_address: "123 Tran Hung Dao Street, Hanoi, Vietnam",
    province_city: "Hanoi",
    ward_commune: "Ba Dinh District, Hanoi"
  },
  
  visaInfo: {
    visa_type: "single",
    visa_valid_from: "15/06/2026",
    visa_valid_to: "15/07/2026",
    intended_border_gate_of_entry: "Noi Bai",
    intended_border_gate_of_exit: "Noi Bai"
  },
  
  tripExpenses: {
    intended_expenses: "1000",
    bought_insurance: "No",
    expense_coverage: "Myself",
    payment_method: "credit_card",
    relatives_in_vietnam: "No"
  },
  
  confirmations: {
    temporary_residence_declaration: "on",
    agree_to_create_account: "on",
    legal_declaration: "on"
  },

  documents: {
    passport_photo: null,
    passport_copy: null
  }
};

const fieldMappings = {
  // ===== PERSONAL INFORMATION =====
  full_name: {
    label_cn: "全名",
    hint: "请输入您的完整姓名。这应该是您护照上的名字",
    example: "Zhang San 或 Zhang San",
    options: null
  },
  surname: {
    label_cn: "姓氏",
    hint: "您的姓（family name/last name）。从护照上复制，确保大写字母正确",
    example: "Zhang（如果护照是Zhang San）",
    options: null
  },
  given_name: {
    label_cn: "名字",
    hint: "您的名字（first name）。从护照上复制，确保拼写完全相同",
    example: "San（如果护照是Zhang San）",
    options: null
  },
  date_of_birth: {
    label_cn: "出生日期",
    hint: "您的出生日期。确保与护照上的日期相同，格式为 DD/MM/YYYY",
    example: "01/01/1990（表示1990年1月1日）",
    options: null
  },
  gender: {
    label_cn: "性别",
    hint: "选择与护照相符的性别",
    example: null,
    options: {
      "male": "男性 (Male)",
      "female": "女性 (Female)",
      "M": "男性 (M)",
      "F": "女性 (F)"
    }
  },
  nationality: {
    label_cn: "国籍",
    hint: "选择您的国籍。如果是中国，通常显示为 China 或 Chinese",
    example: "China",
    options: null
  },
  
  // ===== PASSPORT INFORMATION =====
  passport_number: {
    label_cn: "护照号码",
    hint: "您的护照号码。位于护照首页，通常以字母开头后跟数字。完全按照护照上显示的方式输入（包括大小写）",
    example: "E12345678（示例）",
    options: null
  },
  passport_issue_authority: {
    label_cn: "护照签发机构",
    hint: "颁发您护照的机构。中国通常是各地级市出入境管理部门",
    example: "Shanghai Public Security Bureau（上海市公安局）或 National Immigration Administration",
    options: null
  },
  passport_type: {
    label_cn: "护照类型",
    hint: "选择您的护照类型。普通护照是最常见的",
    example: null,
    options: {
      "ordinary": "普通护照 (Ordinary Passport)",
      "official": "公务护照 (Official Passport)",
      "diplomatic": "外交护照 (Diplomatic Passport)"
    }
  },
  passport_date_of_issue: {
    label_cn: "护照签发日期",
    hint: "您的护照签发日期。位于护照首页。格式为 DD/MM/YYYY",
    example: "01/01/2020（表示2020年1月1日）",
    options: null
  },
  passport_expiry: {
    label_cn: "护照有效期/到期日期",
    hint: "您的护照有效期。位于护照首页下方。确保尚未过期。格式为 DD/MM/YYYY",
    example: "01/01/2030（表示护照在2030年1月1日到期）",
    options: null
  },
  other_passports: {
    label_cn: "是否持有其他有效护照",
    hint: "选择是否持有其他国家的有效护照",
    example: null,
    options: {
      "Yes": "是 (Yes)",
      "No": "否 (No)"
    }
  },
  
  // ===== CONTACT INFORMATION =====
  email: {
    label_cn: "电子邮件地址",
    hint: "您的有效电子邮件地址。申请号和签证通知将发送到此地址，请确保能够接收邮件",
    example: "zhangsan@example.com",
    options: null
  },
  re_enter_email: {
    label_cn: "确认电子邮件地址",
    hint: "重新输入您的电子邮件地址以确保准确。必须与上面的电子邮件地址相同",
    example: "zhangsan@example.com",
    options: null
  },
  phone: {
    label_cn: "电话号码（国内）",
    hint: "您的家庭或常用电话号码。包括国家代码。如果是中国号码，应该是 +86 开头",
    example: "+8612345678901（+86 是中国国家代码）",
    options: null
  },
  phone_in_vietnam: {
    label_cn: "越南境内电话号码",
    hint: "您在越南期间的电话号码。可以是越南电话卡号码或酒店电话",
    example: "+84912345678（越南号码，+84 是越南国家代码）",
    options: null
  },
  
  // ===== PERSONAL DETAILS =====
  religion: {
    label_cn: "宗教信仰",
    hint: "选择或输入您的宗教信仰。可填写 Buddhism, Christianity, Islam, Other等",
    example: "Buddhism (佛教) 或 None (无)",
    options: {
      "Buddhism": "佛教 (Buddhism)",
      "Christianity": "基督教 (Christianity)",
      "Islam": "伊斯兰教 (Islam)",
      "Judaism": "犹太教 (Judaism)",
      "Hinduism": "印度教 (Hinduism)",
      "Taoism": "道教 (Taoism)",
      "Other": "其他 (Other)",
      "None": "无 (None)"
    }
  },
  place_of_birth: {
    label_cn: "出生地",
    hint: "您的出生地。格式：城市, 国家。确保信息与护照相符",
    example: "Shanghai, China（上海，中国）或 Beijing, China（北京，中国）",
    options: null
  },
  identity_card: {
    label_cn: "身份证号码",
    hint: "您的身份证或国家身份证号码。不同国家格式不同。请按照证件上的方式输入",
    example: "310101199001011234（中国身份证）或其他格式",
    options: null
  },
  multiple_nationalities: {
    label_cn: "是否持有多重国籍",
    hint: "选择您是否拥有超过一个国家的国籍",
    example: null,
    options: {
      "Yes": "是 (Yes)",
      "No": "否 (No)"
    }
  },
  violation_of_laws: {
    label_cn: "是否违反越南法律/法规",
    hint: "选择您是否曾违反越南法律或法规。如有任何违规行为，必须选择是",
    example: null,
    options: {
      "Yes": "是 (Yes)",
      "No": "否 (No)"
    }
  },
  
  // ===== OCCUPATION INFORMATION =====
  occupation: {
    label_cn: "职业",
    hint: "选择最接近您身份的职业类别。真实站点通常使用 Employee、Student、Businessman、Official、Retired、Unemployed、Others 这类固定选项",
    example: "Employee（雇员）、Student（学生）、Businessman（商人）、Retired（退休）",
    options: {
      "Employee": "雇员 (Employee)",
      "Student": "学生 (Student)",
      "Businessman": "商人 (Businessman)",
      "Official": "公务/官方人员 (Official)",
      "Retired": "退休 (Retired)",
      "Unemployed": "失业 (Unemployed)",
      "Others": "其他 (Others)"
    }
  },
  occupation_info: {
    label_cn: "职业详细信息",
    hint: "详细描述您的职业信息。例如：软件工程师、中学数学教师、全职母亲等",
    example: "Software Engineer, High School Math Teacher",
    options: null
  },
  company_name: {
    label_cn: "公司/机构/学校名称",
    hint: "您工作或学习的公司、政府机构或教育机构的名称",
    example: "Tech Company Ltd., Harvard University, Government Agency",
    options: null
  },
  position_course: {
    label_cn: "职位/学习课程",
    hint: "您在公司/机构中的具体职位，或在学校的学习课程名称",
    example: "Senior Software Engineer, Computer Science Major",
    options: null
  },
  company_address: {
    label_cn: "公司/机构/学校地址",
    hint: "您工作或学习的机构的完整地址，包括街道、城市和国家",
    example: "123 Business Park, District 1, Ho Chi Minh City, Vietnam",
    options: null
  },
  company_phone: {
    label_cn: "公司/机构/学校电话",
    hint: "您工作或学习机构的电话号码，包括国家代码",
    example: "+84912345678 或 +86-10-12345678",
    options: null
  },
  
  // ===== VISA INFORMATION =====
  visa_type: {
    label_cn: "签证类型",
    hint: "选择要申请的电子签证类型。Single-entry（单次入境）最常见，Multiple-entry（多次入境）适合商务客",
    example: null,
    options: {
      "single": "单次入境 (Single entry)",
      "multiple": "多次入境 (Multiple entry)"
    }
  },
  visa_valid_from: {
    label_cn: "电子签证有效期开始",
    hint: "电子签证生效的日期。格式为 DD/MM/YYYY",
    example: "01/06/2026（表示2026年6月1日生效）",
    options: null
  },
  visa_valid_to: {
    label_cn: "电子签证有效期结束",
    hint: "电子签证失效的日期。必须晚于生效日期。格式为 DD/MM/YYYY",
    example: "01/07/2026（表示2026年7月1日失效）",
    options: null
  },
  
  // ===== TRIP INFORMATION =====
  purpose: {
    label_cn: "访问目的",
    hint: "选择您访问越南的主要目的。真实站点常见选项为 Tourist、Visiting relatives、Working、Business、Other",
    example: null,
    options: {
      "Tourist": "旅游 (Tourist)",
      "Visiting relatives": "探亲 (Visiting relatives)",
      "Business": "商务 (Business)",
      "Working": "工作 (Working)",
      "Other": "其他 (Other)"
    }
  },
  intended_date_of_entry: {
    label_cn: "预计入境日期",
    hint: "您计划抵达越南的日期。务必确保比申请日期往后。格式为 DD/MM/YYYY",
    example: "15/06/2026（表示2026年6月15日抵达）",
    options: null
  },
  intended_length_of_stay: {
    label_cn: "预计停留天数",
    hint: "您打算在越南停留的天数。这决定了签证有效期。最多90天",
    example: "14 或 30 或 7",
    options: null
  },
  duration: {
    label_cn: "停留天数",
    hint: "您打算在越南停留的总天数。通常与预计停留天数保持一致",
    example: "14",
    options: null
  },
  
  // ===== DESTINATIONS IN VIETNAM =====
  destination_address: {
    label_cn: "越南目的地详细地址",
    hint: "您在越南的住宿或目的地地址。包括街道、城市名称。尽可能详细",
    example: "123 Tran Hung Dao Street, Hanoi, Vietnam",
    options: null
  },
  residential_address_in_vietnam: {
    label_cn: "越南住所地址",
    hint: "您在越南的居住地址。可以是酒店、亲友住处或工作地址",
    example: "Hanoi, Vietnam 或 Saigon Hotel, Ho Chi Minh City",
    options: null
  },
  province_city: {
    label_cn: "省/市",
    hint: "选择您在越南的主要停留省份或城市",
    example: "Hanoi (河内) 或 Ho Chi Minh City (胡志明市)",
    options: {
      "Hanoi": "河内 (Hanoi)",
      "HCMC": "胡志明市 (Ho Chi Minh City)",
      "Da Nang": "岘港 (Da Nang)",
      "Hai Phong": "海防 (Hai Phong)",
      "Can Tho": "坎地 (Can Tho)",
      "Nha Trang": "芽庄 (Nha Trang)",
      "Da Lat": "大叻 (Da Lat)",
      "Hue": "顺化 (Hue)"
    }
  },
  ward_commune: {
    label_cn: "坊/社",
    hint: "输入或选择您在越南居住的坊或社（行政区划的下一级）",
    example: "Ba Dinh District, Hanoi",
    options: null
  },
  
  // ===== BORDER GATES =====
  intended_border_gate_of_entry: {
    label_cn: "预计入境口岸",
    hint: "选择您计划进入越南的边界口岸或机场",
    example: "Noi Bai International Airport (河内内排机场)",
    options: {
      "Noi Bai": "河内内排机场 (Noi Bai International Airport)",
      "Tan Son Nhat": "胡志明市新山一机场 (Tan Son Nhat International Airport)",
      "Da Nang": "岘港国际机场 (Da Nang International Airport)",
      "Hai Phong": "海防国际机场 (Cat Bi International Airport)",
      "Lao Cai": "老街陆路口岸 (Lao Cai Land Border)",
      "Mong Cai": "蒙凯陆路口岸 (Mong Cai Land Border)",
      "Friendship Gate": "友谊关 (Friendship Gate)"
    }
  },
  intended_border_gate_of_exit: {
    label_cn: "预计出境口岸",
    hint: "选择您计划离开越南的边界口岸或机场",
    example: "Noi Bai International Airport (河内内排机场)",
    options: {
      "Noi Bai": "河内内排机场 (Noi Bai International Airport)",
      "Tan Son Nhat": "胡志明市新山一机场 (Tan Son Nhat International Airport)",
      "Da Nang": "岘港国际机场 (Da Nang International Airport)",
      "Hai Phong": "海防国际机场 (Cat Bi International Airport)",
      "Lao Cai": "老街陆路口岸 (Lao Cai Land Border)",
      "Mong Cai": "蒙凯陆路口岸 (Mong Cai Land Border)",
      "Friendship Gate": "友谊关 (Friendship Gate)"
    }
  },
  
  // ===== CONFIRMATIONS =====
  temporary_residence_declaration: {
    label_cn: "承诺按照越南法律规定申报临时居住地",
    hint: "确认您同意按照越南法律规定申报临时居住地（在越南停留期间必须注册住所）",
    example: null,
    options: {
      "on": "同意 (Agree)",
      "off": "不同意 (Disagree)"
    }
  },
  agree_to_create_account: {
    label_cn: "同意创建账户",
    hint: "确认您同意使用此电子邮件地址创建e-Visa账户",
    example: null,
    options: {
      "on": "同意 (Agree)",
      "off": "不同意 (Disagree)"
    }
  },
  
  // ===== EMERGENCY CONTACT =====
  emergency_contact_name: {
    label_cn: "紧急联系人姓名",
    hint: "紧急情况下可以联系的人的姓名，应该是英文名字",
    example: "Li Si",
    options: null
  },
  emergency_contact_relationship: {
    label_cn: "与紧急联系人的关系",
    hint: "您与紧急联系人的关系",
    example: "Friend、Family、Parent等",
    options: {
      "friend": "朋友 (Friend)",
      "family": "家人 (Family)",
      "spouse": "配偶 (Spouse)",
      "parent": "父母 (Parent)",
      "sibling": "兄弟姐妹 (Sibling)",
      "colleague": "同事 (Colleague)"
    }
  },
  emergency_contact_phone: {
    label_cn: "紧急联系人电话",
    hint: "紧急联系人的电话号码，包括国家代码",
    example: "+8612345678902",
    options: null
  },
  emergency_contact_current_address: {
    label_cn: "紧急联系人当前居住地址",
    hint: "紧急联系人的当前居住地址。完整的街道地址、城市和国家",
    example: "123 Tran Hung Dao Street, Hanoi, Vietnam",
    options: null
  },
  contact_address: {
    label_cn: "联系地址",
    hint: "您在越南或国外可以被联系的地址。用于签证通知和联系",
    example: "123 Tran Hung Dao Street, Hanoi, Vietnam 或 您的家庭住址",
    options: null
  },
  
  // ===== ADDITIONAL TRIP INFORMATION =====
  intended_expenses: {
    label_cn: "预计消费金额 (美元)",
    hint: "您预计在越南停留期间的支出金额，以美元计算。用于评估经济能力",
    example: "1000 或 500-1000",
    options: null
  },
  bought_insurance: {
    label_cn: "是否购买保险",
    hint: "选择您是否为这次越南行购买了旅行保险或医疗保险",
    example: null,
    options: {
      "Yes": "是 (Yes)",
      "No": "否 (No)"
    }
  },
  expense_coverage: {
    label_cn: "谁将承担旅程的费用",
    hint: "真实站点常见固定选项更接近 Personal（个人承担）和 Company（公司/单位承担）",
    example: "Personal（个人承担）或 Company（公司承担）",
    options: {
      "Personal": "个人承担 (Personal)",
      "Company": "公司承担 (Company)"
    }
  },
  payment_method: {
    label_cn: "支付方式",
    hint: "真实站点该字段通常对应 Cash、Credit card、Traveller cheques 这类固定选项",
    example: "Credit card（信用卡）或 Cash（现金）",
    options: {
      "cash": "现金 (Cash)",
      "credit_card": "信用卡 (Credit card)",
      "traveller_cheques": "旅行支票 (Traveller cheques)"
    }
  },
  legal_declaration: {
    label_cn: "法律声明确认",
    hint: "确认您同意上述信息真实准确，并对所提供的信息在越南法律下负责",
    example: null,
    options: {
      "on": "同意 (Agree)",
      "off": "不同意 (Disagree)"
    }
  },
  relatives_in_vietnam: {
    label_cn: "是否在越南有亲属",
    hint: "选择您是否在越南有亲属或家庭成员目前居住",
    example: null,
    options: {
      "Yes": "是 (Yes)",
      "No": "否 (No)"
    }
  },
  
  // ===== DOCUMENT UPLOADS =====
  passport_photo: {
    label_cn: "照片（正面）",
    hint: "上传申请人的正面证件照。建议 JPG/PNG 格式，清晰白底，文件不超过 2MB",
    example: null,
    options: null
  },
  passport_copy: {
    label_cn: "护照复印件",
    hint: "上传护照资料页/首页复印件。建议 JPG/PNG 格式，确保 MRZ 和护照号码清晰，文件不超过 2MB",
    example: null,
    options: null
  },
  identity_card: {
    label_cn: "身份证号码",
    hint: "您的身份证/护照号码。如果是中国公民，应输入身份证号码或护照号码",
    example: "110101199001011234 或 E12345678",
    options: null
  },
  
  // ===== GENERIC/FALLBACK FIELDS =====
  generic_date: {
    label_cn: "日期",
    hint: "请输入日期，格式为 DD/MM/YYYY (例如: 01/01/1990)",
    example: "15/06/2026",
    options: null
  }
};

const SUPABASE_URL = 'https://oyjxdzsoejraedqghndi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_F5iLwR2PAMWH79sSHUXslA_67aA6GTj';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95anhkenNvZWpyYWVkcWdobmRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNDcxOTUsImV4cCI6MjA4OTYyMzE5NX0.Hw6DgY6fDVe5ky8wVj7F8Ib_kJaNgGrCiVc_hC5o_fk';
const SUPABASE_PROFILE_TABLE = 'visa_vietnam';
const SUPABASE_STORAGE_BUCKET = 'visa-vietnam-uploads';
const SUPABASE_SESSION_KEY = 'vhSupabaseSession';
const SUPABASE_PROFILE_CACHE_KEY = 'vhSupabaseProfileCache';
const SUPABASE_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024;
const UPLOAD_STORAGE_KEY = 'vhUploadDocuments';
const ALLOWED_UPLOAD_KEYS = new Set(['passport_photo', 'passport_copy']);

function getSupabaseApiKey() {
  if (SUPABASE_PUBLISHABLE_KEY && SUPABASE_PUBLISHABLE_KEY.trim()) {
    return SUPABASE_PUBLISHABLE_KEY.trim();
  }
  if (SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.trim()) {
    return SUPABASE_ANON_KEY.trim();
  }
  return '';
}

function normalizeEmailAddress(value) {
  return (value || '').toString().trim().toLowerCase();
}

function buildSupabaseOtpPayload(email) {
  const normalizedEmail = normalizeEmailAddress(email);
  if (!normalizedEmail) {
    throw new Error('missing_email');
  }

  return {
    email: normalizedEmail,
    options: {
      shouldCreateUser: true
    },
    create_user: true
  };
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function shouldUseRemoteValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
}

function getBundledUploadDocuments() {
  return {
    passport_photo: {
      file_name: 'embedded-passport-photo.png',
      mime_type: 'image/png',
      url: chrome.runtime.getURL('embedded-passport-photo.png')
    },
    passport_copy: {
      file_name: 'embedded-passport-copy.png',
      mime_type: 'image/png',
      url: chrome.runtime.getURL('embedded-passport-copy.png')
    }
  };
}

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeProfileWithDefaults(defaults, remote) {
  if (!isPlainObject(defaults)) {
    return shouldUseRemoteValue(remote) ? remote : defaults;
  }

  const merged = Array.isArray(defaults) ? defaults.slice() : {};

  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (key === 'documents') {
      merged[key] = defaultValue;
      continue;
    }

    const remoteValue = isPlainObject(remote) ? remote[key] : undefined;

    if (isPlainObject(defaultValue)) {
      merged[key] = mergeProfileWithDefaults(defaultValue, isPlainObject(remoteValue) ? remoteValue : {});
      continue;
    }

    if (Array.isArray(defaultValue)) {
      merged[key] = Array.isArray(remoteValue) && remoteValue.length ? remoteValue : defaultValue;
      continue;
    }

    merged[key] = shouldUseRemoteValue(remoteValue) ? remoteValue : defaultValue;
  }

  return merged;
}

function sanitizeProfileForSave(profile) {
  if (!isPlainObject(profile)) return {};
  const cleaned = cloneDeep(profile);
  if (cleaned.documents) {
    delete cleaned.documents;
  }
  return cleaned;
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

function dataUrlToBlob(dataUrl) {
  return fetch(dataUrl).then(response => response.blob());
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('blob_to_data_url_failed'));
    reader.readAsDataURL(blob);
  });
}

async function buildUploadPayloadFromSource(payload) {
  const fileName = payload?.file_name || payload?.fileName || 'upload';
  const mimeType = payload?.mime_type || payload?.mimeType || 'application/octet-stream';
  const lastModified = payload?.last_modified || payload?.lastModified || Date.now();
  const dataUrl = payload?.data_url || payload?.dataUrl || '';

  if (!dataUrl) {
    throw new Error('missing_upload_data');
  }

  const originalSize = estimateDataUrlBytes(dataUrl);
  if (originalSize <= MAX_UPLOAD_SIZE_BYTES) {
    return {
      file_name: fileName,
      mime_type: mimeType,
      size: originalSize,
      last_modified: lastModified,
      data_url: dataUrl
    };
  }

  const sourceBlob = await dataUrlToBlob(dataUrl);
  const imageBitmap = await createImageBitmap(sourceBlob);
  const maxDimensions = [1800, 1500, 1200, 1000, 800, 640];
  const qualities = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42];

  try {
    for (const maxDimension of maxDimensions) {
      const longestSide = Math.max(imageBitmap.width, imageBitmap.height);
      const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
      const width = Math.max(1, Math.round(imageBitmap.width * scale));
      const height = Math.max(1, Math.round(imageBitmap.height * scale));
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('offscreen_canvas_context_unavailable');
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(imageBitmap, 0, 0, width, height);

      for (const quality of qualities) {
        const compressedBlob = await canvas.convertToBlob({
          type: 'image/jpeg',
          quality
        });
        const compressedDataUrl = await blobToDataUrl(compressedBlob);
        const compressedSize = estimateDataUrlBytes(compressedDataUrl);

        if (compressedSize <= MAX_UPLOAD_SIZE_BYTES) {
          return {
            file_name: replaceFileExtension(fileName, '.jpg'),
            mime_type: 'image/jpeg',
            size: compressedSize,
            last_modified: lastModified,
            data_url: compressedDataUrl
          };
        }
      }
    }
  } finally {
    imageBitmap.close?.();
  }

  throw new Error('compressed_upload_still_too_large');
}

function sanitizeUploadDocuments(documents) {
  const sanitized = {};

  for (const key of ALLOWED_UPLOAD_KEYS) {
    if (documents?.[key]) {
      sanitized[key] = documents[key];
    }
  }

  return sanitized;
}

function buildUserDataWithStoredUploads(documents, baseUserData = userData) {
  const merged = cloneDeep(baseUserData || userData);
  const sanitizedDocuments = sanitizeUploadDocuments(documents);
  merged.documents = {
    ...getBundledUploadDocuments(),
    ...sanitizedDocuments
  };
  return merged;
}

function buildUploadDocumentsResponse(documents) {
  return {
    ...getBundledUploadDocuments(),
    ...sanitizeUploadDocuments(documents)
  };
}

function getStoredUploadDocuments(callback) {
  chrome.storage.local.get([UPLOAD_STORAGE_KEY], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('读取上传文件缓存失败:', chrome.runtime.lastError.message);
      callback({});
      return;
    }

    callback(sanitizeUploadDocuments(result?.[UPLOAD_STORAGE_KEY]));
  });
}

function getStoredUploadDocumentsAsync() {
  return new Promise((resolve) => {
    getStoredUploadDocuments(resolve);
  });
}

function setStoredUploadDocumentsAsync(documents) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [UPLOAD_STORAGE_KEY]: documents }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'storage_set_failed'));
        return;
      }
      resolve();
    });
  });
}

function persistUploadDocuments(nextDocuments, sendResponse) {
  chrome.storage.local.set({ [UPLOAD_STORAGE_KEY]: nextDocuments }, () => {
    if (chrome.runtime.lastError) {
      sendResponse({
        success: false,
        error: chrome.runtime.lastError.message || 'storage_set_failed'
      });
      return;
    }

    sendResponse({
      success: true,
      documents: nextDocuments
    });
  });
}

function buildSupabaseHeaders(accessToken) {
  const apiKey = getSupabaseApiKey();
  const headers = {
    apikey: apiKey,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

function buildSupabaseStorageHeaders(accessToken, contentType = '') {
  const apiKey = getSupabaseApiKey();
  const headers = {
    apikey: apiKey
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  return headers;
}

function formatSupabaseFetchError(error, contextLabel) {
  const message = error?.message || '';
  if (message.toLowerCase().includes('failed to fetch')) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (offline) {
      return new Error('network_offline');
    }
    return new Error(`network_unreachable:${contextLabel}`);
  }
  return new Error(message || `supabase_${contextLabel}_failed`);
}

function getFileExtensionFromMimeType(mimeType) {
  const normalized = (mimeType || '').toLowerCase();
  if (normalized.includes('png')) return '.png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return '.jpg';
  if (normalized.includes('webp')) return '.webp';
  if (normalized.includes('gif')) return '.gif';
  if (normalized.includes('bmp')) return '.bmp';
  return '';
}

function normalizeStorageFileKey(value) {
  return (value || 'upload').toString().replace(/[^a-z0-9._-]+/gi, '_');
}

function buildStorageObjectPath(userId, fieldKey, fileName, mimeType) {
  const safeKey = normalizeStorageFileKey(fieldKey || 'upload');
  const rawExtension = fileName && fileName.includes('.')
    ? fileName.slice(fileName.lastIndexOf('.'))
    : '';
  const extension = rawExtension || getFileExtensionFromMimeType(mimeType) || '.bin';
  const safeExtension = extension.replace(/[^.a-z0-9]/gi, '');
  return `${userId}/${safeKey}${safeExtension}`;
}

function normalizeSupabaseSession(data) {
  if (!data?.access_token) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = data.expires_at || (data.expires_in ? nowSeconds + data.expires_in : null);

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type,
    expires_at: expiresAt,
    user: data.user || null
  };
}

function buildSessionSummary(session) {
  if (!session?.user) return null;
  return {
    email: session.user.email || null,
    expires_at: session.expires_at || null
  };
}

function getStoredSupabaseSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get([SUPABASE_SESSION_KEY], (result) => {
      if (chrome.runtime.lastError) {
        console.warn('读取 Supabase session 失败:', chrome.runtime.lastError.message);
        resolve(null);
        return;
      }
      resolve(result?.[SUPABASE_SESSION_KEY] || null);
    });
  });
}

function setStoredSupabaseSession(session) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SUPABASE_SESSION_KEY]: session }, () => {
      if (chrome.runtime.lastError) {
        console.warn('保存 Supabase session 失败:', chrome.runtime.lastError.message);
      }
      resolve();
    });
  });
}

function clearStoredSupabaseSession() {
  return new Promise((resolve) => {
    chrome.storage.local.remove([SUPABASE_SESSION_KEY], () => {
      if (chrome.runtime.lastError) {
        console.warn('清除 Supabase session 失败:', chrome.runtime.lastError.message);
      }
      resolve();
    });
  });
}

function getCachedSupabaseProfile() {
  return new Promise((resolve) => {
    chrome.storage.local.get([SUPABASE_PROFILE_CACHE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }

      const cache = result?.[SUPABASE_PROFILE_CACHE_KEY];
      if (!cache || !Object.prototype.hasOwnProperty.call(cache, 'profile') || !cache.cachedAt) {
        resolve(null);
        return;
      }

      if (Date.now() - cache.cachedAt > SUPABASE_PROFILE_CACHE_TTL_MS) {
        resolve(null);
        return;
      }

      resolve(cache.profile);
    });
  });
}

function setCachedSupabaseProfile(profile) {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      [SUPABASE_PROFILE_CACHE_KEY]: {
        profile,
        cachedAt: Date.now()
      }
    }, () => {
      resolve();
    });
  });
}

function clearCachedSupabaseProfile() {
  return new Promise((resolve) => {
    chrome.storage.local.remove([SUPABASE_PROFILE_CACHE_KEY], () => {
      resolve();
    });
  });
}

async function supabaseTokenRequest(grantType, payload) {
  const apiKey = getSupabaseApiKey();
  if (!SUPABASE_URL || !apiKey) {
    throw new Error('supabase_not_configured');
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grantType}`, {
    method: 'POST',
    headers: buildSupabaseHeaders(),
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || data?.msg || 'supabase_auth_failed');
  }

  return data;
}

async function refreshSupabaseSession(session) {
  if (!session?.refresh_token) return session;

  const data = await supabaseTokenRequest('refresh_token', {
    refresh_token: session.refresh_token
  });
  const normalized = normalizeSupabaseSession(data);
  if (normalized) {
    await setStoredSupabaseSession(normalized);
  }
  return normalized || session;
}

async function ensureValidSupabaseSession() {
  const session = await getStoredSupabaseSession();
  if (!session) return null;

  if (session.expires_at && session.refresh_token) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (session.expires_at - 60 <= nowSeconds) {
      try {
        return await refreshSupabaseSession(session);
      } catch (error) {
        console.warn('Supabase session refresh failed:', error.message);
      }
    }
  }

  return session;
}

async function loginSupabaseWithPassword(email, password) {
  const data = await supabaseTokenRequest('password', { email, password });
  const session = normalizeSupabaseSession(data);
  if (!session) {
    throw new Error('supabase_invalid_session');
  }
  await setStoredSupabaseSession(session);
  await clearCachedSupabaseProfile();
  return session;
}

async function sendSupabaseOtp(email) {
  const apiKey = getSupabaseApiKey();
  if (!SUPABASE_URL || !apiKey) {
    throw new Error('supabase_not_configured');
  }

  const payload = buildSupabaseOtpPayload(email);

  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: buildSupabaseHeaders(),
      body: JSON.stringify(payload)
    });
  } catch (error) {
    throw formatSupabaseFetchError(error, 'otp_send');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error_description || data?.error || data?.msg || 'supabase_otp_send_failed');
  }

  return true;
}

async function verifySupabaseOtp(email, token) {
  const apiKey = getSupabaseApiKey();
  if (!SUPABASE_URL || !apiKey) {
    throw new Error('supabase_not_configured');
  }

  const normalizedEmail = normalizeEmailAddress(email);
  const normalizedToken = (token || '').toString().trim();
  if (!normalizedEmail || !normalizedToken) {
    throw new Error('missing_code');
  }

  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: buildSupabaseHeaders(),
      body: JSON.stringify({
        email: normalizedEmail,
        token: normalizedToken,
        type: 'email'
      })
    });
  } catch (error) {
    throw formatSupabaseFetchError(error, 'otp_verify');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || data?.msg || 'supabase_otp_verify_failed');
  }

  const sessionPayload = data?.access_token ? data : data?.session;
  const session = normalizeSupabaseSession(sessionPayload);
  if (!session) {
    throw new Error('supabase_invalid_session');
  }

  await setStoredSupabaseSession(session);
  await clearCachedSupabaseProfile();
  return session;
}

async function signOutSupabase(session) {
  const apiKey = getSupabaseApiKey();
  if (!SUPABASE_URL || !apiKey || !session?.access_token) return;

  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: buildSupabaseHeaders(session.access_token)
  }).catch(() => null);
}

async function updateSupabasePassword(newPassword) {
  const apiKey = getSupabaseApiKey();
  if (!SUPABASE_URL || !apiKey) {
    throw new Error('supabase_not_configured');
  }

  const session = await ensureValidSupabaseSession();
  if (!session?.access_token) {
    throw new Error('supabase_not_authenticated');
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: buildSupabaseHeaders(session.access_token),
    body: JSON.stringify({ password: newPassword })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || data?.msg || 'supabase_password_update_failed');
  }

  return data;
}

async function fetchSupabaseProfile({ force = false } = {}) {
  const apiKey = getSupabaseApiKey();
  if (!SUPABASE_URL || !apiKey) return null;

  if (!force) {
    const cached = await getCachedSupabaseProfile();
    if (cached !== null) return cached;
  }

  const session = await ensureValidSupabaseSession();
  if (!session?.access_token || !session?.user?.id) return null;

  const url = new URL(`${SUPABASE_URL}/rest/v1/${SUPABASE_PROFILE_TABLE}`);
  url.searchParams.set('select', 'profile_data');
  url.searchParams.set('user_id', `eq.${session.user.id}`);
  url.searchParams.set('limit', '1');

  const response = await fetch(url.toString(), {
    headers: buildSupabaseHeaders(session.access_token)
  });

  const data = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'supabase_profile_fetch_failed');
  }

  const profile = Array.isArray(data) && data.length ? data[0].profile_data || null : null;
  await setCachedSupabaseProfile(profile);
  return profile;
}

async function saveSupabaseProfile(profileData) {
  const apiKey = getSupabaseApiKey();
  if (!SUPABASE_URL || !apiKey) {
    throw new Error('supabase_not_configured');
  }

  const session = await ensureValidSupabaseSession();
  if (!session?.access_token || !session?.user?.id) {
    throw new Error('supabase_not_authenticated');
  }

  const sanitizedProfile = sanitizeProfileForSave(profileData);
  let mergedProfile = sanitizedProfile;

  try {
    const currentProfile = await fetchSupabaseProfile({ force: true });
    if (isPlainObject(currentProfile)) {
      mergedProfile = mergeProfileWithDefaults(currentProfile, sanitizedProfile);
    }
  } catch (error) {
    console.warn('Supabase profile merge failed:', error.message);
  }

  await upsertSupabaseProfile(session, mergedProfile);
  await setCachedSupabaseProfile(mergedProfile);
  return mergedProfile;
}

function normalizeRemoteDocumentPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const storage = payload.storage || payload.storage_ref || null;
  const bucket = payload.bucket || storage?.bucket || null;
  const path = payload.path || payload.storage_path || storage?.path || storage?.key || null;
  const normalized = { ...payload };

  if (bucket && path) {
    normalized.storage = { bucket, path };
  }

  return normalized;
}

function extractRemoteDocumentsFromProfile(profile) {
  if (!isPlainObject(profile?.documents)) return {};

  const result = {};
  for (const key of ALLOWED_UPLOAD_KEYS) {
    const payload = normalizeRemoteDocumentPayload(profile.documents?.[key]);
    if (payload) {
      result[key] = payload;
    }
  }

  return result;
}

async function uploadSupabaseStorageObject(session, fieldKey, payload) {
  if (!payload?.data_url) {
    throw new Error('missing_upload_data');
  }

  if (!session?.access_token || !session?.user?.id) {
    throw new Error('supabase_no_session');
  }

  const blob = await dataUrlToBlob(payload.data_url);
  const mimeType = payload.mime_type || blob.type || 'application/octet-stream';
  const objectPath = buildStorageObjectPath(session.user.id, fieldKey, payload.file_name, mimeType);

  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      ...buildSupabaseStorageHeaders(session.access_token, mimeType),
      'x-upsert': 'true'
    },
    body: blob
  });

  if (!response.ok) {
    const message = await response.text().catch(() => 'supabase_storage_upload_failed');
    throw new Error(message || 'supabase_storage_upload_failed');
  }

  return {
    file_name: payload.file_name,
    mime_type: mimeType,
    size: payload.size || blob.size || 0,
    last_modified: payload.last_modified || Date.now(),
    uploaded_at: new Date().toISOString(),
    storage: {
      bucket: SUPABASE_STORAGE_BUCKET,
      path: objectPath
    }
  };
}

async function downloadSupabaseStorageObject(session, payload) {
  if (!session?.access_token) return null;

  const bucket = payload?.storage?.bucket || payload?.bucket || SUPABASE_STORAGE_BUCKET;
  const path = payload?.storage?.path || payload?.path || payload?.storage_path || null;
  if (!bucket || !path) return null;

  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    headers: buildSupabaseStorageHeaders(session.access_token)
  });

  if (!response.ok) {
    const message = await response.text().catch(() => 'supabase_storage_download_failed');
    throw new Error(message || 'supabase_storage_download_failed');
  }

  const blob = await response.blob();
  const dataUrl = await blobToDataUrl(blob);
  return {
    file_name: payload?.file_name || path.split('/').pop() || 'upload',
    mime_type: payload?.mime_type || blob.type,
    size: payload?.size || blob.size || 0,
    last_modified: payload?.last_modified || Date.now(),
    data_url: dataUrl,
    storage: {
      bucket,
      path
    }
  };
}

async function deleteSupabaseStorageObject(session, payload) {
  if (!session?.access_token) return;

  const bucket = payload?.storage?.bucket || payload?.bucket || SUPABASE_STORAGE_BUCKET;
  const path = payload?.storage?.path || payload?.path || payload?.storage_path || null;
  if (!bucket || !path) return;

  await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'DELETE',
    headers: buildSupabaseStorageHeaders(session.access_token)
  }).catch(() => null);
}

async function upsertSupabaseProfile(session, profileData) {
  const apiKey = getSupabaseApiKey();
  if (!SUPABASE_URL || !apiKey || !session?.user?.id) {
    throw new Error('supabase_not_configured');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_PROFILE_TABLE}`, {
    method: 'POST',
    headers: {
      ...buildSupabaseHeaders(session.access_token),
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify([
      {
        user_id: session.user.id,
        profile_data: profileData
      }
    ])
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'supabase_profile_upsert_failed');
  }

  return data;
}

async function updateSupabaseProfileDocuments(session, documentUpdates) {
  if (!session?.access_token || !session?.user?.id) return;

  let currentProfile = null;
  try {
    currentProfile = await fetchSupabaseProfile({ force: true });
  } catch (error) {
    console.warn('Supabase profile refresh failed:', error.message);
  }

  const baseProfile = isPlainObject(currentProfile) ? currentProfile : {};
  const currentDocuments = isPlainObject(baseProfile.documents) ? baseProfile.documents : {};
  const nextDocuments = {
    ...currentDocuments,
    ...documentUpdates
  };

  const nextProfile = {
    ...baseProfile,
    documents: nextDocuments
  };

  await upsertSupabaseProfile(session, nextProfile);
  await setCachedSupabaseProfile(nextProfile);
}

async function syncUploadDocumentToSupabase(fieldKey, payload) {
  const session = await ensureValidSupabaseSession();
  if (!session?.access_token || !session?.user?.id) return null;

  const uploaded = await uploadSupabaseStorageObject(session, fieldKey, payload);
  await updateSupabaseProfileDocuments(session, {
    [fieldKey]: uploaded
  });
  return uploaded;
}

async function ensureRemoteUploadDocuments(documents) {
  const sanitized = sanitizeUploadDocuments(documents || {});
  const missingKeys = Array.from(ALLOWED_UPLOAD_KEYS).filter(key => !sanitized[key]);
  if (missingKeys.length === 0) return sanitized;

  let remoteProfile = null;
  try {
    remoteProfile = await fetchSupabaseProfile();
  } catch (error) {
    console.warn('Supabase profile fetch for uploads failed:', error.message);
    return sanitized;
  }

  const remoteDocuments = extractRemoteDocumentsFromProfile(remoteProfile);
  const session = await ensureValidSupabaseSession();
  if (!session?.access_token) return sanitized;

  const downloaded = {};
  for (const key of missingKeys) {
    const payload = normalizeRemoteDocumentPayload(remoteDocuments[key]);
    if (!payload) continue;

    if (payload.data_url || payload.base64 || payload.url) {
      downloaded[key] = payload;
      continue;
    }

    if (payload.storage?.path) {
      try {
        const downloadedPayload = await downloadSupabaseStorageObject(session, payload);
        if (downloadedPayload) {
          downloaded[key] = downloadedPayload;
        }
      } catch (error) {
        console.warn(`Supabase download failed for ${key}:`, error.message);
      }
    }
  }

  if (Object.keys(downloaded).length === 0) {
    return sanitized;
  }

  const nextDocuments = {
    ...sanitized,
    ...downloaded
  };

  try {
    await setStoredUploadDocumentsAsync(nextDocuments);
  } catch (error) {
    console.warn('Failed to cache remote uploads locally:', error.message);
  }

  return nextDocuments;
}

async function removeSupabaseProfileDocument(fieldKey) {
  const session = await ensureValidSupabaseSession();
  if (!session?.access_token || !session?.user?.id) return;

  let currentProfile = null;
  try {
    currentProfile = await fetchSupabaseProfile({ force: true });
  } catch (error) {
    console.warn('Supabase profile refresh failed:', error.message);
  }

  const baseProfile = isPlainObject(currentProfile) ? currentProfile : {};
  const currentDocuments = isPlainObject(baseProfile.documents) ? { ...baseProfile.documents } : {};
  const targetPayload = normalizeRemoteDocumentPayload(currentDocuments[fieldKey]);

  if (targetPayload?.storage?.path) {
    await deleteSupabaseStorageObject(session, targetPayload);
  }

  delete currentDocuments[fieldKey];

  const nextProfile = {
    ...baseProfile,
    documents: currentDocuments
  };

  await upsertSupabaseProfile(session, nextProfile);
  await setCachedSupabaseProfile(nextProfile);
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getUserData') {
    (async () => {
      let documents = await getStoredUploadDocumentsAsync();
      documents = await ensureRemoteUploadDocuments(documents);
      let baseProfile = userData;

      try {
        const remoteProfile = await fetchSupabaseProfile();
        if (isPlainObject(remoteProfile)) {
          baseProfile = mergeProfileWithDefaults(userData, remoteProfile);
        }
      } catch (error) {
        console.warn('Supabase profile fetch failed:', error.message);
      }

      sendResponse({
        userData: buildUserDataWithStoredUploads(documents, baseProfile),
        fieldMappings: fieldMappings
      });
    })();
    return true;
  }

  if (request.action === 'authGetSession') {
    (async () => {
      const session = await getStoredSupabaseSession();
      sendResponse({
        success: true,
        session: buildSessionSummary(session)
      });
    })();
    return true;
  }

  if (request.action === 'authLogin') {
    const email = request.email;
    const password = request.password;
    if (!email || !password) {
      sendResponse({ success: false, error: 'missing_credentials' });
      return false;
    }

    (async () => {
      try {
        const session = await loginSupabaseWithPassword(email, password);
        sendResponse({ success: true, session: buildSessionSummary(session) });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.action === 'authSendOtp') {
    const email = request.email;
    if (!email) {
      sendResponse({ success: false, error: 'missing_email' });
      return false;
    }

    (async () => {
      try {
        await sendSupabaseOtp(email);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.action === 'authVerifyOtp') {
    const email = request.email;
    const token = request.token;
    if (!email || !token) {
      sendResponse({ success: false, error: 'missing_code' });
      return false;
    }

    (async () => {
      try {
        const session = await verifySupabaseOtp(email, token);
        sendResponse({ success: true, session: buildSessionSummary(session) });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.action === 'authLogout') {
    (async () => {
      try {
        const session = await getStoredSupabaseSession();
        if (session) {
          await signOutSupabase(session);
        }
        await clearStoredSupabaseSession();
        await clearCachedSupabaseProfile();
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.action === 'authUpdatePassword') {
    const password = request.password || '';
    if (!password.trim()) {
      sendResponse({ success: false, error: 'missing_password' });
      return false;
    }

    (async () => {
      try {
        await updateSupabasePassword(password);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.action === 'saveProfile') {
    const profile = request.profile;
    if (!isPlainObject(profile)) {
      sendResponse({ success: false, error: 'invalid_profile' });
      return false;
    }

    (async () => {
      try {
        const savedProfile = await saveSupabaseProfile(profile);
        sendResponse({ success: true, profile: savedProfile });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.action === 'fetchProfile') {
    (async () => {
      try {
        const profile = await fetchSupabaseProfile({ force: !!request.force });
        sendResponse({ success: true, profile });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.action === 'getUploadDocuments') {
    (async () => {
      let documents = await getStoredUploadDocumentsAsync();
      documents = await ensureRemoteUploadDocuments(documents);
      sendResponse({ documents: buildUploadDocumentsResponse(documents) });
    })();
    return true;
  }

  if (request.action === 'saveUploadDocument') {
    const { key, payload } = request;
    if (!ALLOWED_UPLOAD_KEYS.has(key) || !payload) {
      sendResponse({ success: false, error: 'invalid_upload_payload' });
      return false;
    }

    (async () => {
      try {
        let nextPayload = payload;
        if (payload.data_url) {
          try {
            const cloudMeta = await syncUploadDocumentToSupabase(key, payload);
            if (cloudMeta?.storage?.path) {
              nextPayload = {
                ...payload,
                storage: cloudMeta.storage
              };
            }
          } catch (error) {
            console.warn(`Supabase upload failed for ${key}:`, error.message);
          }
        }

        const documents = await getStoredUploadDocumentsAsync();
        const nextDocuments = {
          ...documents,
          [key]: nextPayload
        };

        await setStoredUploadDocumentsAsync(nextDocuments);
        sendResponse({ success: true, documents: nextDocuments });
      } catch (error) {
        sendResponse({ success: false, error: error.message || 'storage_set_failed' });
      }
    })();
    return true;
  }

  if (request.action === 'saveUploadDocumentDataUrl') {
    const { key, payload } = request;
    if (!ALLOWED_UPLOAD_KEYS.has(key) || !payload?.data_url) {
      sendResponse({ success: false, error: 'invalid_upload_payload' });
      return false;
    }

    (async () => {
      try {
        const processedPayload = await buildUploadPayloadFromSource(payload);
        let nextPayload = processedPayload;

        try {
          const cloudMeta = await syncUploadDocumentToSupabase(key, processedPayload);
          if (cloudMeta?.storage?.path) {
            nextPayload = {
              ...processedPayload,
              storage: cloudMeta.storage
            };
          }
        } catch (error) {
          console.warn(`Supabase upload failed for ${key}:`, error.message);
        }

        const documents = await getStoredUploadDocumentsAsync();
        const nextDocuments = {
          ...documents,
          [key]: nextPayload
        };

        await setStoredUploadDocumentsAsync(nextDocuments);
        sendResponse({ success: true, documents: nextDocuments });
      } catch (error) {
        sendResponse({
          success: false,
          error: error?.message || 'save_upload_document_data_url_failed'
        });
      }
    })();

    return true;
  }

  if (request.action === 'clearUploadDocument') {
    const { key } = request;
    if (!ALLOWED_UPLOAD_KEYS.has(key)) {
      sendResponse({ success: false, error: 'invalid_upload_key' });
      return false;
    }

    (async () => {
      try {
        const documents = await getStoredUploadDocumentsAsync();
        const nextDocuments = { ...documents };
        delete nextDocuments[key];
        await setStoredUploadDocumentsAsync(nextDocuments);

        try {
          await removeSupabaseProfileDocument(key);
        } catch (error) {
          console.warn(`Supabase delete failed for ${key}:`, error.message);
        }

        sendResponse({ success: true, documents: nextDocuments });
      } catch (error) {
        sendResponse({ success: false, error: error.message || 'storage_set_failed' });
      }
    })();
    return true;
  }

  if (request.action === 'openUploadPanel') {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?mode=upload') }, (tab) => {
      if (chrome.runtime.lastError) {
        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message
        });
        return;
      }

      sendResponse({
        success: true,
        tabId: tab?.id || null
      });
    });
    return true;
  }
});
