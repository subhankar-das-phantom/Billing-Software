const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/**
 * Convert number to words (Indian numbering system)
 * @param {number} num - Number to convert
 * @returns {string} Number in words
 */
const numberToWords = (num) => {
  if (num === 0) return 'Zero Rupees Only';
  
  num = Math.round(num * 100) / 100; // Round to 2 decimal places
  
  const [rupees, paise] = num.toString().split('.');
  let result = '';
  
  const rupeesInWords = convertToWords(parseInt(rupees));
  if (rupeesInWords) {
    result = rupeesInWords + ' Rupees';
  }
  
  if (paise && parseInt(paise) > 0) {
    const paiseNum = parseInt(paise.padEnd(2, '0').substring(0, 2));
    const paiseInWords = convertToWords(paiseNum);
    if (paiseInWords) {
      result += (result ? ' and ' : '') + paiseInWords + ' Paise';
    }
  }
  
  return result + ' Only';
};

const convertToWords = (num) => {
  if (num === 0) return '';
  
  if (num < 20) {
    return ones[num];
  }
  
  if (num < 100) {
    return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  }
  
  if (num < 1000) {
    return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + convertToWords(num % 100) : '');
  }
  
  if (num < 100000) {
    return convertToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + convertToWords(num % 1000) : '');
  }
  
  if (num < 10000000) {
    return convertToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + convertToWords(num % 100000) : '');
  }
  
  return convertToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + convertToWords(num % 10000000) : '');
};

module.exports = { numberToWords };
