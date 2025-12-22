import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Landing
    'hero.title': 'Your AI Sales Agent for WhatsApp & Social DMs',
    'hero.subtitle': 'Tamm chats with customers, confirms orders, and logs everything automatically.',
    'hero.cta': 'Start Free',
    'hero.secondary': 'See How It Works',
    'nav.features': 'Features',
    'nav.pricing': 'Pricing',
    'nav.docs': 'Docs',
    'nav.login': 'Log In',
    'nav.start': 'Start Free',
    // Features
    'features.title': 'Everything you need to sell on social',
    'features.ai.title': 'Arabic & English AI Replies',
    'features.ai.desc': 'Natural conversations in both languages, powered by advanced AI.',
    'features.orders.title': 'Order Capture & Confirmation',
    'features.orders.desc': 'Automatically detect and confirm orders from customer messages.',
    'features.sheets.title': 'Google Sheets Logging',
    'features.sheets.desc': 'Every order and conversation logged to your spreadsheet.',
    'features.notify.title': 'Owner Notifications',
    'features.notify.desc': 'Get instant alerts for new orders and important messages.',
    // Channels
    'channels.title': 'Connect All Your Channels',
    'channels.whatsapp': 'WhatsApp',
    'channels.instagram': 'Instagram',
    'channels.facebook': 'Facebook',
    'channels.tiktok': 'TikTok',
    'channels.webchat': 'Web Chat',
    // How it works
    'how.title': 'How Tamm Works',
    'how.step1.title': 'Connect Your Channels',
    'how.step1.desc': 'Link your WhatsApp, Instagram, and other social accounts.',
    'how.step2.title': 'Train Your Agent',
    'how.step2.desc': 'Upload your catalog and customize responses.',
    'how.step3.title': 'Start Selling',
    'how.step3.desc': 'Tamm handles conversations while you focus on your business.',
    // Pricing
    'pricing.title': 'Simple, Transparent Pricing',
    'pricing.free': 'Free',
    'pricing.pro': 'Pro',
    'pricing.business': 'Business',
    'pricing.month': '/month',
    'pricing.popular': 'Most Popular',
    // Use cases
    'usecases.title': 'Built for Local Businesses',
    'usecases.clothing': 'Clothing & Fashion',
    'usecases.food': 'Food & Restaurants',
    'usecases.services': 'Services & Booking',
    // Footer
    'footer.docs': 'Docs',
    'footer.privacy': 'Privacy',
    'footer.terms': 'Terms',
    'footer.copyright': '© 2024 Tamm. All rights reserved.',
    // Dashboard
    'dashboard.overview': 'Overview',
    'dashboard.channels': 'Channels',
    'dashboard.agent': 'AI Agent',
    'dashboard.inbox': 'Activity',
    'dashboard.orders': 'Orders',
    'dashboard.tickets': 'Tickets',
    'dashboard.automations': 'Automations',
    'dashboard.evals': 'Evals',
    'dashboard.insights': 'Insights',
    'dashboard.analytics': 'Analytics',
    'dashboard.settings': 'Settings',
    // Stats
    'stats.conversations': 'Conversations Today',
    'stats.orders': 'Orders Captured',
    'stats.revenue': 'Est. Revenue',
    'stats.active': 'Tamm is Active',
    // Auth
    'auth.login': 'Log In',
    'auth.signup': 'Sign Up',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.magiclink': 'Send Magic Link',
    'auth.google': 'Continue with Google',
    'auth.or': 'or',
    'auth.noAccount': "Don't have an account?",
    'auth.hasAccount': 'Already have an account?',
  },
  ar: {
    // Landing
    'hero.title': 'وكيل المبيعات الذكي لواتساب والرسائل',
    'hero.subtitle': 'تمم يتحدث مع العملاء، يؤكد الطلبات، ويسجل كل شيء تلقائياً.',
    'hero.cta': 'ابدأ مجاناً',
    'hero.secondary': 'شاهد كيف يعمل',
    'nav.features': 'المميزات',
    'nav.pricing': 'الأسعار',
    'nav.docs': 'الدليل',
    'nav.login': 'تسجيل الدخول',
    'nav.start': 'ابدأ مجاناً',
    // Features
    'features.title': 'كل ما تحتاجه للبيع على السوشيال',
    'features.ai.title': 'ردود ذكية بالعربي والإنجليزي',
    'features.ai.desc': 'محادثات طبيعية باللغتين، مدعومة بالذكاء الاصطناعي.',
    'features.orders.title': 'التقاط وتأكيد الطلبات',
    'features.orders.desc': 'اكتشاف وتأكيد الطلبات تلقائياً من رسائل العملاء.',
    'features.sheets.title': 'تسجيل في Google Sheets',
    'features.sheets.desc': 'كل طلب ومحادثة يُسجل في جدول البيانات.',
    'features.notify.title': 'إشعارات للمالك',
    'features.notify.desc': 'تنبيهات فورية للطلبات الجديدة والرسائل المهمة.',
    // Channels
    'channels.title': 'اربط جميع قنواتك',
    'channels.whatsapp': 'واتساب',
    'channels.instagram': 'انستغرام',
    'channels.facebook': 'فيسبوك',
    'channels.tiktok': 'تيك توك',
    'channels.webchat': 'الدردشة المباشرة',
    // How it works
    'how.title': 'كيف يعمل تمم',
    'how.step1.title': 'اربط قنواتك',
    'how.step1.desc': 'اربط واتساب وانستغرام وحساباتك الأخرى.',
    'how.step2.title': 'درّب الوكيل',
    'how.step2.desc': 'ارفع كتالوجك وخصص الردود.',
    'how.step3.title': 'ابدأ البيع',
    'how.step3.desc': 'تمم يتولى المحادثات وأنت تركز على عملك.',
    // Pricing
    'pricing.title': 'أسعار بسيطة وشفافة',
    'pricing.free': 'مجاني',
    'pricing.pro': 'احترافي',
    'pricing.business': 'أعمال',
    'pricing.month': '/شهر',
    'pricing.popular': 'الأكثر شعبية',
    // Use cases
    'usecases.title': 'مصمم للأعمال المحلية',
    'usecases.clothing': 'الملابس والأزياء',
    'usecases.food': 'الطعام والمطاعم',
    'usecases.services': 'الخدمات والحجوزات',
    // Footer
    'footer.docs': 'الدليل',
    'footer.privacy': 'الخصوصية',
    'footer.terms': 'الشروط',
    'footer.copyright': '© 2024 تمم. جميع الحقوق محفوظة.',
    // Dashboard
    'dashboard.overview': 'نظرة عامة',
    'dashboard.channels': 'القنوات',
    'dashboard.agent': 'الوكيل الذكي',
    'dashboard.inbox': 'النشاط',
    'dashboard.orders': 'الطلبات',
    'dashboard.tickets': 'التذاكر',
    'dashboard.automations': 'الأتمتة',
    'dashboard.evals': 'التقييم',
    'dashboard.insights': 'الرؤى',
    'dashboard.analytics': 'التحليلات',
    'dashboard.settings': 'الإعدادات',
    // Stats
    'stats.conversations': 'محادثات اليوم',
    'stats.orders': 'طلبات ملتقطة',
    'stats.revenue': 'الإيرادات المقدرة',
    'stats.active': 'تمم نشط',
    // Auth
    'auth.login': 'تسجيل الدخول',
    'auth.signup': 'إنشاء حساب',
    'auth.email': 'البريد الإلكتروني',
    'auth.password': 'كلمة المرور',
    'auth.magiclink': 'إرسال رابط سحري',
    'auth.google': 'المتابعة مع Google',
    'auth.or': 'أو',
    'auth.noAccount': 'ليس لديك حساب؟',
    'auth.hasAccount': 'لديك حساب بالفعل؟',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('tamm-lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    const saved = localStorage.getItem('tamm-lang') as Language | null;
    if (saved && (saved === 'en' || saved === 'ar')) {
      setLanguage(saved);
    }
  }, []);

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  const dir = language === 'ar' ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
