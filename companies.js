'use strict';

(function registerCompanies(root) {
  // SGBV equity symbols. The sharia note is a preliminary activity-level guide only;
  // no listed company is represented as certified or fully screened.
  const companies = [
    { symbol: 'AYRD', name: 'AYRADE', arabicName: 'أيراد', sector: 'تكنولوجيا', logoUrl: 'https://www.ayrade.com/wp-content/uploads/2026/04/logo-ayrade-lion.png', screening: 'مرشحة مبدئياً حسب النشاط؛ يلزم فحص البيانات المالية' },
    { symbol: 'BIO', name: 'BIOPHARM', arabicName: 'بيوفارم', sector: 'صيدلة', logoUrl: 'https://www.biopharmdz.com/storage/settings/March2023/CxzOOd7tR6DGzvHqFZty.png', screening: 'مرشحة مبدئياً حسب النشاط؛ يلزم فحص البيانات المالية' },
    { symbol: 'SAI', name: 'SAIDAL', arabicName: 'صيدال', sector: 'صيدلة', logoUrl: 'https://www.saidalgroup.dz/wp-content/uploads/2022/04/LogoSaidal_Pantone_FondTransparant-4.png', screening: 'مرشحة مبدئياً حسب النشاط؛ يلزم فحص البيانات المالية' },
    { symbol: 'CREX', name: 'CRAPC EXPERTISE', arabicName: 'كرابك إكسبيرتيز', sector: 'خبرة وخدمات', screening: 'مرشحة مبدئياً حسب النشاط؛ يلزم فحص البيانات المالية' },
    { symbol: 'MST', name: 'Moustachir', arabicName: 'مستشير', sector: 'استشارات', logoUrl: 'https://moustachir.dz/logo.svg', screening: 'مرشحة مبدئياً حسب النشاط؛ يلزم فحص البيانات المالية' },
    { symbol: 'AOM', name: 'AOM Invest', arabicName: 'أوم إنفست', sector: 'استثمار', screening: 'يلزم التحقق من طبيعة الاستثمارات والبيانات المالية' },
    { symbol: 'AUR', name: 'EGH El Aurassi', arabicName: 'فندق الأوراسي', sector: 'فندقة', screening: 'يلزم مراجعة الأنشطة ومصادر الإيراد والبيانات المالية' },
    { symbol: 'ALL', name: 'ALLIANCE ASSURANCES', arabicName: 'أليانس للتأمين', sector: 'تأمين', screening: 'نشاط تأمين تقليدي؛ غير مدرجة ضمن المرشحات الأولية' },
    { symbol: 'BDL', name: 'BANQUE DE DEVELOPPEMENT LOCAL', arabicName: 'بنك التنمية المحلية', sector: 'بنوك', screening: 'نشاط مصرفي تقليدي؛ غير مدرج ضمن المرشحات الأولية' },
    { symbol: 'CPA', name: "CREDIT POPULAIRE D'ALGERIE", arabicName: 'القرض الشعبي الجزائري', sector: 'بنوك', screening: 'نشاط مصرفي تقليدي؛ غير مدرج ضمن المرشحات الأولية' }
  ];
  const api = Object.freeze({
    all: () => companies.map(company => ({ ...company })),
    get: symbol => {
      const company = companies.find(item => item.symbol === String(symbol).toUpperCase());
      return company ? { ...company } : null;
    },
    candidates: () => companies.filter(company => ['AYRD', 'BIO', 'SAI', 'CREX', 'MST'].includes(company.symbol)).map(company => ({ ...company }))
  });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NabdCompanies = api;
})(globalThis);
