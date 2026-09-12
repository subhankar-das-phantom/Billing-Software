export const CUSTOMER_THEMES = [
  {
    id: 'blue',
    label: 'Blue',
    gradient: 'from-blue-600 to-indigo-700',
    hoverGradient: 'from-blue-500 to-indigo-600',
    shadow: 'shadow-sm'
  },
  {
    id: 'emerald',
    label: 'Emerald',
    gradient: 'from-emerald-600 to-teal-700',
    hoverGradient: 'from-emerald-500 to-teal-600',
    shadow: 'shadow-sm'
  },
  {
    id: 'teal',
    label: 'Teal',
    gradient: 'from-teal-600 to-cyan-700',
    hoverGradient: 'from-teal-500 to-cyan-600',
    shadow: 'shadow-sm'
  },
  {
    id: 'amber',
    label: 'Amber',
    gradient: 'from-amber-600 to-amber-700',
    hoverGradient: 'from-amber-500 to-amber-600',
    shadow: 'shadow-sm'
  },
  {
    id: 'rose',
    label: 'Rose',
    gradient: 'from-rose-600 to-rose-700',
    hoverGradient: 'from-rose-500 to-rose-600',
    shadow: 'shadow-sm'
  },
  {
    id: 'cyan',
    label: 'Cyan',
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
