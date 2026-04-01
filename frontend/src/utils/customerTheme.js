export const CUSTOMER_THEMES = [
  {
    id: 'blue',
    label: 'Blue',
    gradient: 'from-blue-500 to-indigo-600',
    hoverGradient: 'from-indigo-600 to-blue-500',
    shadow: 'shadow-blue-500/30'
  },
  {
    id: 'emerald',
    label: 'Emerald',
    gradient: 'from-emerald-500 to-teal-600',
    hoverGradient: 'from-teal-600 to-emerald-500',
    shadow: 'shadow-emerald-500/30'
  },
  {
    id: 'purple',
    label: 'Purple',
    gradient: 'from-purple-500 to-fuchsia-600',
    hoverGradient: 'from-fuchsia-600 to-purple-500',
    shadow: 'shadow-purple-500/30'
  },
  {
    id: 'amber',
    label: 'Amber',
    gradient: 'from-amber-500 to-orange-600',
    hoverGradient: 'from-orange-600 to-amber-500',
    shadow: 'shadow-amber-500/30'
  },
  {
    id: 'rose',
    label: 'Rose',
    gradient: 'from-rose-500 to-pink-600',
    hoverGradient: 'from-pink-600 to-rose-500',
    shadow: 'shadow-rose-500/30'
  },
  {
    id: 'cyan',
    label: 'Cyan',
    gradient: 'from-cyan-500 to-sky-600',
    hoverGradient: 'from-sky-600 to-cyan-500',
    shadow: 'shadow-cyan-500/30'
  }
];

const themeIndex = CUSTOMER_THEMES.reduce((acc, theme) => {
  acc[theme.id] = theme;
  return acc;
}, {});

export const getCustomerTheme = (themeId) => themeIndex[themeId] || themeIndex.blue;
