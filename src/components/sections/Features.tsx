import {useTranslations} from 'next-intl';

export default function Features() {
  const t = useTranslations('features');

  const icons = ['⚡', '🔒', '🔔', '🌍'];
  const keys = ['fast', 'secure', 'smart', 'global'] as const;

  return (
    <section id="features" className="py-24 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            {t('title')}
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {keys.map((key, i) => (
            <div key={key} className="p-8 rounded-2xl bg-gray-50 hover:bg-blue-50 transition-colors group">
              <div className="text-4xl mb-4">{icons[i]}</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {t(`items.${key}.title`)}
              </h3>
              <p className="text-gray-600">
                {t(`items.${key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}