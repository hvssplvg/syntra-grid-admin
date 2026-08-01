// lib/clients/esteem-account.ts
//
// Commercial and contractual facts about the client. This data belongs to
// Syntra Grid, not to the client's Firebase project — never fetch it from
// their Firestore. Move to your own database when you have more than a
// handful of clients; the shape below is what the page expects.

export type ClientStatus = 'active' | 'onboarding' | 'suspended' | 'churned';

export type ClientAccount = {
  /** Internal reference shown in the header and used on invoices. */
  clientRef: string;
  name: string;
  /** Path under /public, or null to fall back to the generic icon. */
  logo: string | null;
  productName: string;
  status: ClientStatus;

  /** Primary production domain, without protocol. */
  domain: string;
  adminUrl: string;

  plan: string;
  billingCycle: 'monthly' | 'annual';
  /** ISO date. Drives the renewal countdown and the renewal risk item. */
  renewalAt: string;
  /** ISO date the client went live. */
  liveSince: string;

  contractValue: number;
  currency: 'NGN' | 'GBP' | 'USD';

  primaryContact: {
    name: string;
    role: string;
    email: string;
    phone?: string;
  };

  /** Wire to your billing table. Placeholder values are clearly marked. */
  billing: {
    lastInvoiceRef: string | null;
    lastInvoiceAt: string | null;
    lastInvoiceStatus: 'paid' | 'sent' | 'overdue' | null;
    outstandingAmount: number;
  };

  /** Wire to your support inbox / ticket table. */
  support: {
    openTickets: number;
    oldestOpenTicketAt: string | null;
    lastContactAt: string | null;
  };
};

export const ESTEEM_ACCOUNT: ClientAccount = {
  clientRef: 'SYN-ELC-001',
  name: 'Esteem Learning Centre',
  logo: '/images/esteem.png',
  productName: 'School Management Platform',
  status: 'active',

  domain: 'esteemlearningcentre.com.ng',
  adminUrl: 'https://esteemlearningcentre.com.ng/portal/staff-login',

  plan: 'Founding Partner',
  billingCycle: 'annual',
  renewalAt: '2027-09-01',
  liveSince: '2025-09-01',

  contractValue: 0, // TODO: real contract value
  currency: 'NGN',

  primaryContact: {
    name: 'School Administrator',
    role: 'Head of Administration',
    email: 'admin@esteemlearningcentre.com.ng',
  },

  billing: {
    lastInvoiceRef: null,
    lastInvoiceAt: null,
    lastInvoiceStatus: null,
    outstandingAmount: 0,
  },

  support: {
    openTickets: 0,
    oldestOpenTicketAt: null,
    lastContactAt: null,
  },
};