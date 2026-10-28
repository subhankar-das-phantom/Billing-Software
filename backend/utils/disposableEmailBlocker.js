/**
 * Disposable / Temporary Email Blocker
 *
 * Provides high-performance O(1) set lookup to detect burner and temporary
 * email domains commonly used by automated bots, scrapers, and fraudulent tenants.
 */

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'mailin8r.com',
  'mailinator2.com',
  'tempmail.com',
  'temp-mail.org',
  'tempmail.net',
  '10minutemail.com',
  '10minutemail.net',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'sharklasers.com',
  'grr.la',
  'guerrillamail.biz',
  'throwawaymail.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'cool.fr.nf',
  'courriel.fr.nf',
  'trashmail.com',
  'trashmail.net',
  'trashmail.org',
  'trashmail.me',
  'fakeinbox.com',
  'dispostable.com',
  'getairmail.com',
  'fakemailgenerator.com',
  'mohmal.com',
  'mohmal.in',
  'nada.ltd',
  'getnada.com',
  'inboxkitten.com',
  'crazymailing.com',
  'dropmail.me',
  'generator.email',
  'maildrop.cc',
  'burnermail.io',
  'mytemp.email',
  'emailondeck.com',
  'tempinbox.com',
  'disposablemail.com',
  'tmpmail.org',
  'tmpmail.net',
  'mytempmail.com',
  'tempail.com',
  'binkmail.com',
  'bobmail.info',
  'chammy.info',
  'devnullmail.com',
  'letthemeatspam.com',
  'suremail.info',
  'tradermail.info',
  'spam4.me',
  'bccto.me',
  'disposable.com',
  'chacuo.net',
  '0815.ru',
  'zoemail.org'
]);

/**
 * Check if an email address uses a known disposable/temporary domain.
 * @param {string} email - The email address to check
 * @returns {boolean} True if disposable, false if permanent/legitimate
 */
function isDisposableEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) {
    return false;
  }

  const domain = parts[1];
  return DISPOSABLE_DOMAINS.has(domain);
}

module.exports = {
  isDisposableEmail,
  DISPOSABLE_DOMAINS
};
