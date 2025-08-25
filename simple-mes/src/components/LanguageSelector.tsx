"use client";

import { useLanguage, Language } from '@/contexts/LanguageContext';

interface LanguageSelectorProps {
  className?: string;
}

export default function LanguageSelector({ className = "" }: LanguageSelectorProps) {
  const { language, setLanguage, t } = useLanguage();

  const languages: { code: Language; name: string; flag: string }[] = [
    { code: 'zh', name: t('login.language.zh'), flag: '🇨🇳' },
    { code: 'en', name: t('login.language.en'), flag: '🇺🇸' },
  ];

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {t('login.selectLanguage')}
      </label>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white appearance-none"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
}