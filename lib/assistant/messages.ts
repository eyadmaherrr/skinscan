import type { Locale } from '../i18n';

/**
 * The assistant's interface text — the same as drmahermahmoud.com's
 * (lib/i18n/assistant there), so both sites' assistants read alike.
 */

const en = {
  launcher: {
    open: 'Chat with our AI',
    close: 'Minimize the assistant',
    tooltip: 'Chat with our AI',
  },
  panel: 'Clinic AI assistant',
  language: {
    label: 'Assistant language',
    en: 'English',
    ar: 'العربية',
  },
  choice: {
    title: 'How can we help you?',
    subtitle: 'Choose an option to get started.',
    skinscan: {
      title: 'SkinScan AI',
      description: 'Explore your skin with our AI-powered skin-analysis tool.',
      checking: 'Checking availability…',
      unavailable: 'SkinScan AI is temporarily unavailable. Please try again later.',
    },
    chat: {
      title: 'Chat with AI',
      description:
        'Ask about our services, appointments, clinic locations, and frequently asked questions.',
    },
    close: 'Minimize',
  },
  chat: {
    title: 'Clinic AI Assistant',
    subtitle: 'How can we help you?',
    back: 'Back to options',
    minimize: 'Minimize',
    newConversation: 'New conversation',
    welcome:
      'Hello! 👋 Welcome to Dr Maher Mahmoud Clinics. I can help answer questions about our services, appointments, clinic locations, and SkinScan AI. What would you like to know?',
    suggestions: 'Suggested questions',
    inputLabel: 'Your question',
    placeholder: 'Type your question…',
    send: 'Send',
    thinking: 'Finding an answer…',
    empty: 'Please type a question first.',
    tooLong: 'Please keep your question under {max} characters.',
    fromFaq: 'From our FAQ',
    related: 'Related questions',
    clarify: 'I found a few possible answers. Which of these did you mean?',
    fallback:
      "I'm sorry, I couldn't find a verified answer to that in our FAQs. Please contact the clinic for assistance.",
    mightHelp: 'These questions might help:',
    medical:
      "I can't give medical advice, diagnoses or treatment recommendations. A dermatologist needs to examine your skin — you can book a consultation with Dr. Maher Mahmoud.",
    greeting: 'Hello! What would you like to know? Pick a question below or type your own.',
    thanks: "You're welcome! Is there anything else I can help with?",
    error: 'Sorry, something went wrong. Please try again.',
    network: "I couldn't connect. Please check your connection and try again.",
    rateLimited:
      "You've sent a lot of questions in a short time. Please wait a minute and try again.",
    retry: 'Try again',
    you: 'You',
    assistant: 'Assistant',
    disclaimer: "Answers come from the clinic's published FAQs. Not medical advice.",
  },
  links: {
    book: 'Book an appointment',
    onlineAppointment: 'Online Appointment',
    account: 'Go to my account',
    services: 'View our services',
    branches: 'See our branches',
    login: 'Sign in',
    chat: 'Open Patient Chat',
    privacy: 'Privacy Policy',
    support: 'Contact & support',
    faq: 'All FAQs',
    doctor: 'About Dr. Maher',
    skinscan: 'Open SkinScan AI',
    skinscanPrivacy: 'SkinScan privacy policy',
  },
};

export type AssistantText = typeof en;

const ar: AssistantText = {
  launcher: {
    open: 'تحدّث مع مساعدنا الذكي',
    close: 'تصغير المساعد',
    tooltip: 'تحدّث مع مساعدنا الذكي',
  },
  panel: 'المساعد الذكي للعيادة',
  language: {
    label: 'لغة المساعد',
    en: 'English',
    ar: 'العربية',
  },
  choice: {
    title: 'كيف يمكننا مساعدتك؟',
    subtitle: 'اختر خيارًا للبدء.',
    skinscan: {
      title: 'SkinScan AI',
      description: 'اكتشف بشرتك مع أداة تحليل البشرة المدعومة بالذكاء الاصطناعي.',
      checking: 'جارٍ التحقق من التوفر…',
      unavailable: 'SkinScan AI غير متاح مؤقتًا. يُرجى المحاولة لاحقًا.',
    },
    chat: {
      title: 'تحدّث مع الذكاء الاصطناعي',
      description: 'اسأل عن خدماتنا والمواعيد وأماكن الفروع والأسئلة الشائعة.',
    },
    close: 'تصغير',
  },
  chat: {
    title: 'المساعد الذكي للعيادة',
    subtitle: 'كيف يمكننا مساعدتك؟',
    back: 'العودة إلى الخيارات',
    minimize: 'تصغير',
    newConversation: 'محادثة جديدة',
    welcome:
      'مرحبًا! 👋 أهلًا بك في عيادات د. ماهر محمود. يمكنني الإجابة عن أسئلتك حول خدماتنا والمواعيد وأماكن الفروع وSkinScan AI. بماذا يمكنني مساعدتك؟',
    suggestions: 'أسئلة مقترحة',
    inputLabel: 'سؤالك',
    placeholder: 'اكتب سؤالك…',
    send: 'إرسال',
    thinking: 'جارٍ البحث عن إجابة…',
    empty: 'يُرجى كتابة سؤال أولًا.',
    tooLong: 'يُرجى ألا يزيد سؤالك عن {max} حرف.',
    fromFaq: 'من الأسئلة الشائعة',
    related: 'أسئلة ذات صلة',
    clarify: 'وجدت أكثر من إجابة محتملة. أي من هذه الأسئلة تقصد؟',
    fallback:
      'عذرًا، لم أجد إجابة مؤكدة لهذا السؤال في الأسئلة الشائعة. يُرجى التواصل مع العيادة للمساعدة.',
    mightHelp: 'قد تفيدك هذه الأسئلة:',
    medical:
      'لا يمكنني تقديم نصائح طبية أو تشخيص أو توصيات علاجية. يحتاج طبيب الجلدية إلى فحص بشرتك — يمكنك حجز استشارة مع د. ماهر محمود.',
    greeting: 'مرحبًا! بماذا يمكنني مساعدتك؟ اختر سؤالًا من الأسئلة التالية أو اكتب سؤالك.',
    thanks: 'العفو! هل هناك شيء آخر يمكنني مساعدتك فيه؟',
    error: 'عذرًا، حدث خطأ ما. يُرجى المحاولة مرة أخرى.',
    network: 'تعذّر الاتصال. يُرجى التحقق من اتصالك والمحاولة مرة أخرى.',
    rateLimited: 'أرسلت أسئلة كثيرة في وقت قصير. يُرجى الانتظار دقيقة ثم المحاولة مرة أخرى.',
    retry: 'حاول مرة أخرى',
    you: 'أنت',
    assistant: 'المساعد',
    disclaimer: 'الإجابات من الأسئلة الشائعة المنشورة للعيادة، وليست نصيحة طبية.',
  },
  links: {
    book: 'احجز موعدًا',
    onlineAppointment: 'الموعد الأونلاين',
    account: 'اذهب إلى حسابي',
    services: 'اطّلع على خدماتنا',
    branches: 'اطّلع على فروعنا',
    login: 'تسجيل الدخول',
    chat: 'افتح محادثة المرضى',
    privacy: 'سياسة الخصوصية',
    support: 'التواصل والدعم',
    faq: 'كل الأسئلة الشائعة',
    doctor: 'عن د. ماهر',
    skinscan: 'افتح SkinScan AI',
    skinscanPrivacy: 'سياسة خصوصية SkinScan',
  },
};

export function assistantText(locale: Locale): AssistantText {
  return locale === 'ar' ? ar : en;
}
