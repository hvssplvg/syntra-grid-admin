// lib/clients/registry.ts
//
// The clients Syntra Grid actively manages. The index page renders from this
// list, so adding a client here is all it takes for a card to appear.
//
// This is commercial data that belongs to Syntra Grid — it never comes from a
// client's own database. Move it into Prisma once the list outgrows a file.

import { ESTEEM_ACCOUNT, type ClientAccount } from './esteem-account';

export type { ClientAccount, ClientStatus } from './esteem-account';

/** How the client's platform data reaches us. */
export type ClientDataSource = 'firebase' | 'postgres' | 'none';

export type ClientRegistryEntry = {
  slug: string;
  account: ClientAccount;
  dataSource: ClientDataSource;
  /** False until the integration is actually reading live data. */
  integrationLive: boolean;
};

export const RENTWISE_ACCOUNT: ClientAccount = {
  clientRef: 'SYN-RTW-002',
  name: 'RentWise',
  logo: null, // TODO: add /images/rentwise.png
  productName: 'Property Technology Platform',
  status: 'onboarding',

  domain: 'rentwise.app', // TODO: confirm production domain
  adminUrl: '',

  plan: 'Founding Partner',
  billingCycle: 'annual',
  renewalAt: '2027-09-01', // TODO: real renewal date
  liveSince: '2026-01-01', // TODO: real go-live date

  contractValue: 0,
  currency: 'NGN',

  primaryContact: {
    name: 'Not recorded',
    role: '—',
    email: '',
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

export const CLIENTS: ClientRegistryEntry[] = [
  {
    slug: 'esteem-learning-centre',
    account: ESTEEM_ACCOUNT,
    dataSource: 'firebase',
    integrationLive: true,
  },
  {
    slug: 'rentwise',
    account: RENTWISE_ACCOUNT,
    dataSource: 'postgres',
    integrationLive: false,
  },
];

export function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}