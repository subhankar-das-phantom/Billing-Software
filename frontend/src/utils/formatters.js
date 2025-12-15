/**
 * Formatters Utility
 * Comprehensive formatting functions for various data types
 */

// ============================================
// CURRENCY FORMATTING
// ============================================

/**
 * Format currency in Indian Rupees
 * @param {number} amount - Amount to format
 * @param {object} options - Formatting options
 * @returns {string} - Formatted currency
 */
export const formatCurrency = (amount, options = {}) => {
  if (amount === null || amount === undefined) return '₹0.00';
  
  const {
    showSymbol = true,
    decimals = 2,
    compact = false
  } = options;
  
  if (compact && Math.abs(amount) >= 100000) {
    return formatCompactCurrency(amount);
  }
  
  const formatted = new Intl.NumberFormat('en-IN', {
    style: showSymbol ? 'currency' : 'decimal',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(amount);
  
  return showSymbol ? formatted : `₹${formatted}`;
};

/**
 * Format currency in compact form (K, L, Cr)
 * @param {number} amount - Amount to format
 * @returns {string} - Compact formatted currency
 */
export const formatCompactCurrency = (amount) => {
  if (amount === null || amount === undefined) return '₹0';
  
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  
  if (absAmount >= 10000000) {
    return `${sign}₹${(absAmount / 10000000).toFixed(2)}Cr`;
  } else if (absAmount >= 100000) {
    return `${sign}₹${(absAmount / 100000).toFixed(2)}L`;
  } else if (absAmount >= 1000) {
    return `${sign}₹${(absAmount / 1000).toFixed(2)}K`;
  }
  
  return formatCurrency(amount);
};

/**
 * Format currency without symbol
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted amount
 */
export const formatAmount = (amount) => {
  if (amount === null || amount === undefined) return '0.00';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Parse currency string to number
 * @param {string} currencyString - Currency string
 * @returns {number} - Parsed number
 */
export const parseCurrency = (currencyString) => {
  if (!currencyString) return 0;
  const cleaned = String(currencyString).replace(/[₹,\s]/g, '');
  return parseFloat(cleaned) || 0;
};

// ============================================
// NUMBER FORMATTING
// ============================================

/**
 * Format number with Indian numbering system
 * @param {number} num - Number to format
 * @param {number} decimals - Decimal places (default: 0)
 * @returns {string} - Formatted number
 */
export const formatNumber = (num, decimals = 0) => {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
};

/**
 * Format number in compact form
 * @param {number} num - Number to format
 * @returns {string} - Compact formatted number
 */
export const formatCompactNumber = (num) => {
  if (num === null || num === undefined) return '0';
  
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1e9) return `${sign}${(absNum / 1e9).toFixed(1)}B`;
  if (absNum >= 1e7) return `${sign}${(absNum / 1e7).toFixed(1)}Cr`;
  if (absNum >= 1e5) return `${sign}${(absNum / 1e5).toFixed(1)}L`;
  if (absNum >= 1e3) return `${sign}${(absNum / 1e3).toFixed(1)}K`;
  
  return formatNumber(num);
};

/**
 * Format percentage
 * @param {number} value - Value to format (0-100)
 * @param {number} decimals - Decimal places (default: 2)
 * @returns {string} - Formatted percentage
 */
export const formatPercentage = (value, decimals = 2) => {
  if (value === null || value === undefined) return '0%';
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format decimal as percentage
 * @param {number} decimal - Decimal value (0-1)
 * @param {number} decimals - Decimal places (default: 2)
 * @returns {string} - Formatted percentage
 */
export const formatDecimalAsPercentage = (decimal, decimals = 2) => {
  if (decimal === null || decimal === undefined) return '0%';
  return `${(decimal * 100).toFixed(decimals)}%`;
};

/**
 * Format with ordinal suffix (1st, 2nd, 3rd, etc.)
 * @param {number} num - Number
 * @returns {string} - Number with ordinal suffix
 */
export const formatOrdinal = (num) => {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return num + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
};

/**
 * Add plus/minus sign to number
 * @param {number} num - Number
 * @returns {string} - Number with sign
 */
export const formatWithSign = (num) => {
  if (num === null || num === undefined || num === 0) return '0';
  return num > 0 ? `+${formatNumber(num, 2)}` : formatNumber(num, 2);
};

// ============================================
// DATE & TIME FORMATTING
// ============================================

/**
 * Format date
 * @param {Date|string} date - Date to format
 * @param {string} format - Format style (short, medium, long, full)
 * @returns {string} - Formatted date
 */
export const formatDate = (date, format = 'medium') => {
  if (!date) return '-';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  
  const formats = {
    short: { day: '2-digit', month: '2-digit', year: '2-digit' },
    medium: { day: '2-digit', month: 'short', year: 'numeric' },
    long: { day: '2-digit', month: 'long', year: 'numeric' },
    full: { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }
  };
  
  return d.toLocaleDateString('en-IN', formats[format] || formats.medium);
};

/**
 * Format date with time
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date and time
 */
export const formatDateTime = (date) => {
  if (!date) return '-';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Format time only
 * @param {Date|string} date - Date to format
 * @param {boolean} seconds - Include seconds
 * @returns {string} - Formatted time
 */
export const formatTime = (date, seconds = false) => {
  if (!date) return '-';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  
  const options = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  
  if (seconds) {
    options.second = '2-digit';
  }
  
  return d.toLocaleTimeString('en-IN', options);
};

/**
 * Format date for input field (YYYY-MM-DD)
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date for input
 */
export const formatDateForInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

/**
 * Format date for datetime-local input
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted datetime for input
 */
export const formatDateTimeForInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Format relative time (ago/from now)
 * @param {Date|string} date - Date to format
 * @returns {string} - Relative time
 */
export const formatRelativeTime = (date) => {
  if (!date) return '-';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  
  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);
  
  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  if (diffWeek < 4) return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`;
  if (diffMonth < 12) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
  return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
};

/**
 * Format duration in human-readable form
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} - Formatted duration
 */
export const formatDuration = (milliseconds) => {
  if (!milliseconds || milliseconds < 0) return '0s';
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

/**
 * Get day of week name
 * @param {Date|string} date - Date
 * @returns {string} - Day name
 */
export const getDayName = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', { weekday: 'long' });
};

/**
 * Get month name
 * @param {Date|string} date - Date
 * @returns {string} - Month name
 */
export const getMonthName = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', { month: 'long' });
};

// ============================================
// DATE VALIDATION & CHECKS
// ============================================

/**
 * Check if date is expired
 * @param {Date|string} date - Date to check
 * @returns {boolean} - Is expired
 */
export const isExpired = (date) => {
  if (!date) return false;
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  return d < new Date();
};

/**
 * Check if date is expiring soon
 * @param {Date|string} date - Date to check
 * @param {number} days - Days threshold (default: 30)
 * @returns {boolean} - Is expiring soon
 */
export const isExpiringSoon = (date, days = 30) => {
  if (!date) return false;
  const expiryDate = new Date(date);
  if (isNaN(expiryDate.getTime())) return false;
  
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + days);
  return expiryDate <= warningDate && expiryDate > new Date();
};

/**
 * Check if date is today
 * @param {Date|string} date - Date to check
 * @returns {boolean} - Is today
 */
export const isToday = (date) => {
  if (!date) return false;
  const d = new Date(date);
  const today = new Date();
  return d.toDateString() === today.toDateString();
};

/**
 * Check if date is yesterday
 * @param {Date|string} date - Date to check
 * @returns {boolean} - Is yesterday
 */
export const isYesterday = (date) => {
  if (!date) return false;
  const d = new Date(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return d.toDateString() === yesterday.toDateString();
};

/**
 * Check if date is in current week
 * @param {Date|string} date - Date to check
 * @returns {boolean} - Is in current week
 */
export const isThisWeek = (date) => {
  if (!date) return false;
  const d = new Date(date);
  const today = new Date();
  const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
  const lastDay = new Date(today.setDate(today.getDate() - today.getDay() + 6));
  return d >= firstDay && d <= lastDay;
};

/**
 * Calculate days between dates
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date (default: now)
 * @returns {number} - Days difference
 */
export const daysBetween = (date1, date2 = new Date()) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// ============================================
// PHONE NUMBER FORMATTING
// ============================================

/**
 * Format phone number (Indian)
 * @param {string} phone - Phone number
 * @param {object} options - Formatting options
 * @returns {string} - Formatted phone
 */
export const formatPhone = (phone, options = {}) => {
  if (!phone) return '-';
  
  const { countryCode = true, spacing = true } = options;
  
  // Remove non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Handle different lengths
  if (cleaned.length === 10) {
    if (spacing) {
      return countryCode 
        ? `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`
        : `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    }
    return countryCode ? `+91${cleaned}` : cleaned;
  }
  
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    const number = cleaned.slice(2);
    if (spacing) {
      return `+91 ${number.slice(0, 5)} ${number.slice(5)}`;
    }
    return `+91${number}`;
  }
  
  return phone;
};

/**
 * Mask phone number (show last 4 digits)
 * @param {string} phone - Phone number
 * @returns {string} - Masked phone
 */
export const maskPhone = (phone) => {
  if (!phone) return '-';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 4) return phone;
  return `******${cleaned.slice(-4)}`;
};

// ============================================
// TEXT FORMATTING
// ============================================

/**
 * Capitalize first letter
 * @param {string} str - String to capitalize
 * @returns {string} - Capitalized string
 */
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Capitalize each word
 * @param {string} str - String to capitalize
 * @returns {string} - Title cased string
 */
export const titleCase = (str) => {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => capitalize(word)).join(' ');
};

/**
 * Convert to sentence case
 * @param {string} str - String to convert
 * @returns {string} - Sentence case string
 */
export const sentenceCase = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Truncate string with ellipsis
 * @param {string} str - String to truncate
 * @param {number} length - Max length
 * @returns {string} - Truncated string
 */
export const truncate = (str, length = 50) => {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
};

/**
 * Truncate string with ellipsis in middle
 * @param {string} str - String to truncate
 * @param {number} maxLength - Max length
 * @returns {string} - Truncated string
 */
export const truncateMiddle = (str, maxLength = 20) => {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  const charsToShow = maxLength - 3;
  const frontChars = Math.ceil(charsToShow / 2);
  const backChars = Math.floor(charsToShow / 2);
  return str.substr(0, frontChars) + '...' + str.substr(str.length - backChars);
};

/**
 * Convert to slug (URL-friendly)
 * @param {string} str - String to convert
 * @returns {string} - Slug
 */
export const slugify = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Remove extra whitespace
 * @param {string} str - String to clean
 * @returns {string} - Cleaned string
 */
export const cleanWhitespace = (str) => {
  if (!str) return '';
  return str.replace(/\s+/g, ' ').trim();
};

/**
 * Extract initials from name
 * @param {string} name - Full name
 * @param {number} max - Max initials (default: 2)
 * @returns {string} - Initials
 */
export const getInitials = (name, max = 2) => {
  if (!name) return '';
  return name
    .split(' ')
    .filter(word => word.length > 0)
    .slice(0, max)
    .map(word => word[0].toUpperCase())
    .join('');
};

// ============================================
// FILE SIZE FORMATTING
// ============================================

/**
 * Format file size in bytes to human-readable
 * @param {number} bytes - File size in bytes
 * @param {number} decimals - Decimal places (default: 2)
 * @returns {string} - Formatted file size
 */
export const formatFileSize = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
};

// ============================================
// ADDRESS FORMATTING
// ============================================

/**
 * Format address with line breaks
 * @param {object} address - Address object
 * @returns {string} - Formatted address
 */
export const formatAddress = (address) => {
  if (!address) return '-';
  
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.pincode && `PIN: ${address.pincode}`,
    address.country
  ].filter(Boolean);
  
  return parts.join(', ');
};

/**
 * Format address for display (multiline)
 * @param {object} address - Address object
 * @returns {string} - Formatted address with line breaks
 */
export const formatAddressMultiline = (address) => {
  if (!address) return '-';
  
  const parts = [
    address.line1,
    address.line2,
    address.city,
    `${address.state} - ${address.pincode}`,
    address.country
  ].filter(Boolean);
  
  return parts.join('\n');
};

// ============================================
// ID & CODE FORMATTING
// ============================================

/**
 * Format invoice number with padding
 * @param {number|string} number - Invoice number
 * @param {string} prefix - Prefix (default: 'INV')
 * @param {number} length - Padding length (default: 6)
 * @returns {string} - Formatted invoice number
 */
export const formatInvoiceNumber = (number, prefix = 'INV', length = 6) => {
  const padded = String(number).padStart(length, '0');
  return `${prefix}-${padded}`;
};

/**
 * Format GST number
 * @param {string} gstin - GSTIN
 * @returns {string} - Formatted GSTIN
 */
export const formatGSTIN = (gstin) => {
  if (!gstin) return '-';
  // Format: 22AAAAA0000A1Z5
  const cleaned = gstin.replace(/\s/g, '').toUpperCase();
  if (cleaned.length !== 15) return gstin;
  return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 7)} ${cleaned.slice(7, 11)} ${cleaned.slice(11, 12)} ${cleaned.slice(12, 14)} ${cleaned.slice(14)}`;
};

/**
 * Format PAN number
 * @param {string} pan - PAN
 * @returns {string} - Formatted PAN
 */
export const formatPAN = (pan) => {
  if (!pan) return '-';
  return pan.toUpperCase();
};

/**
 * Mask sensitive ID (show first and last characters)
 * @param {string} id - ID to mask
 * @param {number} visible - Visible characters on each end (default: 2)
 * @returns {string} - Masked ID
 */
export const maskID = (id, visible = 2) => {
  if (!id || id.length <= visible * 2) return id;
  const start = id.slice(0, visible);
  const end = id.slice(-visible);
  const middle = '*'.repeat(Math.max(id.length - visible * 2, 4));
  return `${start}${middle}${end}`;
};

// ============================================
// STATUS & BADGE FORMATTING
// ============================================

/**
 * Format status with color
 * @param {string} status - Status value
 * @returns {object} - Status with display properties
 */
export const formatStatus = (status) => {
  const statusMap = {
    active: { label: 'Active', color: 'green', icon: '✓' },
    inactive: { label: 'Inactive', color: 'gray', icon: '○' },
    pending: { label: 'Pending', color: 'yellow', icon: '⌛' },
    approved: { label: 'Approved', color: 'green', icon: '✓' },
    rejected: { label: 'Rejected', color: 'red', icon: '✗' },
    paid: { label: 'Paid', color: 'green', icon: '✓' },
    unpaid: { label: 'Unpaid', color: 'red', icon: '✗' },
    partial: { label: 'Partial', color: 'yellow', icon: '◐' },
    overdue: { label: 'Overdue', color: 'red', icon: '⚠' },
    draft: { label: 'Draft', color: 'gray', icon: '📝' },
    cancelled: { label: 'Cancelled', color: 'gray', icon: '✗' }
  };
  
  return statusMap[status?.toLowerCase()] || { 
    label: capitalize(status || 'Unknown'), 
    color: 'gray', 
    icon: '?' 
  };
};

/**
 * Format priority level
 * @param {string} priority - Priority value
 * @returns {object} - Priority with display properties
 */
export const formatPriority = (priority) => {
  const priorityMap = {
    low: { label: 'Low', color: 'blue', icon: '↓' },
    medium: { label: 'Medium', color: 'yellow', icon: '→' },
    high: { label: 'High', color: 'orange', icon: '↑' },
    urgent: { label: 'Urgent', color: 'red', icon: '⚠' }
  };
  
  return priorityMap[priority?.toLowerCase()] || { 
    label: capitalize(priority || 'Normal'), 
    color: 'gray', 
    icon: '•' 
  };
};

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Check if value is empty
 * @param {any} value - Value to check
 * @returns {boolean} - Is empty
 */
export const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

/**
 * Format empty value with default
 * @param {any} value - Value to check
 * @param {string} defaultValue - Default value (default: '-')
 * @returns {any} - Value or default
 */
export const formatEmpty = (value, defaultValue = '-') => {
  return isEmpty(value) ? defaultValue : value;
};

// ============================================
// ARRAY FORMATTING
// ============================================

/**
 * Format array as comma-separated list
 * @param {array} arr - Array to format
 * @param {string} conjunction - Conjunction word (default: 'and')
 * @returns {string} - Formatted list
 */
export const formatList = (arr, conjunction = 'and') => {
  if (!arr || arr.length === 0) return '-';
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} ${conjunction} ${arr[1]}`;
  return `${arr.slice(0, -1).join(', ')}, ${conjunction} ${arr[arr.length - 1]}`;
};

/**
 * Format array with maximum items shown
 * @param {array} arr - Array to format
 * @param {number} max - Maximum items to show (default: 3)
 * @returns {string} - Formatted list
 */
export const formatListWithMax = (arr, max = 3) => {
  if (!arr || arr.length === 0) return '-';
  if (arr.length <= max) return arr.join(', ');
  const shown = arr.slice(0, max).join(', ');
  const remaining = arr.length - max;
  return `${shown} +${remaining} more`;
};

// ============================================
// EXPORT ALL
// ============================================

export default {
  // Currency
  formatCurrency,
  formatCompactCurrency,
  formatAmount,
  parseCurrency,
  
  // Number
  formatNumber,
  formatCompactNumber,
  formatPercentage,
  formatDecimalAsPercentage,
  formatOrdinal,
  formatWithSign,
  
  // Date & Time
  formatDate,
  formatDateTime,
  formatTime,
  formatDateForInput,
  formatDateTimeForInput,
  formatRelativeTime,
  formatDuration,
  getDayName,
  getMonthName,
  
  // Date Validation
  isExpired,
  isExpiringSoon,
  isToday,
  isYesterday,
  isThisWeek,
  daysBetween,
  
  // Phone
  formatPhone,
  maskPhone,
  
  // Text
  capitalize,
  titleCase,
  sentenceCase,
  truncate,
  truncateMiddle,
  slugify,
  cleanWhitespace,
  getInitials,
  
  // File
  formatFileSize,
  
  // Address
  formatAddress,
  formatAddressMultiline,
  
  // ID & Code
  formatInvoiceNumber,
  formatGSTIN,
  formatPAN,
  maskID,
  
  // Status
  formatStatus,
  formatPriority,
  
  // Validation
  isEmpty,
  formatEmpty,
  
  // Array
  formatList,
  formatListWithMax
};
