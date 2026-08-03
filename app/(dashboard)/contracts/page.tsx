'use client';

import { useMemo, useState } from 'react';
import type {
  ComponentType,
  FormEvent,
  ReactNode,
} from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Copy,
  Download,
  Eye,
  FileCheck2,
  FileSignature,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';

type ContractStatus =
  | 'DRAFT'
  | 'AWAITING_SIGNATURE'
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'TERMINATED';

type BillingCycle =
  | 'ONE_TIME'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'ANNUAL'
  | 'CUSTOM';

type Currency = 'GBP' | 'NGN' | 'USD' | 'EUR';

type Contract = {
  id: string;
  contractRef: string;
  title: string;
  client: string;
  clientInitials: string;
  service: string;
  project: string | null;
  value: number;
  paid: number;
  depositRequired: number;
  currency: Currency;
  billingCycle: BillingCycle;
  startDate: string;
  endDate: string;
  renewalDate: string | null;
  status: ContractStatus;
  contactName: string;
  contactEmail: string;
  signedAt: string | null;
  documentName: string | null;
  notes: string;
  createdAt: string;
};

type ContractForm = {
  title: string;
  client: string;
  service: string;
  project: string;
  value: string;
  paid: string;
  depositRequired: string;
  currency: Currency;
  billingCycle: BillingCycle;
  startDate: string;
  endDate: string;
  renewalDate: string;
  status: ContractStatus;
  contactName: string;
  contactEmail: string;
  notes: string;
};

const initialContracts: Contract[] = [
  {
    id: 'contract-1',
    contractRef: 'SG-CON-2026-001',
    title: 'School Management Platform',
    client: 'Esteem Learning Centre',
    clientInitials: 'EL',
    service: 'Full school management system',
    project: 'Esteem Learning Centre Platform',
    value: 8000000,
    paid: 3000000,
    depositRequired: 3000000,
    currency: 'NGN',
    billingCycle: 'ANNUAL',
    startDate: '2026-06-01',
    endDate: '2027-05-31',
    renewalDate: '2027-06-01',
    status: 'ACTIVE',
    contactName: 'School Administrator',
    contactEmail: 'admin@esteemlearningcentre.sch.ng',
    signedAt: '2026-05-25',
    documentName: 'esteem-service-agreement.pdf',
    notes:
      'Includes the website, administrative dashboard, teacher portal, student portal and mobile application.',
    createdAt: '2026-05-20',
  },
  {
    id: 'contract-2',
    contractRef: 'SG-CON-2026-002',
    title: 'Property Platform Development',
    client: 'RentWise',
    clientInitials: 'RW',
    service: 'Property technology platform',
    project: 'RentWise Platform',
    value: 12500,
    paid: 5000,
    depositRequired: 5000,
    currency: 'GBP',
    billingCycle: 'CUSTOM',
    startDate: '2026-07-01',
    endDate: '2027-01-31',
    renewalDate: null,
    status: 'ACTIVE',
    contactName: 'RentWise Director',
    contactEmail: 'director@rentwise.example',
    signedAt: '2026-06-26',
    documentName: 'rentwise-development-contract.pdf',
    notes:
      'Covers landlord, renter, agent and estate-management functionality.',
    createdAt: '2026-06-22',
  },
  {
    id: 'contract-3',
    contractRef: 'SG-CON-2026-003',
    title: 'Corporate Website and CMS',
    client: 'Meldex Industries',
    clientInitials: 'MI',
    service: 'Website and content management system',
    project: 'Meldex Industries Website',
    value: 4200,
    paid: 0,
    depositRequired: 2100,
    currency: 'GBP',
    billingCycle: 'ONE_TIME',
    startDate: '2026-08-10',
    endDate: '2026-11-10',
    renewalDate: null,
    status: 'AWAITING_SIGNATURE',
    contactName: 'Operations Director',
    contactEmail: 'operations@meldex.example',
    signedAt: null,
    documentName: null,
    notes:
      'Contract has been sent to the client and is waiting for signature.',
    createdAt: '2026-07-28',
  },
  {
    id: 'contract-4',
    contractRef: 'SG-CON-2025-008',
    title: 'Application Maintenance Agreement',
    client: 'Northstar Retail',
    clientInitials: 'NR',
    service: 'Application maintenance',
    project: 'Northstar Commerce',
    value: 2400,
    paid: 2400,
    depositRequired: 0,
    currency: 'GBP',
    billingCycle: 'ANNUAL',
    startDate: '2025-09-01',
    endDate: '2026-08-31',
    renewalDate: '2026-09-01',
    status: 'EXPIRING_SOON',
    contactName: 'Technical Manager',
    contactEmail: 'technology@northstar.example',
    signedAt: '2025-08-20',
    documentName: 'northstar-maintenance.pdf',
    notes: 'Renewal discussion should begin before 15 August.',
    createdAt: '2025-08-14',
  },
];

const emptyForm: ContractForm = {
  title: '',
  client: '',
  service: '',
  project: '',
  value: '',
  paid: '',
  depositRequired: '',
  currency: 'GBP',
  billingCycle: 'ONE_TIME',
  startDate: '',
  endDate: '',
  renewalDate: '',
  status: 'DRAFT',
  contactName: '',
  contactEmail: '',
  notes: '',
};

export default function ContractsPage() {
  const [contracts, setContracts] =
    useState<Contract[]>(initialContracts);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | ContractStatus
  >('ALL');

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedContract, setSelectedContract] =
    useState<Contract | null>(null);

  const [activeMenuId, setActiveMenuId] = useState<string | null>(
    null,
  );

  const [form, setForm] = useState<ContractForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const filteredContracts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return contracts.filter((contract) => {
      const matchesStatus =
        statusFilter === 'ALL' ||
        contract.status === statusFilter;

      const matchesSearch =
        !query ||
        contract.contractRef.toLowerCase().includes(query) ||
        contract.title.toLowerCase().includes(query) ||
        contract.client.toLowerCase().includes(query) ||
        contract.service.toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [contracts, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const activeContracts = contracts.filter(
      (contract) => contract.status === 'ACTIVE',
    );

    const awaitingSignature = contracts.filter(
      (contract) =>
        contract.status === 'AWAITING_SIGNATURE',
    );

    const expiringSoon = contracts.filter(
      (contract) => contract.status === 'EXPIRING_SOON',
    );

    const gbpEquivalentValue = contracts.reduce(
      (total, contract) =>
        total + approximateGbpValue(contract.value, contract.currency),
      0,
    );

    return {
      active: activeContracts.length,
      awaiting: awaitingSignature.length,
      expiring: expiringSoon.length,
      approximateValue: gbpEquivalentValue,
    };
  }, [contracts]);

  function updateForm<Key extends keyof ContractForm>(
    key: Key,
    value: ContractForm[Key],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openCreateModal() {
    setForm(emptyForm);
    setFormError('');
    setCreateOpen(true);
  }

  function closeCreateModal() {
    setCreateOpen(false);
    setFormError('');
  }

  function createContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !form.title.trim() ||
      !form.client.trim() ||
      !form.service.trim()
    ) {
      setFormError(
        'Enter the contract title, client and service.',
      );
      return;
    }

    const value = Number(form.value);
    const paid = Number(form.paid || 0);
    const depositRequired = Number(
      form.depositRequired || 0,
    );

    if (!Number.isFinite(value) || value <= 0) {
      setFormError('Enter a valid contract value.');
      return;
    }

    if (!form.startDate || !form.endDate) {
      setFormError('Select the contract start and end dates.');
      return;
    }

    if (new Date(form.endDate) < new Date(form.startDate)) {
      setFormError(
        'The contract end date cannot be before the start date.',
      );
      return;
    }

    const contract: Contract = {
      id: crypto.randomUUID(),
      contractRef: generateContractReference(contracts),
      title: form.title.trim(),
      client: form.client.trim(),
      clientInitials: getInitials(form.client),
      service: form.service.trim(),
      project: form.project.trim() || null,
      value,
      paid: Math.max(0, paid),
      depositRequired: Math.max(0, depositRequired),
      currency: form.currency,
      billingCycle: form.billingCycle,
      startDate: form.startDate,
      endDate: form.endDate,
      renewalDate: form.renewalDate || null,
      status: form.status,
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim(),
      signedAt:
        form.status === 'ACTIVE'
          ? new Date().toISOString().slice(0, 10)
          : null,
      documentName: null,
      notes: form.notes.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
    };

    setContracts((current) => [contract, ...current]);
    setCreateOpen(false);
    setForm(emptyForm);
    showNotice(`${contract.contractRef} was created.`);
  }

  function updateContractStatus(
    id: string,
    status: ContractStatus,
  ) {
    setContracts((current) =>
      current.map((contract) =>
        contract.id === id
          ? {
              ...contract,
              status,
              signedAt:
                status === 'ACTIVE' && !contract.signedAt
                  ? new Date().toISOString().slice(0, 10)
                  : contract.signedAt,
            }
          : contract,
      ),
    );

    setSelectedContract((current) =>
      current?.id === id
        ? {
            ...current,
            status,
            signedAt:
              status === 'ACTIVE' && !current.signedAt
                ? new Date().toISOString().slice(0, 10)
                : current.signedAt,
          }
        : current,
    );

    showNotice(`Contract status changed to ${tidyStatus(status)}.`);
  }

  function duplicateContract(contract: Contract) {
    const duplicate: Contract = {
      ...contract,
      id: crypto.randomUUID(),
      contractRef: generateContractReference(contracts),
      title: `${contract.title} — Copy`,
      status: 'DRAFT',
      paid: 0,
      signedAt: null,
      documentName: null,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    setContracts((current) => [duplicate, ...current]);
    setActiveMenuId(null);
    showNotice(`${duplicate.contractRef} was created as a draft.`);
  }

  function deleteContract(contract: Contract) {
    const confirmed = window.confirm(
      `Delete ${contract.contractRef}? This prototype action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setContracts((current) =>
      current.filter((item) => item.id !== contract.id),
    );

    if (selectedContract?.id === contract.id) {
      setSelectedContract(null);
    }

    setActiveMenuId(null);
    showNotice(`${contract.contractRef} was deleted.`);
  }

  function showNotice(message: string) {
    setNotice(message);

    window.setTimeout(() => {
      setNotice('');
    }, 3500);
  }

  return (
    <main className="space-y-6 pb-10">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#A87B1B]">
            <FileSignature className="h-4 w-4" />
            Commercial operations
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0B1020]">
            Contracts
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5A6173]">
            Create agreements, track signatures, monitor contract
            values and manage client renewals from one place.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#0B1020]/10 bg-white px-4 text-sm font-bold text-[#334155] transition hover:bg-[#F8FAFC]"
          >
            <Download className="h-4 w-4" />
            Export
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B1020] px-5 text-sm font-bold text-white transition hover:bg-[#151D34]"
          >
            <Plus className="h-4 w-4" />
            New contract
          </button>
        </div>
      </header>

      {notice && (
        <div
          aria-live="polite"
          className="flex items-center gap-3 rounded-2xl border border-[#14B8A6]/25 bg-[#14B8A6]/[0.07] px-4 py-3 text-sm font-semibold text-[#0D9488]"
        >
          <CheckCircle2 className="h-5 w-5" />
          {notice}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active contracts"
          value={String(stats.active)}
          detail="Currently in delivery"
          icon={FileCheck2}
          iconClassName="bg-[#14B8A6]/10 text-[#0D9488]"
        />

        <MetricCard
          label="Approximate value"
          value={formatMoney(
            stats.approximateValue,
            'GBP',
            true,
          )}
          detail="GBP-equivalent portfolio"
          icon={CircleDollarSign}
          iconClassName="bg-[#D4AF37]/12 text-[#A87B1B]"
        />

        <MetricCard
          label="Awaiting signature"
          value={String(stats.awaiting)}
          detail="Require client action"
          icon={Clock3}
          iconClassName="bg-[#1E4E8C]/10 text-[#1E4E8C]"
        />

        <MetricCard
          label="Expiring soon"
          value={String(stats.expiring)}
          detail="Renewal action required"
          icon={AlertTriangle}
          iconClassName="bg-amber-50 text-amber-700"
        />
      </section>

      <section className="overflow-visible rounded-3xl border border-[#0B1020]/[0.07] bg-white shadow-[0_1px_2px_rgba(11,16,32,0.04)]">
        <div className="flex flex-col gap-4 border-b border-[#0B1020]/[0.06] p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0B1020]">
              Contract register
            </h2>

            <p className="mt-1 text-sm text-[#5A6173]">
              {filteredContracts.length} of {contracts.length}{' '}
              contracts displayed.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A6173]/60" />

              <input
                type="search"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
                placeholder="Search contracts"
                className="h-11 w-full rounded-xl border border-[#0B1020]/10 bg-[#FAFAF9] pl-10 pr-4 text-sm text-[#0B1020] outline-none transition focus:border-[#14B8A6] focus:bg-white sm:w-64"
              />
            </label>

            <label className="relative">
              <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A6173]/60" />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as
                      | 'ALL'
                      | ContractStatus,
                  )
                }
                className="h-11 w-full appearance-none rounded-xl border border-[#0B1020]/10 bg-white pl-10 pr-10 text-sm font-semibold text-[#334155] outline-none focus:border-[#14B8A6] sm:w-52"
              >
                <option value="ALL">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="AWAITING_SIGNATURE">
                  Awaiting signature
                </option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRING_SOON">
                  Expiring soon
                </option>
                <option value="EXPIRED">Expired</option>
                <option value="TERMINATED">Terminated</option>
              </select>

              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A6173]" />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead>
              <tr className="border-b border-[#0B1020]/[0.06] bg-[#FAFAF9] text-left">
                <TableHeading>Contract</TableHeading>
                <TableHeading>Client</TableHeading>
                <TableHeading>Value</TableHeading>
                <TableHeading>Payment</TableHeading>
                <TableHeading>Period</TableHeading>
                <TableHeading>Status</TableHeading>
                <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-[0.08em] text-[#64748B]">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredContracts.map((contract) => {
                const balance = Math.max(
                  contract.value - contract.paid,
                  0,
                );

                const paidPercentage = Math.min(
                  100,
                  Math.round(
                    (contract.paid / contract.value) * 100,
                  ),
                );

                return (
                  <tr
                    key={contract.id}
                    className="border-b border-[#0B1020]/[0.06] last:border-0 hover:bg-[#FAFAF9]/70"
                  >
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedContract(contract)
                        }
                        className="text-left"
                      >
                        <p className="text-sm font-bold text-[#0B1020] hover:text-[#A87B1B]">
                          {contract.title}
                        </p>

                        <p className="mt-1 text-xs font-medium text-[#64748B]">
                          {contract.contractRef}
                        </p>
                      </button>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0B1020]/[0.05] text-xs font-bold text-[#0B1020]">
                          {contract.clientInitials}
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-[#334155]">
                            {contract.client}
                          </p>

                          <p className="mt-0.5 max-w-48 truncate text-xs text-[#64748B]">
                            {contract.service}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-[#0B1020]">
                        {formatMoney(
                          contract.value,
                          contract.currency,
                        )}
                      </p>

                      <p className="mt-1 text-xs text-[#64748B]">
                        {tidyBillingCycle(
                          contract.billingCycle,
                        )}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <div className="w-36">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#0D9488]">
                            {paidPercentage}% paid
                          </span>

                          <span className="text-[#64748B]">
                            {formatMoney(
                              balance,
                              contract.currency,
                              true,
                            )}{' '}
                            due
                          </span>
                        </div>

                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E8ECEA]">
                          <div
                            className="h-full rounded-full bg-[#14B8A6]"
                            style={{
                              width: `${paidPercentage}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-[#334155]">
                        {formatDate(contract.startDate)}
                      </p>

                      <p className="mt-1 text-xs text-[#64748B]">
                        to {formatDate(contract.endDate)}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={contract.status} />
                    </td>

                    <td className="relative px-5 py-4 text-right">
                      <button
                        type="button"
                        aria-label={`Open actions for ${contract.contractRef}`}
                        onClick={() =>
                          setActiveMenuId((current) =>
                            current === contract.id
                              ? null
                              : contract.id,
                          )
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#64748B] transition hover:bg-[#0B1020]/[0.05] hover:text-[#0B1020]"
                      >
                        <MoreHorizontal className="h-5 w-5" />
                      </button>

                      {activeMenuId === contract.id && (
                        <div className="absolute right-5 top-14 z-20 w-52 rounded-2xl border border-[#0B1020]/10 bg-white p-1.5 text-left shadow-[0_18px_45px_rgba(11,16,32,0.16)]">
                          <ActionButton
                            icon={Eye}
                            label="View contract"
                            onClick={() => {
                              setSelectedContract(contract);
                              setActiveMenuId(null);
                            }}
                          />

                          <ActionButton
                            icon={Copy}
                            label="Duplicate"
                            onClick={() =>
                              duplicateContract(contract)
                            }
                          />

                          {contract.status === 'DRAFT' && (
                            <ActionButton
                              icon={Send}
                              label="Send for signature"
                              onClick={() => {
                                updateContractStatus(
                                  contract.id,
                                  'AWAITING_SIGNATURE',
                                );
                                setActiveMenuId(null);
                              }}
                            />
                          )}

                          {contract.status ===
                            'AWAITING_SIGNATURE' && (
                            <ActionButton
                              icon={Check}
                              label="Mark as active"
                              onClick={() => {
                                updateContractStatus(
                                  contract.id,
                                  'ACTIVE',
                                );
                                setActiveMenuId(null);
                              }}
                            />
                          )}

                          <div className="my-1 border-t border-[#0B1020]/[0.06]" />

                          <ActionButton
                            icon={Trash2}
                            label="Delete"
                            danger
                            onClick={() =>
                              deleteContract(contract)
                            }
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredContracts.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-16 text-center"
                  >
                    <FileSignature className="mx-auto h-9 w-9 text-[#94A3B8]" />

                    <p className="mt-3 text-sm font-bold text-[#334155]">
                      No matching contracts
                    </p>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Change the filters or create a new contract.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#0B1020]/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#64748B]">
            Showing {filteredContracts.length} contracts
          </p>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 text-sm font-bold text-[#A87B1B]"
          >
            Create another contract
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {createOpen && (
        <CreateContractModal
          form={form}
          error={formError}
          onUpdate={updateForm}
          onClose={closeCreateModal}
          onSubmit={createContract}
        />
      )}

      {selectedContract && (
        <ContractDetailsDrawer
          contract={selectedContract}
          onClose={() => setSelectedContract(null)}
          onStatusChange={(status) =>
            updateContractStatus(
              selectedContract.id,
              status,
            )
          }
        />
      )}
    </main>
  );
}

function CreateContractModal({
  form,
  error,
  onUpdate,
  onClose,
  onSubmit,
}: {
  form: ContractForm;
  error: string;
  onUpdate: <Key extends keyof ContractForm>(
    key: Key,
    value: ContractForm[Key],
  ) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0B1020]/55 p-4 backdrop-blur-sm">
      <div className="mx-auto my-6 max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#0B1020]/[0.07] px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#A87B1B]">
              New agreement
            </p>

            <h2 className="mt-1 text-xl font-bold text-[#0B1020]">
              Create contract
            </h2>

            <p className="mt-1 text-sm text-[#5A6173]">
              Record the commercial agreement before delivery
              begins.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close create contract dialog"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#64748B] transition hover:bg-[#0B1020]/[0.05]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="grid gap-6 p-6 lg:grid-cols-2">
            <FormSection
              title="Contract details"
              description="The client and service covered by this agreement."
            >
              <TextField
                label="Contract title"
                value={form.title}
                onChange={(value) =>
                  onUpdate('title', value)
                }
                placeholder="e.g. School Management Platform"
                required
              />

              <TextField
                label="Client"
                value={form.client}
                onChange={(value) =>
                  onUpdate('client', value)
                }
                placeholder="Client or company name"
                required
              />

              <TextField
                label="Service or product"
                value={form.service}
                onChange={(value) =>
                  onUpdate('service', value)
                }
                placeholder="What Syntra Grid will deliver"
                required
              />

              <TextField
                label="Linked project"
                value={form.project}
                onChange={(value) =>
                  onUpdate('project', value)
                }
                placeholder="Optional project name"
              />
            </FormSection>

            <FormSection
              title="Commercial terms"
              description="Set the contract value and payment structure."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Currency"
                  value={form.currency}
                  onChange={(value) =>
                    onUpdate(
                      'currency',
                      value as Currency,
                    )
                  }
                >
                  <option value="GBP">GBP — British pound</option>
                  <option value="NGN">NGN — Nigerian naira</option>
                  <option value="USD">USD — US dollar</option>
                  <option value="EUR">EUR — Euro</option>
                </SelectField>

                <SelectField
                  label="Billing cycle"
                  value={form.billingCycle}
                  onChange={(value) =>
                    onUpdate(
                      'billingCycle',
                      value as BillingCycle,
                    )
                  }
                >
                  <option value="ONE_TIME">One-time</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">
                    Quarterly
                  </option>
                  <option value="ANNUAL">Annual</option>
                  <option value="CUSTOM">Custom</option>
                </SelectField>
              </div>

              <NumberField
                label="Contract value"
                value={form.value}
                onChange={(value) =>
                  onUpdate('value', value)
                }
                placeholder="0.00"
                required
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label="Deposit required"
                  value={form.depositRequired}
                  onChange={(value) =>
                    onUpdate(
                      'depositRequired',
                      value,
                    )
                  }
                  placeholder="0.00"
                />

                <NumberField
                  label="Already paid"
                  value={form.paid}
                  onChange={(value) =>
                    onUpdate('paid', value)
                  }
                  placeholder="0.00"
                />
              </div>
            </FormSection>

            <FormSection
              title="Contract period"
              description="Define delivery and renewal dates."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <DateField
                  label="Start date"
                  value={form.startDate}
                  onChange={(value) =>
                    onUpdate('startDate', value)
                  }
                  required
                />

                <DateField
                  label="End date"
                  value={form.endDate}
                  onChange={(value) =>
                    onUpdate('endDate', value)
                  }
                  required
                />
              </div>

              <DateField
                label="Renewal date"
                value={form.renewalDate}
                onChange={(value) =>
                  onUpdate('renewalDate', value)
                }
              />

              <SelectField
                label="Initial status"
                value={form.status}
                onChange={(value) =>
                  onUpdate(
                    'status',
                    value as ContractStatus,
                  )
                }
              >
                <option value="DRAFT">Draft</option>
                <option value="AWAITING_SIGNATURE">
                  Awaiting signature
                </option>
                <option value="ACTIVE">Active</option>
              </SelectField>
            </FormSection>

            <FormSection
              title="Client contact"
              description="The person responsible for approving the agreement."
            >
              <TextField
                label="Contact name"
                value={form.contactName}
                onChange={(value) =>
                  onUpdate('contactName', value)
                }
                placeholder="Full name or position"
              />

              <TextField
                label="Contact email"
                type="email"
                value={form.contactEmail}
                onChange={(value) =>
                  onUpdate('contactEmail', value)
                }
                placeholder="client@example.com"
              />

              <label>
                <span className="text-sm font-semibold text-[#334155]">
                  Internal notes
                </span>

                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    onUpdate('notes', event.target.value)
                  }
                  rows={4}
                  placeholder="Important requirements, payment conditions or delivery notes..."
                  className="mt-2 w-full resize-none rounded-xl border border-[#0B1020]/10 bg-[#FAFAF9] px-3.5 py-3 text-sm text-[#0B1020] outline-none transition focus:border-[#14B8A6] focus:bg-white"
                />
              </label>
            </FormSection>
          </div>

          <div className="border-t border-[#0B1020]/[0.07] bg-[#FAFAF9] px-6 py-4">
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#0B1020]/10 bg-white px-4 text-sm font-bold text-[#334155]"
              >
                <Upload className="h-4 w-4" />
                Attach signed document
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-11 rounded-xl border border-[#0B1020]/10 bg-white px-4 text-sm font-bold text-[#334155]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B1020] px-5 text-sm font-bold text-white transition hover:bg-[#151D34]"
                >
                  <FileSignature className="h-4 w-4" />
                  Create contract
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function ContractDetailsDrawer({
  contract,
  onClose,
  onStatusChange,
}: {
  contract: Contract;
  onClose: () => void;
  onStatusChange: (status: ContractStatus) => void;
}) {
  const balance = Math.max(
    contract.value - contract.paid,
    0,
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#0B1020]/45 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close contract details"
        onClick={onClose}
        className="absolute inset-0"
      />

      <aside className="relative z-10 h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#0B1020]/[0.07] bg-white/95 px-6 py-5 backdrop-blur-xl">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#A87B1B]">
              {contract.contractRef}
            </p>

            <h2 className="mt-1 text-xl font-bold text-[#0B1020]">
              {contract.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#64748B] hover:bg-[#0B1020]/[0.05]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="flex items-center justify-between rounded-2xl border border-[#0B1020]/[0.07] bg-[#FAFAF9] p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748B]">
                Current status
              </p>

              <div className="mt-2">
                <StatusBadge status={contract.status} />
              </div>
            </div>

            <label>
              <span className="sr-only">Change contract status</span>

              <select
                value={contract.status}
                onChange={(event) =>
                  onStatusChange(
                    event.target.value as ContractStatus,
                  )
                }
                className="h-10 rounded-xl border border-[#0B1020]/10 bg-white px-3 text-sm font-bold text-[#334155]"
              >
                <option value="DRAFT">Draft</option>
                <option value="AWAITING_SIGNATURE">
                  Awaiting signature
                </option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRING_SOON">
                  Expiring soon
                </option>
                <option value="EXPIRED">Expired</option>
                <option value="TERMINATED">
                  Terminated
                </option>
              </select>
            </label>
          </div>

          <section className="grid grid-cols-2 gap-4">
            <DetailMetric
              label="Contract value"
              value={formatMoney(
                contract.value,
                contract.currency,
              )}
            />

            <DetailMetric
              label="Outstanding"
              value={formatMoney(
                balance,
                contract.currency,
              )}
            />

            <DetailMetric
              label="Paid"
              value={formatMoney(
                contract.paid,
                contract.currency,
              )}
            />

            <DetailMetric
              label="Deposit"
              value={formatMoney(
                contract.depositRequired,
                contract.currency,
              )}
            />
          </section>

          <DetailsSection title="Client">
            <DetailRow
              icon={Building2}
              label="Organisation"
              value={contract.client}
            />

            <DetailRow
              icon={UserRound}
              label="Contact"
              value={
                contract.contactName || 'Not provided'
              }
            />

            <DetailRow
              icon={Send}
              label="Email"
              value={
                contract.contactEmail || 'Not provided'
              }
            />
          </DetailsSection>

          <DetailsSection title="Agreement">
            <DetailRow
              icon={FileSignature}
              label="Service"
              value={contract.service}
            />

            <DetailRow
              icon={CalendarClock}
              label="Contract period"
              value={`${formatDate(
                contract.startDate,
              )} – ${formatDate(contract.endDate)}`}
            />

            <DetailRow
              icon={CircleDollarSign}
              label="Billing cycle"
              value={tidyBillingCycle(
                contract.billingCycle,
              )}
            />

            <DetailRow
              icon={FolderIcon}
              label="Linked project"
              value={contract.project || 'Not linked'}
            />
          </DetailsSection>

          <DetailsSection title="Document">
            {contract.documentName ? (
              <div className="flex items-center justify-between rounded-xl border border-[#0B1020]/[0.07] bg-[#FAFAF9] p-4">
                <div className="flex items-center gap-3">
                  <FileCheck2 className="h-5 w-5 text-[#0D9488]" />

                  <div>
                    <p className="text-sm font-bold text-[#334155]">
                      {contract.documentName}
                    </p>

                    <p className="mt-0.5 text-xs text-[#64748B]">
                      Signed{' '}
                      {contract.signedAt
                        ? formatDate(contract.signedAt)
                        : ''}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-[#64748B] hover:bg-white"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#D4AF37]/40 bg-[#FFFDF7] px-4 py-6 text-sm font-bold text-[#A87B1B]"
              >
                <Upload className="h-4 w-4" />
                Upload signed contract
              </button>
            )}
          </DetailsSection>

          <DetailsSection title="Internal notes">
            <p className="text-sm leading-6 text-[#5A6173]">
              {contract.notes || 'No internal notes added.'}
            </p>
          </DetailsSection>
        </div>
      </aside>
    </div>
  );
}
function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  iconClassName,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
}) {
  return (
    <article className="rounded-3xl border border-[#0B1020]/[0.07] bg-white p-5 shadow-[0_1px_2px_rgba(11,16,32,0.04)]">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconClassName}`}
      >
        <Icon className="h-5 w-5" />
      </div>

      <p className="mt-5 text-sm font-semibold text-[#64748B]">
        {label}
      </p>

      <p className="mt-1 text-3xl font-bold tracking-tight text-[#0B1020]">
        {value}
      </p>

      <p className="mt-2 text-xs text-[#94A3B8]">
        {detail}
      </p>
    </article>
  );
}

function StatusBadge({
  status,
}: {
  status: ContractStatus;
}) {
  const styles: Record<ContractStatus, string> = {
    DRAFT: 'bg-slate-100 text-slate-700',
    AWAITING_SIGNATURE:
      'bg-blue-50 text-blue-700',
    ACTIVE: 'bg-emerald-50 text-emerald-700',
    EXPIRING_SOON: 'bg-amber-50 text-amber-700',
    EXPIRED: 'bg-red-50 text-red-700',
    TERMINATED: 'bg-zinc-100 text-zinc-600',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${styles[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {tidyStatus(status)}
    </span>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#0B1020]/[0.07] p-5">
      <h3 className="text-sm font-bold text-[#0B1020]">
        {title}
      </h3>

      <p className="mt-1 text-xs leading-5 text-[#64748B]">
        {description}
      </p>

      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: 'text' | 'email';
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#334155]">
        {label}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-2 h-11 w-full rounded-xl border border-[#0B1020]/10 bg-[#FAFAF9] px-3.5 text-sm text-[#0B1020] outline-none transition focus:border-[#14B8A6] focus:bg-white"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#334155]">
        {label}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </span>

      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-2 h-11 w-full rounded-xl border border-[#0B1020]/10 bg-[#FAFAF9] px-3.5 text-sm text-[#0B1020] outline-none transition focus:border-[#14B8A6] focus:bg-white"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#334155]">
        {label}
      </span>

      <div className="relative mt-2">
        <select
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="h-11 w-full appearance-none rounded-xl border border-[#0B1020]/10 bg-[#FAFAF9] px-3.5 pr-10 text-sm font-semibold text-[#334155] outline-none focus:border-[#14B8A6] focus:bg-white"
        >
          {children}
        </select>

        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
      </div>
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#334155]">
        {label}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </span>

      <div className="mt-2 flex w-full min-w-0 rounded-xl border border-[#0B1020]/10 bg-[#FAFAF9] px-3.5 py-2.5 focus-within:border-[#14B8A6] focus-within:bg-white">
        <input
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          className="block w-full min-w-0 border-0 bg-transparent p-0 text-sm text-[#334155] outline-none"
        />
      </div>
    </label>
  );
}

function TableHeading({ children }: { children: ReactNode }) {
  return (
    <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[#64748B]">
      {children}
    </th>
  );
}
function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
        danger
          ? 'text-red-600 hover:bg-red-50'
          : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0B1020]'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
function DetailsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">
        {title}
      </h3>

      <div className="mt-3 space-y-3 rounded-2xl border border-[#0B1020]/[0.07] p-4">
        {children}
      </div>
    </section>
  );
}

function DetailMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#0B1020]/[0.07] bg-[#FAFAF9] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748B]">
        {label}
      </p>

      <p className="mt-2 text-lg font-bold text-[#0B1020]">
        {value}
      </p>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B1020]/[0.05] text-[#475569]">
        <Icon className="h-4 w-4" />
      </div>

      <div>
        <p className="text-xs font-semibold text-[#64748B]">
          {label}
        </p>

        <p className="mt-0.5 text-sm font-bold text-[#334155]">
          {value}
        </p>
      </div>
    </div>
  );
}

function FolderIcon({
  className,
}: {
  className?: string;
}) {
  return (
    <FileSignature className={className} />
  );
}

function generateContractReference(contracts: Contract[]) {
  const year = new Date().getFullYear();

  const numbers = contracts
    .map((contract) => {
      const match = contract.contractRef.match(/(\d+)$/);
      return match ? Number(match[1]) : 0;
    })
    .filter(Number.isFinite);

  const next = Math.max(0, ...numbers) + 1;

  return `SG-CON-${year}-${String(next).padStart(3, '0')}`;
}

function getInitials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'SG'
  );
}

function tidyStatus(status: ContractStatus) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tidyBillingCycle(value: BillingCycle) {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatMoney(
  amount: number,
  currency: Currency,
  compact = false,
) {
  return new Intl.NumberFormat(
    currency === 'NGN' ? 'en-NG' : 'en-GB',
    {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 2,
    },
  ).format(amount);
}

function approximateGbpValue(
  amount: number,
  currency: Currency,
) {
  const rates: Record<Currency, number> = {
    GBP: 1,
    NGN: 0.0005,
    USD: 0.75,
    EUR: 0.87,
  };

  return amount * rates[currency];
}