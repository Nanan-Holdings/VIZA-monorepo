import type { InterfaceLocale } from "@/lib/i18n/locale";

export type InterviewRequired = "city" | "time" | "money" | "work" | "ties" | "detail";
export type OfficerId = "miller" | "chen" | "williams" | "garcia" | "obama";

export type InterviewStepCopy = {
  topic: string;
  question: string;
  required: InterviewRequired[];
  followUp: string;
};

export type InterviewOfficer = {
  id: OfficerId;
  name: string;
  title: string;
  style: string;
  pressure: string;
  description: string;
  image: string;
  avatarId: string;
  voice: string;
  voiceGender: "male" | "female";
  speechRate: number;
};

type FeatureCopy = { icon: string; title: string; description: string };
type StepCopy = { number: number; title: string; description: string };
type TipCopy = { icon: string; text: string };

export type InterviewCopy = {
  start: {
    navLabel: string;
    badge: string;
    titleLead: string;
    titleAccent: string;
    description: string;
    startButton: string;
    stats: Array<{ value: string; label: string }>;
    liveOfficer: string;
    protocol: string;
    currentQuestion: string;
    previewQuestion: string;
    featuresLabel: string;
    features: FeatureCopy[];
    stepsLabel: string;
    steps: StepCopy[];
    readyTitle: string;
    readyDescription: string;
    readyButton: string;
    systemNormal: string;
    engineRunning: string;
    footerLabel: string;
  };
  checklist: {
    back: string;
    stepOne: string;
    stepTwo: string;
    title: string;
    description: string;
    items: Array<{ label: string; description: string }>;
    checked: string;
    pending: string;
    checkedCount: string;
    nextButton: string;
  };
  officer: {
    back: string;
    materialsConfirmed: string;
    title: string;
    description: string;
    currentSelection: string;
    interviewerSuffix: string;
    pressure: string;
    simulationNotice: string;
    startButton: string;
  };
  interview: {
    statusPill: string;
    muted: string;
    readingEnabled: string;
    endButton: string;
    realtimeAnalysis: string;
    aiScanning: string;
    metrics: { confidence: string; fluency: string; emotion: string };
    quickReview: string;
    answerTags: {
      complete: string;
      tooShort: string;
      specificNumber: string;
      clearDestination: string;
      funding: string;
      timing: string;
      work: string;
      family: string;
    };
    tipsTitle: string;
    tips: {
      funding: TipCopy[];
      work: TipCopy[];
      ties: TipCopy[];
      time: TipCopy[];
      lodging: TipCopy[];
      cities: TipCopy[];
      purpose: TipCopy[];
      general: TipCopy[];
    };
    loading: string;
    consularOfficer: string;
    avatarAnimation: string;
    connectedStatus: string;
    connectingStatus: string;
    fallbackStatus: string;
    currentQuestion: string;
    starting: string;
    stopRecording: string;
    startSpeaking: string;
    viewReport: string;
    responding: string;
    recordingStatus: string;
    transcriptTitle: string;
    transcriptDescription: string;
    answerCountSuffix: string;
    transcriptEmpty: string;
    officerLabel: string;
    applicantLabel: string;
    listeningPlaceholder: string;
    answerPlaceholder: string;
    stopAndSend: string;
    voiceAnswer: string;
    sendAnswer: string;
    engineRunning: string;
    footerLabel: string;
    unsupportedSpeechRecognition: string;
  };
  report: {
    footerLabel: string;
    title: string;
    overallScore: string;
    passProbability: string;
    completed: string;
    modules: string;
    retry: string;
    dimensionsTitle: string;
    dimensions: { clarity: string; confidence: string; consistency: string; narrativeAlignment: string };
    insightsTitle: string;
    strengthsTitle: string;
    improvementsTitle: string;
    analysisTitle: string;
    analysisPrefix: string;
    systemNormal: string;
    reportGenerated: string;
    passLikelihood: { high: string; medium: string; low: string };
    flagLabels: { strong: string; weak: string; neutral: string };
    fallback: {
      strengths: string[];
      improvements: string[];
      note: string;
      topic: string;
      unanswered: string;
    };
  };
  loadingReport: { title: string; description: string };
  plan: {
    fallbackCountry: string;
    fallbackDuration: string;
    fallbackFunding: string;
    fallbackOccupation: string;
    fallbackTies: string;
    opening: InterviewStepCopy;
    family: InterviewStepCopy[];
    business: InterviewStepCopy[];
    travel: InterviewStepCopy[];
    stay: InterviewStepCopy;
    funding: InterviewStepCopy;
    work: InterviewStepCopy;
    returnPlan: InterviewStepCopy;
    travelHistory: InterviewStepCopy;
    endingTopic: string;
    endingMessage: string;
    fallbackQuestions: string[];
  };
};

const OFFICER_IMAGE =
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=560&h=800&fit=crop&crop=top";

type OfficerDefinition = Omit<InterviewOfficer, "title" | "style" | "pressure" | "description" | "voice"> & {
  voices: Record<InterfaceLocale, string>;
  display: Record<InterfaceLocale, Pick<InterviewOfficer, "title" | "style" | "pressure" | "description">>;
};

const OFFICER_DEFINITIONS: OfficerDefinition[] = [
  {
    id: "miller",
    name: "Miller",
    image: OFFICER_IMAGE,
    avatarId: "officer_miller",
    voiceGender: "male",
    speechRate: 0.88,
    voices: { zh: "zh-CN-YunxiNeural", en: "en-US-GuyNeural" },
    display: {
      zh: { title: "标准型", pressure: "标准", style: "沉稳、中性、按真实窗口节奏核实核心事实", description: "节奏均衡，适合第一次练习" },
      en: { title: "Standard", pressure: "Standard", style: "Calm and neutral, checking core facts at a realistic window pace", description: "Balanced pacing for a first practice" },
    },
  },
  {
    id: "chen",
    name: "Chen",
    image: "https://images.unsplash.com/photo-1573496799652-408c2ac9fe98?w=560&h=800&fit=crop&crop=top",
    avatarId: "officer_chen",
    voiceGender: "female",
    speechRate: 1.02,
    voices: { zh: "zh-CN-XiaoxiaoNeural", en: "en-US-AriaNeural" },
    display: {
      zh: { title: "快速型", pressure: "较高", style: "语速较快、问题极短、回答含糊时立即追问", description: "短而快速的问题，训练临场反应" },
      en: { title: "Fast-paced", pressure: "High", style: "Fast delivery and very short questions, with immediate follow-ups when answers are vague", description: "Short, fast questions to train quick responses" },
    },
  },
  {
    id: "williams",
    name: "Williams",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=560&h=800&fit=crop&crop=top",
    avatarId: "officer_williams",
    voiceGender: "male",
    speechRate: 0.93,
    voices: { zh: "zh-CN-YunjianNeural", en: "en-US-DavisNeural" },
    display: {
      zh: { title: "核验型", pressure: "较高", style: "关注时间、金额、工作年限和前后陈述是否一致", description: "重视细节和材料一致性" },
      en: { title: "Verifier", pressure: "High", style: "Focuses on timing, amounts, work history, and consistency across your statements", description: "Careful about details and document consistency" },
    },
  },
  {
    id: "garcia",
    name: "Garcia",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=560&h=800&fit=crop&crop=top",
    avatarId: "officer_garcia",
    voiceGender: "female",
    speechRate: 0.84,
    voices: { zh: "zh-CN-XiaoyiNeural", en: "en-US-JennyNeural" },
    display: {
      zh: { title: "自然型", pressure: "较低", style: "语气自然但保持专业，通过简短对话了解旅行真实性", description: "自然的氛围，适合建立信心" },
      en: { title: "Conversational", pressure: "Low", style: "Natural but professional, using a short conversation to understand whether the trip is genuine", description: "A natural atmosphere to build confidence" },
    },
  },
  {
    id: "obama",
    name: "Obama",
    image: "/images/interview-officers/obama-simulation.png",
    avatarId: "officer_obama",
    voiceGender: "male",
    speechRate: 0.9,
    voices: { zh: "zh-CN-YunyangNeural", en: "en-US-TonyNeural" },
    display: {
      zh: { title: "总统风格", pressure: "标准", style: "沉着、自信、善于用简短追问核实回答的逻辑和真实性；不模仿政治演讲", description: "特别体验形象，沉着而有逻辑" },
      en: { title: "Presidential style", pressure: "Standard", style: "Composed and confident, using concise follow-ups to test logic and credibility; no political speech imitation", description: "A special experience with a calm, logical style" },
    },
  },
];

export const OFFICER_IDS = OFFICER_DEFINITIONS.map(({ id }) => id);

export function getOfficerProfile(id: string, locale: InterfaceLocale): InterviewOfficer {
  const definition = OFFICER_DEFINITIONS.find((item) => item.id === id) ?? OFFICER_DEFINITIONS[0];
  return {
    id: definition.id,
    name: definition.name,
    image: definition.image,
    avatarId: definition.avatarId,
    voiceGender: definition.voiceGender,
    speechRate: definition.speechRate,
    voice: definition.voices[locale],
    ...definition.display[locale],
  };
}

const enCopy: InterviewCopy = {
  start: {
    navLabel: "Practice interview",
    badge: "B1/B2 · AI visa interview simulation",
    titleLead: "One practice session,",
    titleAccent: "one less surprise",
    description: "Practice a realistic conversation with an AI consular officer. Review each answer with a score and improvement suggestions when you finish.",
    startButton: "▶ Start practice interview",
    stats: [
      { value: "AI", label: "Consular officer" },
      { value: "Each", label: "Answer report" },
      { value: "Free", label: "Unlimited practice" },
    ],
    liveOfficer: "Live · Consular officer",
    protocol: "Protocol: B1/B2",
    currentQuestion: "Current question",
    previewQuestion: "What are you going to the U.S. for?",
    featuresLabel: "Key features",
    features: [
      { icon: "👨‍💼", title: "Realistic questions", description: "The AI uses concise consular language to recreate the pressure of a real visa window: direct questions and follow-ups without coaching." },
      { icon: "🎙️", title: "Two-way voice", description: "Answer by voice and hear the AI read each question aloud. Build spoken clarity and response speed through immersive practice." },
      { icon: "📊", title: "Answer-by-answer report", description: "Get an automatic report with an overall score, pass likelihood, and strengths and improvements for each question." },
    ],
    stepsLabel: "How it works",
    steps: [
      { number: 1, title: "Start", description: "Enter the AI practice interview directly. No registration is required, and practice is free." },
      { number: 2, title: "Answer by voice or text", description: "The AI asks one question at a time at a realistic pace, with voice answers supported." },
      { number: 3, title: "Read your report", description: "Receive an overall score, question-by-question analysis, and targeted suggestions." },
    ],
    readyTitle: "Ready to begin?",
    readyDescription: "The interview gives you one chance; practice gives you as many as you need.",
    readyButton: "Start now →",
    systemNormal: "System normal",
    engineRunning: "AI engine running",
    footerLabel: "B1/B2 tourist visa",
  },
  checklist: {
    back: "← Back",
    stepOne: "Interview preparation",
    stepTwo: "2 Choose an officer",
    title: "Confirm your materials",
    description: "Check the documents you will bring to the consulate. This only confirms your preparation; no personal profile is required.",
    items: [
      { label: "Passport (valid for at least 6 months)", description: "Make sure your passport will not expire during the visa validity period" },
      { label: "DS-160 nonimmigrant visa application", description: "Completed online, with the confirmation page printed" },
      { label: "Interview appointment confirmation", description: "Appointment confirmation issued by the embassy or consulate" },
      { label: "Recent color passport photo", description: "Meets U.S. visa photo requirements (5×5 cm)" },
      { label: "Bank statements / proof of funds", description: "Savings or income evidence from the past 3–6 months" },
      { label: "Employment letter / business license", description: "Shows stable work or business ties at home" },
    ],
    checked: "Confirmed",
    pending: "To confirm",
    checkedCount: "confirmed",
    nextButton: "Next: choose an officer",
  },
  officer: {
    back: "← Back to materials",
    materialsConfirmed: "Materials confirmed",
    title: "Who would you like to practice with?",
    description: "Each officer has a different pace and follow-up style. The report uses the same assessment standard.",
    currentSelection: "Current selection:",
    interviewerSuffix: "officer",
    pressure: "Pressure",
    simulationNotice: "AI simulation image; not the person or official content",
    startButton: "Start practice interview",
  },
  interview: {
    statusPill: "B1/B2 tourist visa · Practice in progress",
    muted: "🔇 Muted",
    readingEnabled: "🔊 Reading on",
    endButton: "End interview",
    realtimeAnalysis: "Live analysis",
    aiScanning: "AI scanning",
    metrics: { confidence: "Speaking confidence", fluency: "Fluency", emotion: "Emotion" },
    quickReview: "Quick answer review",
    answerTags: {
      complete: "Complete answer",
      tooShort: "Answer is too short",
      specificNumber: "Specific number included",
      clearDestination: "Clear destination",
      funding: "Funding plan included",
      timing: "Timing plan included",
      work: "Work situation included",
      family: "Home ties included",
    },
    tipsTitle: "Answer tips",
    tips: {
      funding: [
        { icon: "💰", text: "Mention the exact amount and source of funds" },
        { icon: "📄", text: "If you have bank statements or savings evidence, mention them" },
        { icon: "✅", text: "Say clearly whether you are paying yourself or receiving family support" },
      ],
      work: [
        { icon: "🏢", text: "Give the company name and your position" },
        { icon: "📅", text: "Mention that your leave has been approved" },
        { icon: "💼", text: "Stable work is strong evidence that you intend to return home" },
      ],
      ties: [
        { icon: "👨‍👩‍👧", text: "Mention specific family members; concrete details are more convincing" },
        { icon: "🏠", text: "Explain your work or life plans after returning home" },
        { icon: "🔗", text: "Specific responsibilities are more useful than general statements" },
      ],
      time: [
        { icon: "✈️", text: "Give a clear number of days, such as three weeks" },
        { icon: "🎫", text: "Mention your return ticket if it has already been booked" },
        { icon: "⏱️", text: "Your stay should match the purpose of your trip" },
      ],
      lodging: [
        { icon: "🏨", text: "Give the area or hotel name" },
        { icon: "📋", text: "A booking record adds credibility" },
        { icon: "📍", text: "Your lodging should fit the cities in your itinerary" },
      ],
      cities: [
        { icon: "🗺️", text: "List specific cities and describe the route" },
        { icon: "📅", text: "Say roughly how many days you will spend in each place" },
        { icon: "🎯", text: "A themed itinerary is more convincing, such as a cultural trip" },
      ],
      purpose: [
        { icon: "🎯", text: "Explain the main purpose of the trip with specific details" },
        { icon: "📋", text: "Planning ahead shows that you are prepared" },
        { icon: "💬", text: "Avoid only saying ‘I am going to have fun’; give real details" },
      ],
      general: [
        { icon: "💬", text: "Keep your answer concise and direct" },
        { icon: "👁️", text: "Stay natural instead of reciting a script" },
        { icon: "📌", text: "Keep your answer consistent with your visa materials" },
      ],
    },
    loading: "Loading…",
    consularOfficer: "CONSULAR OFFICER",
    avatarAnimation: "Voice animation",
    connectedStatus: "Live avatar connected",
    connectingStatus: "Connecting live avatar",
    fallbackStatus: "Voice animation mode",
    currentQuestion: "Current question",
    starting: "The interview is about to begin…",
    stopRecording: "Stop recording",
    startSpeaking: "Start speaking",
    viewReport: "View interview report →",
    responding: "Officer is responding…",
    recordingStatus: "Recording. Speak now… click the microphone to stop",
    transcriptTitle: "Interview record",
    transcriptDescription: "Text and voice answers are both kept",
    answerCountSuffix: "answers",
    transcriptEmpty: "Your questions and answers will appear here when the interview starts.",
    officerLabel: "Officer",
    applicantLabel: "You",
    listeningPlaceholder: "Listening to you…",
    answerPlaceholder: "Type an answer, Enter to send, Shift+Enter for a new line",
    stopAndSend: "Stop recording and send",
    voiceAnswer: "Voice answer",
    sendAnswer: "Send answer",
    engineRunning: "AI engine running",
    footerLabel: "B1/B2 visa simulation",
    unsupportedSpeechRecognition: "Speech recognition is not supported in this browser. Please use Chrome or Edge.",
  },
  report: {
    footerLabel: "B1/B2 visa simulation",
    title: "B1/B2 visa practice interview",
    overallScore: "Overall score",
    passProbability: "Pass likelihood:",
    completed: "Completed",
    modules: "modules",
    retry: "↺ Practice again",
    dimensionsTitle: "Skill dimensions",
    dimensions: { clarity: "Clarity", confidence: "Confidence", consistency: "Consistency", narrativeAlignment: "Narrative alignment" },
    insightsTitle: "AI insights",
    strengthsTitle: "✓ Key strengths",
    improvementsTitle: "! Needs improvement",
    analysisTitle: "Question analysis",
    analysisPrefix: "Analysis:",
    systemNormal: "System normal",
    reportGenerated: "Report generated",
    passLikelihood: { high: "High", medium: "Medium", low: "Low" },
    flagLabels: { strong: "Strong", weak: "Needs work", neutral: "Neutral" },
    fallback: {
      strengths: ["Your answers were generally fluent and communicative", "Some answers were direct and clear"],
      improvements: ["Prepare specific itinerary details in advance", "Explain your source of funds more clearly and specifically"],
      note: "The answer generally meets the requirement",
      topic: "Overall assessment",
      unanswered: "(No answer)",
    },
  },
  loadingReport: { title: "Generating your interview report…", description: "The AI is analyzing your answers. Please wait." },
  plan: {
    fallbackCountry: "the U.S.",
    fallbackDuration: "this period",
    fallbackFunding: "this trip",
    fallbackOccupation: "your current work or status",
    fallbackTies: "your plans at home",
    opening: { topic: "Trip purpose", question: "What are you going to the U.S. for?", required: ["detail"], followUp: "What exactly will you do there?" },
    family: [
      { topic: "Relationship to invitee", question: "Who are you visiting?", required: ["detail"], followUp: "What is your relationship?" },
      { topic: "Invitee details", question: "What does that person do in the U.S.?", required: ["detail"], followUp: "What is their current status?" },
    ],
    business: [
      { topic: "Business activity", question: "What business activity are you attending?", required: ["detail"], followUp: "What is the event or other company called?" },
      { topic: "Role connection", question: "Why do you need to go?", required: ["work", "detail"], followUp: "How does this relate to your responsibilities?" },
    ],
    travel: [
      { topic: "Travel plans", question: "Which places in {cities} are you planning to visit?", required: ["city", "detail"], followUp: "Which city is the main destination?" },
      { topic: "Travel companions", question: "Who is traveling with you?", required: ["detail"], followUp: "Are you traveling alone?" },
    ],
    stay: { topic: "Length of stay", question: "How long will you stay in the U.S. ({duration})?", required: ["time"], followUp: "How many days exactly?" },
    funding: { topic: "Source of funds", question: "Who will pay for this trip ({funding})?", required: ["money"], followUp: "What budget are you planning for this trip?" },
    work: { topic: "Work situation", question: "What do you do for work ({occupation})?", required: ["work", "detail"], followUp: "How long have you worked there?" },
    returnPlan: { topic: "Plans after returning", question: "What will you do after the trip?", required: ["ties", "detail"], followUp: "You mentioned {ties}; what are those plans specifically?" },
    travelHistory: { topic: "Travel history", question: "Have you traveled abroad before?", required: ["detail"], followUp: "Where did you go most recently?" },
    endingTopic: "Interview complete",
    endingMessage: "Thank you. That concludes today's interview.",
    fallbackQuestions: ["What is the main purpose of your trip?", "What exactly will you do?", "Why did you choose this time?", "Which cities are you visiting?", "How long will you stay?", "Have you booked a return ticket?", "Where will you stay?", "Who will pay for the trip?", "What is your approximate budget?", "What do you do at home?", "Which company or organization do you work for?", "What will bring you back home after the trip?"],
  },
};

const zhCopy: InterviewCopy = {
  start: {
    navLabel: "模拟面试",
    badge: "B1/B2 · AI 签证面试仿真",
    titleLead: "一次模拟，",
    titleAccent: "少一份意外",
    description: "与 AI 领事官进行仿真对话练习，考察真实签证场景问题，面试结束后给出逐题评分与改进建议。",
    startButton: "▶ 开始模拟面试",
    stats: [
      { value: "AI", label: "仿真领事官" },
      { value: "逐题", label: "评估报告" },
      { value: "免费", label: "无限练习" },
    ],
    liveOfficer: "实时 · 领事官",
    protocol: "协议：B1/B2",
    currentQuestion: "当前问题",
    previewQuestion: "去美国做什么？",
    featuresLabel: "核心功能",
    features: [
      { icon: "👨‍💼", title: "真实口吻提问", description: "AI 采用领事官极简短句风格，模拟签证窗口真实问答压力，不引导、不解释、直接追问。" },
      { icon: "🎙️", title: "语音双向交互", description: "支持语音作答与 AI 朗读提问，全程沉浸练习，口语表达与反应速度同步提升。" },
      { icon: "📊", title: "逐题评估报告", description: "面试结束自动生成报告：综合评分、通过概率及每道题的优劣分析与改进建议。" },
    ],
    stepsLabel: "使用流程",
    steps: [
      { number: 1, title: "点击开始", description: "无需注册，直接进入 AI 仿真面试，全程免费使用。" },
      { number: 2, title: "语音 / 文字作答", description: "AI 按真实节奏逐题提问，支持语音回答。" },
      { number: 3, title: "查看详细报告", description: "自动生成综合评分报告，逐题分析并给出针对性改进建议。" },
    ],
    readyTitle: "准备好了吗？",
    readyDescription: "面试只有一次机会，练习可以无数次。",
    readyButton: "立即开始 →",
    systemNormal: "系统正常",
    engineRunning: "AI 引擎运行中",
    footerLabel: "B1/B2 旅游签证",
  },
  checklist: {
    back: "← 返回",
    stepOne: "面试准备",
    stepTwo: "2 选择面试官",
    title: "确认随身材料",
    description: "勾选你会带去领事馆的文件。这里只做准备确认，不需要填写个人档案。",
    items: [
      { label: "护照（有效期 6 个月以上）", description: "确保护照在签证有效期内不会过期" },
      { label: "DS-160 非移民签证申请表", description: "已在线填写并打印确认页" },
      { label: "面试预约确认函", description: "大使馆或领事馆出具的预约确认文件" },
      { label: "近期白底彩色证件照", description: "符合美国签证照片要求（5×5cm）" },
      { label: "银行流水 / 资金证明", description: "近 3–6 个月的存款或收入证明" },
      { label: "在职证明 / 营业执照", description: "证明您在国内有稳定的工作或业务" },
    ],
    checked: "已确认",
    pending: "待确认",
    checkedCount: "已确认",
    nextButton: "下一步：选择面试官",
  },
  officer: {
    back: "← 返回材料确认",
    materialsConfirmed: "材料已确认",
    title: "你想和谁练习？",
    description: "每位面试官拥有不同节奏和追问习惯，报告使用同一套标准。",
    currentSelection: "当前选择：",
    interviewerSuffix: "面试官",
    pressure: "压力",
    simulationNotice: "AI 模拟形象，非本人或官方内容",
    startButton: "开始模拟面试",
  },
  interview: {
    statusPill: "B1/B2 旅游签证 · 模拟进行中",
    muted: "🔇 已静音",
    readingEnabled: "🔊 朗读开启",
    endButton: "结束面试",
    realtimeAnalysis: "实时分析",
    aiScanning: "AI 扫描中",
    metrics: { confidence: "表达置信度", fluency: "流利程度", emotion: "情绪检测" },
    quickReview: "答题快评",
    answerTags: {
      complete: "回答完整",
      tooShort: "回答过于简短",
      specificNumber: "提及具体数字",
      clearDestination: "有明确目的地",
      funding: "提及费用安排",
      timing: "说明时间安排",
      work: "说明工作情况",
      family: "提及家庭牵挂",
    },
    tipsTitle: "答题小贴士",
    tips: {
      funding: [
        { icon: "💰", text: "建议提及具体金额和资金来源" },
        { icon: "📄", text: "如有银行流水或存款证明，主动说明" },
        { icon: "✅", text: "说清是自费还是家人资助" },
      ],
      work: [
        { icon: "🏢", text: "说出具体公司名称和您的职位" },
        { icon: "📅", text: "提一句请假已经获批" },
        { icon: "💼", text: "稳定的工作是回国意愿的有力证明" },
      ],
      ties: [
        { icon: "👨‍👩‍👧", text: "提及具体家庭成员，越真实越有说服力" },
        { icon: "🏠", text: "说明回国后有明确的工作或生活安排" },
        { icon: "🔗", text: "具体的责任牵挂比泛泛而谈更有效" },
      ],
      time: [
        { icon: "✈️", text: "给出明确天数，例如：打算待三周" },
        { icon: "🎫", text: "已订好回程机票的话，主动提出来" },
        { icon: "⏱️", text: "停留时间要和旅行目的匹配" },
      ],
      lodging: [
        { icon: "🏨", text: "说出具体住宿区域或酒店名称" },
        { icon: "📋", text: "有预订记录会大大增加可信度" },
        { icon: "📍", text: "住宿地点最好与行程城市一致" },
      ],
      cities: [
        { icon: "🗺️", text: "列出具体城市，说明大概路线" },
        { icon: "📅", text: "说明每个地方大概待几天" },
        { icon: "🎯", text: "有主题的行程更有说服力，例如文化游" },
      ],
      purpose: [
        { icon: "🎯", text: "说清楚旅行的主要目的，越具体越好" },
        { icon: "📋", text: "提前做过规划会显得更有备而来" },
        { icon: "💬", text: "避免只说【就是去玩】，给出真实细节" },
      ],
      general: [
        { icon: "💬", text: "回答要简洁直接，不要绕弯子" },
        { icon: "👁️", text: "保持自然，不要背稿子" },
        { icon: "📌", text: "回答要与您的签证材料保持一致" },
      ],
    },
    loading: "加载中…",
    consularOfficer: "领事官",
    avatarAnimation: "语音动画",
    connectedStatus: "实时数字人已连接",
    connectingStatus: "正在连接数字人",
    fallbackStatus: "语音动画模式",
    currentQuestion: "当前问题",
    starting: "面试即将开始…",
    stopRecording: "停止录音",
    startSpeaking: "开始说话",
    viewReport: "查看面试报告 →",
    responding: "官员正在回应…",
    recordingStatus: "录音中，请说话…点击麦克风停止",
    transcriptTitle: "面试记录",
    transcriptDescription: "文字和语音回答都会保留",
    answerCountSuffix: "答",
    transcriptEmpty: "面试开始后，问题和你的回答会显示在这里。",
    officerLabel: "面试官",
    applicantLabel: "你",
    listeningPlaceholder: "正在听你说话…",
    answerPlaceholder: "输入回答，Enter 发送，Shift+Enter 换行",
    stopAndSend: "停止录音并发送",
    voiceAnswer: "语音回答",
    sendAnswer: "发送回答",
    engineRunning: "AI 引擎运行中",
    footerLabel: "B1/B2 签证模拟",
    unsupportedSpeechRecognition: "您的浏览器不支持语音识别，请使用 Chrome 或 Edge。",
  },
  report: {
    footerLabel: "B1/B2 签证模拟",
    title: "B1/B2 签证模拟面试",
    overallScore: "综合评分",
    passProbability: "通过概率：",
    completed: "共完成",
    modules: "个模块",
    retry: "↺ 重新模拟",
    dimensionsTitle: "能力维度",
    dimensions: { clarity: "清晰度", confidence: "置信度", consistency: "一致性", narrativeAlignment: "叙述对齐" },
    insightsTitle: "AI 洞察",
    strengthsTitle: "✓ 关键优势",
    improvementsTitle: "! 需要改进",
    analysisTitle: "逐题分析",
    analysisPrefix: "分析：",
    systemNormal: "系统正常",
    reportGenerated: "报告已生成",
    passLikelihood: { high: "高", medium: "中", low: "低" },
    flagLabels: { strong: "优势", weak: "需改进", neutral: "中性" },
    fallback: {
      strengths: ["回答基本流畅，能够正常沟通", "部分问题回答较为直接清晰"],
      improvements: ["建议提前准备具体的行程安排细节", "资金来源说明需更加明确具体"],
      note: "回答基本符合要求",
      topic: "综合评估",
      unanswered: "（未回答）",
    },
  },
  loadingReport: { title: "正在生成面试报告…", description: "AI 正在分析您的回答，请稍候" },
  plan: {
    fallbackCountry: "美国",
    fallbackDuration: "这段时间",
    fallbackFunding: "这次费用",
    fallbackOccupation: "目前的工作或身份",
    fallbackTies: "国内安排",
    opening: { topic: "赴美目的", question: "你去美国做什么？", required: ["detail"], followUp: "具体做什么？" },
    family: [
      { topic: "邀请关系", question: "你去看谁？", required: ["detail"], followUp: "你们是什么关系？" },
      { topic: "邀请人情况", question: "他在美国做什么？", required: ["detail"], followUp: "他现在是什么身份？" },
    ],
    business: [
      { topic: "商务事项", question: "你去参加什么商务活动？", required: ["detail"], followUp: "活动或对方公司的名称是什么？" },
      { topic: "职位关联", question: "为什么必须由你去？", required: ["work", "detail"], followUp: "这和你的职责有什么关系？" },
    ],
    travel: [
      { topic: "旅行安排", question: "你准备去{cities}哪些地方？", required: ["city", "detail"], followUp: "最主要去哪个城市？" },
      { topic: "同行人员", question: "谁和你一起去？", required: ["detail"], followUp: "你是一个人去吗？" },
    ],
    stay: { topic: "停留时间", question: "你准备在美国待{duration}？", required: ["time"], followUp: "具体待多少天？" },
    funding: { topic: "费用来源", question: "{funding}，谁承担费用？", required: ["money"], followUp: "这次大约准备多少预算？" },
    work: { topic: "工作情况", question: "{occupation}，你具体做什么工作？", required: ["work", "detail"], followUp: "你在那里工作多久了？" },
    returnPlan: { topic: "回国安排", question: "旅行结束后你回来做什么？", required: ["ties", "detail"], followUp: "你提到{ties}，具体是什么安排？" },
    travelHistory: { topic: "出境记录", question: "你以前出过国吗？", required: ["detail"], followUp: "最近一次去了哪里？" },
    endingTopic: "结束",
    endingMessage: "好的，今天的面试到这里就结束了，感谢您的配合。",
    fallbackQuestions: ["这次去美国主要是什么打算？", "具体去做什么？", "为什么选这个时间去？", "计划去哪些城市？", "打算在美国待多长时间？", "回程机票订了吗？", "住宿安排好了吗？", "这次费用自己出还是有人资助？", "大概预算多少？", "目前在国内做什么工作？", "在哪家公司或机构？", "家里还有什么牵挂，回国后有什么安排？"],
  },
};

export const INTERVIEW_COPY: Record<InterfaceLocale, InterviewCopy> = { en: enCopy, zh: zhCopy };

export function getInterviewCopy(locale: InterfaceLocale): InterviewCopy {
  return INTERVIEW_COPY[locale];
}

type ApplicantProfile = {
  purpose: string;
  cities: string;
  travelDates: string;
  duration: string;
  funding: string;
  occupation: string;
  familyTies: string;
};

function compact(value: string, fallback: string) {
  return value.trim() || fallback;
}

function interpolate(value: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce((result, [key, replacement]) => result.replace(`{${key}}`, replacement), value);
}

export function buildInterviewPlan(profile: ApplicantProfile, locale: InterfaceLocale): InterviewStepCopy[] {
  const copy = getInterviewCopy(locale).plan;
  const cities = compact(profile.cities, copy.fallbackCountry);
  const duration = compact(profile.duration, copy.fallbackDuration);
  const funding = compact(profile.funding, copy.fallbackFunding);
  const occupation = compact(profile.occupation, copy.fallbackOccupation);
  const ties = compact(profile.familyTies, copy.fallbackTies);
  const purpose = profile.purpose.toLowerCase();
  const isFamilyVisit = locale === "zh"
    ? /探亲|访友|看望|亲戚|家人/.test(purpose)
    : /visit|family|relative|parent|friend|see someone/.test(purpose);
  const isBusinessTrip = locale === "zh"
    ? /商务|会议|展会|客户|公司|培训/.test(purpose)
    : /business|meeting|conference|trade show|client|company|training/.test(purpose);
  const purposeQuestions = isFamilyVisit
    ? copy.family
    : isBusinessTrip
    ? copy.business
    : copy.travel.map((step) => ({
        ...step,
        question: interpolate(step.question, { cities }),
      }));

  return [
    copy.opening,
    ...purposeQuestions,
    { ...copy.stay, question: interpolate(copy.stay.question, { duration }) },
    { ...copy.funding, question: interpolate(copy.funding.question, { funding }) },
    { ...copy.work, question: interpolate(copy.work.question, { occupation }) },
    { ...copy.returnPlan, followUp: interpolate(copy.returnPlan.followUp, { ties }) },
    copy.travelHistory,
  ];
}
