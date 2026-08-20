'use client';

import {useTranslations, useLocale} from 'next-intl';
import {useRouter, usePathname} from 'next/navigation';

export default function Navbar() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggleLanguage = () => {
    const newLocale = locale === 'en' ? 'zh' : 'en';
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <span className="text-2xl font-bold text-blue-600">VIZA</span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors">{t('features')}</a>
            <a href="#pricing" className="text-gray-600 hover:text-blue-600 transition-colors">{t('pricing')}</a>
            <a href="#about" className="text-gray-600 hover:text-blue-600 transition-colors">{t('about')}</a>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleLanguage}
              className="px-3 py-1 rounded-full border border-gray-300 text-sm text-gray-600 hover:border-blue-600 hover:text-blue-600 transition-colors"
            >
              {locale === 'en' ? '中文' : 'EN'}
            </button>
            <a href="#" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              {t('getStarted')}
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}