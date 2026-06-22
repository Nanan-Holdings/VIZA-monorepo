'use client';

import {useTranslations} from 'next-intl';

export default function Pricing() {
  const t = useTranslations('pricing');
  const plans = ['starter', 'pro', 'enterprise'] as const;

  return (
    <section id="pricing" className="py-24 px-4 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            {t('title')}
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <div key={plan} className="p-8 rounded-2xl bg-white">
              <h3 className="text-xl font-semibold mb-2 text-gray-900">
                {t(`plans.${plan}.name`)}
              </h3>
              <div className="text-4xl font-bold mb-2 text-gray-900">
                {t(`plans.${plan}.price`)}
              </div>
              <p className="mb-8 text-gray-500">
                {t(`plans.${plan}.desc`)}
              </p>
              <a href="#" className="block text-center py-3 px-6 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700">
                {t(`plans.${plan}.cta`)}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}