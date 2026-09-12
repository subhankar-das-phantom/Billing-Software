export const CUSTOMER_THEMES = [
  {
    id: 'blue',
    label: 'Blue',
    badge: 'bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/25 dark:border-blue-500/30 text-blue-600 dark:text-blue-400',
    swatch: 'bg-blue-500',
    gradient: 'from-blue-600 to-indigo-700',
    hoverGradient: 'from-blue-500 to-indigo-600',
    shadow: 'shadow-sm'
  },
  {
    id: 'emerald',
    label: 'Emerald',
    badge: 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/25 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
    swatch: 'bg-emerald-500',
    gradient: 'from-emerald-600 to-teal-700',
    hoverGradient: 'from-emerald-500 to-teal-600',
    shadow: 'shadow-sm'
  },
  {
    id: 'teal',
    label: 'Teal',
    badge: 'bg-teal-500/10 dark:bg-teal-500/15 border-teal-500/25 dark:border-teal-500/30 text-teal-600 dark:text-teal-400',
    swatch: 'bg-teal-500',
    gradient: 'from-teal-600 to-cyan-700',
    hoverGradient: 'from-teal-500 to-cyan-600',
    shadow: 'shadow-sm'
  },
  {
    id: 'amber',
    label: 'Amber',
    badge: 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/25 dark:border-amber-500/30 text-amber-600 dark:text-amber-400',
    swatch: 'bg-amber-500',
    gradient: 'from-amber-600 to-amber-700',
    hoverGradient: 'from-amber-500 to-amber-600',
    shadow: 'shadow-sm'
  },
  {
    id: 'rose',
    label: 'Rose',
    badge: 'bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/25 dark:border-rose-500/30 text-rose-600 dark:text-rose-400',
    swatch: 'bg-rose-500',
    gradient: 'from-rose-600 to-rose-700',
    hoverGradient: 'from-rose-500 to-rose-600',
    shadow: 'shadow-sm'
  },
  {
    id: 'cyan',
    label: 'Cyan',
    badge: 'bg-sky-500/10 dark:bg-sky-500/15 border-sky-500/25 dark:border-sky-500/30 text-sky-600 dark:text-sky-400',
    swatch: 'bg-sky-500',
    gradient: 'from-sky-600 to-blue-700',
    hoverGradient: 'from-sky-500 to-blue-600',
    shadow: 'shadow-sm'
  }
];

const themeIndex = CUSTOMER_THEMES.reduce((acc, theme) => {
  acc[theme.id] = theme;
  return acc;
}, {});

export const getCustomerTheme = (themeId) => themeIndex[themeId] || themeIndex.blue;
