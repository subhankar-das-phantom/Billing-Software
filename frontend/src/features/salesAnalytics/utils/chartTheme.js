import { useTheme } from '../../../contexts/ThemeContext';

/**
 * Hook to provide theme-adaptive stroke, fill, and tooltip colors for Recharts
 */
export function useChartTheme() {
  const { chartColors, isDark } = useTheme();
  return {
    gridStroke: chartColors.gridStroke,
    axisStroke: chartColors.axisStroke,
    cursorFill: chartColors.cursorFill,
    tooltipBg: chartColors.tooltipBg,
    tooltipBorder: chartColors.tooltipBorder,
    tooltipText: chartColors.tooltipText,
    isDark
  };
}

export default useChartTheme;
