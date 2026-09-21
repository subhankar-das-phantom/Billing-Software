/**
 * Truthful, verified operational FAQs for Bharat Enterprise.
 * Based directly on actual software capabilities, Indian regulatory compliance, and SaaS setup.
 */

export const FAQS = [
  {
    question: 'How does Bharat Enterprise calculate and display GST on invoices?',
    answer:
      'Bharat Enterprise automatically calculates CGST and SGST for intra-state transactions (within the same state) or IGST for inter-state billing based on your business state and customer address. Invoices display itemized HSN codes, taxable amounts, and individual tax percentages.',
  },
  {
    question: 'Can I track batch numbers, expiry dates, and MRP for products?',
    answer:
      'Yes. Every product in your catalog can maintain multiple distinct batches with individual manufacturing and expiry dates, purchase rates, and MRPs. During invoice creation, you select the specific batch to fulfill from, ensuring stock is accounted for correctly.',
  },
  {
    question: 'How does customer ledger and khata tracking work?',
    answer:
      'Whenever an invoice is generated, the amount is posted to that customer\'s balance. When payments are recorded (via cash, bank transfer, or UPI), receipts are issued and the customer\'s balance decreases. You can also post manual debit/credit adjustments and generate complete ledger account statements.',
  },
  {
    question: 'Can I print both customer and transporter/office copies?',
    answer:
      'Yes. The invoice preview interface provides a "Double Copy (2x)" option, allowing you to print or export both the original recipient copy and the transporter/duplicate copy in a single unified print layout.',
  },
  {
    question: 'What access permissions do employees have compared to administrators?',
    answer:
      'Administrators have complete visibility into financial analytics, employee management, system settings, and subscription controls. Employee accounts can be assigned restricted roles to create invoices and manage customer lookup without exposing sensitive overall profit or administrative telemetry.',
  },
  {
    question: 'Is there a free trial period when creating an account?',
    answer:
      'Yes. New tenant accounts automatically receive access to explore the platform\'s features during their initial trial period, allowing you to verify invoice formats, catalog configuration, and workflows before committing to a paid tier.',
  },
  {
    question: 'Can I export my data for GST filing or accounting records?',
    answer:
      'Yes. You can export invoice registers, product inventory summaries, and customer ledgers to standard CSV/Excel and PDF formats for tax compliance, reconciliation with your accountant, or internal auditing.',
  },
];
