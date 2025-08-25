"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('home.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('home.subtitle')}
          </p>
        </div>

        <div className="mb-6">
          <LanguageSelector />
        </div>
        
        <div className="space-y-4">
          <Link
            href="/admin/login"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
          >
            {t('home.adminPortal')}
          </Link>
          
          <Link
            href="/client/login"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
          >
            {t('home.clientPortal')}
          </Link>
        </div>
      </div>
    </div>
  );
}
