'use client';

import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  Filter,
  Headphones,
  Inbox,
  LoaderCircle,
  Mail,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';

type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_CLIENT'
  | 'RESOLVED'
  | 'CLOSED';

type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

type SupportMessage = {
  id: string;
  author: string;
  role: 'CLIENT' | 'ADMIN' | 'SYSTEM';
  message: string;
  createdAt: string;
};

type SupportTicket = {
  id: string;
  ticketRef: string;
  title: string;
  description: string;
  client: string;
  clientInitials: string;
  project: string | null;
  contactName: string;
  contactEmail: string;
  priority: TicketPriority;
  status: TicketStatus;
  category: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  messages: SupportMessage[];
};

type TicketForm = {
  title: string;
  description: string;
  client: string;
  project: string;
  contactName: string;
  contactEmail: string;
  priority: TicketPriority;
  category: string;
  assignedTo: string;
};

const teamMembers = [
  'Hassan Ahmad',
  'Finance Team',
  'Technical Support',
  'Development Team',
];

const initialTickets: SupportTicket[] = [
  {
    id: 'ticket-1',
    ticketRef: 'SG-SUP-2026-001',
    title: 'Teacher portal login is not working',
    description:
      'Two teachers are unable to sign in after their temporary passwords were reset.',
    client: 'Esteem Learning Centre',
    clientInitials: 'EL',
    project: 'Esteem Learning Centre Platform',
    contactName: 'School Administrator',
    contactEmail: 'admin@esteemlearningcentre.sch.ng',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    category: 'Authentication',
    assignedTo: 'Technical Support',
    createdAt: '2026-08-01T09:30:00.000Z',
    updatedAt: '2026-08-01T14:20:00.000Z',
    resolvedAt: null,
    messages: [
      {
        id: 'message-1',
        author: 'School Administrator',
        role: 'CLIENT',
        message:
          'Two teachers are receiving an incorrect password message when they try to sign in.',
        createdAt: '2026-08-01T09:30:00.000Z',
      },
      {
        id: 'message-2',
        author: 'Technical Support',
        role: 'ADMIN',
        message:
          'We are checking whether the users completed their first password reset.',
        createdAt: '2026-08-01T10:05:00.000Z',
      },
    ],
  },
  {
    id: 'ticket-2',
    ticketRef: 'SG-SUP-2026-002',
    title: 'Property image upload fails on larger files',
    description:
      'Images larger than approximately 8 MB fail during property listing creation.',
    client: 'RentWise',
    clientInitials: 'RW',
    project: 'RentWise Platform',
    contactName: 'Product Manager',
    contactEmail: 'product@rentwise.example',
    priority: 'URGENT',
    status: 'OPEN',
    category: 'File uploads',
    assignedTo: 'Development Team',
    createdAt: '2026-08-02T00:45:00.000Z',
    updatedAt: '2026-08-02T00:45:00.000Z',
    resolvedAt: null,
    messages: [
      {
        id: 'message-3',
        author: 'Product Manager',
        role: 'CLIENT',
        message:
          'Agents are unable to upload some of their high-resolution listing photographs.',
        createdAt: '2026-08-02T00:45:00.000Z',
      },
    ],
  },
  {
    id: 'ticket-3',
    ticketRef: 'SG-SUP-2026-003',
    title: 'Update project gallery order',
    description:
      'The client would like recently completed projects to appear before older projects.',
    client: 'Meldex Industries',
    clientInitials: 'MI',
    project: 'Meldex Industries Website',
    contactName: 'Operations Director',
    contactEmail: 'operations@meldex.example',
    priority: 'LOW',
    status: 'WAITING_FOR_CLIENT',
    category: 'Content update',
    assignedTo: 'Hassan Ahmad',
    createdAt: '2026-07-30T11:15:00.000Z',
    updatedAt: '2026-08-01T18:40:00.000Z',
    resolvedAt: null,
    messages: [
      {
        id: 'message-4',
        author: 'Operations Director',
        role: 'CLIENT',
        message:
          'Can the completed projects be rearranged so the newest appears first?',
        createdAt: '2026-07-30T11:15:00.000Z',
      },
      {
        id: 'message-5',
        author: 'Hassan Ahmad',
        role: 'ADMIN',
        message:
          'Yes. Please confirm whether the order should be automatic by completion date or manually controlled.',
        createdAt: '2026-08-01T18:40:00.000Z',
      },
    ],
  },
  {
    id: 'ticket-4',
    ticketRef: 'SG-SUP-2026-004',
    title: 'Finance report export completed',
    description:
      'The requested monthly finance export has been generated and delivered.',
    client: 'Esteem Learning Centre',
    clientInitials: 'EL',
    project: 'Esteem Learning Centre Platform',
    contactName: 'Finance Officer',
    contactEmail: 'finance@esteemlearningcentre.sch.ng',
    priority: 'MEDIUM',
    status: 'RESOLVED',
    category: 'Reporting',
    assignedTo: 'Finance Team',
    createdAt: '2026-07-27T08:00:00.000Z',
    updatedAt: '2026-07-28T12:30:00.000Z',
    resolvedAt: '2026-07-28T12:30:00.000Z',
    messages: [
      {
        id: 'message-6',
        author: 'Finance Officer',
        role: 'CLIENT',
        message:
          'Please provide the monthly payment report in spreadsheet format.',
        createdAt: '2026-07-27T08:00:00.000Z',
      },
      {
        id: 'message-7',
        author: 'Finance Team',
        role: 'ADMIN',
        message:
          'The report has been generated and sent to your registered email address.',
        createdAt: '2026-07-28T12:30:00.000Z',
      },
    ],
  },
];

const emptyForm: TicketForm = {
  title: '',
  description: '',
  client: '',
  project: '',
  contactName: '',
  contactEmail: '',
  priority: 'MEDIUM',
  category: 'General',
  assignedTo: '',
};

export default function SupportPage() {
  const [tickets, setTickets] =
    useState<SupportTicket[]>(initialTickets);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | TicketStatus
  >('ALL');
  const [priorityFilter, setPriorityFilter] = useState<
    'ALL' | TicketPriority
  >('ALL');

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] =
    useState<SupportTicket | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(
    null,
  );

  const [form, setForm] = useState<TicketForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const filteredTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesStatus =
        statusFilter === 'ALL' || ticket.status === statusFilter;

      const matchesPriority =
        priorityFilter === 'ALL' ||
        ticket.priority === priorityFilter;

      const matchesSearch =
        !query ||
        ticket.ticketRef.toLowerCase().includes(query) ||
        ticket.title.toLowerCase().includes(query) ||
        ticket.client.toLowerCase().includes(query) ||
        ticket.project?.toLowerCase().includes(query) ||
        ticket.category.toLowerCase().includes(query);

      return matchesStatus && matchesPriority && matchesSearch;
    });
  }, [tickets, searchQuery, statusFilter, priorityFilter]);

  const stats = useMemo(() => {
    return {
      open: tickets.filter((ticket) => ticket.status === 'OPEN').length,
      inProgress: tickets.filter(
        (ticket) => ticket.status === 'IN_PROGRESS',
      ).length,
      urgent: tickets.filter(
        (ticket) =>
          ticket.priority === 'URGENT' &&
          ticket.status !== 'RESOLVED' &&
          ticket.status !== 'CLOSED',
      ).length,
      resolved: tickets.filter(
        (ticket) => ticket.status === 'RESOLVED',
      ).length,
    };
  }, [tickets]);

  function updateForm<Key extends keyof TicketForm>(
    key: Key,
    value: TicketForm[Key],
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

  function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !form.title.trim() ||
      !form.description.trim() ||
      !form.client.trim()
    ) {
      setFormError(
        'Enter the ticket title, description and client.',
      );
      return;
    }

    const now = new Date().toISOString();

    const ticket: SupportTicket = {
      id: crypto.randomUUID(),
      ticketRef: generateTicketReference(tickets),
      title: form.title.trim(),
      description: form.description.trim(),
      client: form.client.trim(),
      clientInitials: getInitials(form.client),
      project: form.project.trim() || null,
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim(),
      priority: form.priority,
      status: form.assignedTo ? 'IN_PROGRESS' : 'OPEN',
      category: form.category,
      assignedTo: form.assignedTo || null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      messages: [
        {
          id: crypto.randomUUID(),
          author: 'Syntra Grid',
          role: 'SYSTEM',
          message: 'Support ticket created.',
          createdAt: now,
        },
      ],
    };

    setTickets((current) => [ticket, ...current]);
    setCreateOpen(false);
    setForm(emptyForm);
    showNotice(`${ticket.ticketRef} was created.`);
  }

  function updateTicket(
    ticketId: string,
    updates: Partial<SupportTicket>,
  ) {
    const updatedAt = new Date().toISOString();

    setTickets((current) =>
      current.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              ...updates,
              updatedAt,
            }
          : ticket,
      ),
    );

    setSelectedTicket((current) =>
      current?.id === ticketId
        ? {
            ...current,
            ...updates,
            updatedAt,
          }
        : current,
    );
  }

  function changeStatus(
    ticket: SupportTicket,
    status: TicketStatus,
  ) {
    updateTicket(ticket.id, {
      status,
      resolvedAt:
        status === 'RESOLVED'
          ? new Date().toISOString()
          : status === 'CLOSED'
            ? ticket.resolvedAt
            : null,
    });

    setActiveMenuId(null);
    showNotice(
      `${ticket.ticketRef} changed to ${tidyStatus(status)}.`,
    );
  }

  function deleteTicket(ticket: SupportTicket) {
    const confirmed = window.confirm(
      `Delete ${ticket.ticketRef}? This prototype action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setTickets((current) =>
      current.filter((item) => item.id !== ticket.id),
    );

    if (selectedTicket?.id === ticket.id) {
      setSelectedTicket(null);
    }

    setActiveMenuId(null);
    showNotice(`${ticket.ticketRef} was deleted.`);
  }

  function addMessage(
    ticketId: string,
    message: string,
    internal: boolean,
  ) {
    const newMessage: SupportMessage = {
      id: crypto.randomUUID(),
      author: internal ? 'Syntra Grid internal note' : 'Hassan Ahmad',
      role: internal ? 'SYSTEM' : 'ADMIN',
      message,
      createdAt: new Date().toISOString(),
    };

    const currentTicket = tickets.find(
      (ticket) => ticket.id === ticketId,
    );

    if (!currentTicket) {
      return;
    }

    updateTicket(ticketId, {
      messages: [...currentTicket.messages, newMessage],
      status:
        currentTicket.status === 'WAITING_FOR_CLIENT' && !internal
          ? 'IN_PROGRESS'
          : currentTicket.status,
    });

    showNotice(
      internal
        ? 'Internal note added.'
        : 'Reply added to the ticket.',
    );
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
            <Headphones className="h-4 w-4" />
            Client operations
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0B1020]">
            Support
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5A6173]">
            Manage client issues, assign support work, track response
            progress and maintain a complete conversation history.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B1020] px-5 text-sm font-bold text-white transition hover:bg-[#151D34]"
        >
          <Plus className="h-4 w-4" />
          New ticket
        </button>
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
          label="Open tickets"
          value={String(stats.open)}
          detail="Waiting to be reviewed"
          icon={Inbox}
          iconClassName="bg-[#1E4E8C]/10 text-[#1E4E8C]"
        />

        <MetricCard
          label="In progress"
          value={String(stats.inProgress)}
          detail="Currently being handled"
          icon={LoaderCircle}
          iconClassName="bg-[#14B8A6]/10 text-[#0D9488]"
        />

        <MetricCard
          label="Urgent"
          value={String(stats.urgent)}
          detail="Require immediate attention"
          icon={ShieldAlert}
          iconClassName="bg-red-50 text-red-700"
        />

        <MetricCard
          label="Resolved"
          value={String(stats.resolved)}
          detail="Successfully completed"
          icon={CheckCircle2}
          iconClassName="bg-[#D4AF37]/12 text-[#A87B1B]"
        />
      </section>

      <section className="overflow-visible rounded-3xl border border-[#0B1020]/[0.07] bg-white shadow-[0_1px_2px_rgba(11,16,32,0.04)]">
        <div className="flex flex-col gap-4 border-b border-[#0B1020]/[0.06] p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0B1020]">
              Support queue
            </h2>

            <p className="mt-1 text-sm text-[#5A6173]">
              {filteredTickets.length} of {tickets.length} tickets
              displayed.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A6173]/60" />

              <input
                type="search"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
                placeholder="Search support tickets"
                className="h-11 w-full rounded-xl border border-[#0B1020]/10 bg-[#FAFAF9] pl-10 pr-4 text-sm text-[#0B1020] outline-none transition focus:border-[#14B8A6] focus:bg-white md:w-64"
              />
            </label>

            <FilterSelect
              value={statusFilter}
              onChange={(value) =>
                setStatusFilter(value as 'ALL' | TicketStatus)
              }
            >
              <option value="ALL">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="WAITING_FOR_CLIENT">
                Waiting for client
              </option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </FilterSelect>

            <FilterSelect
              value={priorityFilter}
              onChange={(value) =>
                setPriorityFilter(value as 'ALL' | TicketPriority)
              }
            >
              <option value="ALL">All priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </FilterSelect>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-[#0B1020]/[0.06] bg-[#FAFAF9] text-left">
                <TableHeading>Ticket</TableHeading>
                <TableHeading>Client</TableHeading>
                <TableHeading>Category</TableHeading>
                <TableHeading>Priority</TableHeading>
                <TableHeading>Assigned to</TableHeading>
                <TableHeading>Updated</TableHeading>
                <TableHeading>Status</TableHeading>

                <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-[0.08em] text-[#64748B]">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredTickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="border-b border-[#0B1020]/[0.06] last:border-0 hover:bg-[#FAFAF9]/70"
                >
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setSelectedTicket(ticket)}
                      className="max-w-72 text-left"
                    >
                      <p className="truncate text-sm font-bold text-[#0B1020] hover:text-[#A87B1B]">
                        {ticket.title}
                      </p>

                      <p className="mt-1 text-xs font-medium text-[#64748B]">
                        {ticket.ticketRef}
                      </p>
                    </button>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B1020]/[0.05] text-xs font-bold text-[#0B1020]">
                        {ticket.clientInitials}
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-[#334155]">
                          {ticket.client}
                        </p>

                        <p className="mt-0.5 max-w-44 truncate text-xs text-[#64748B]">
                          {ticket.project || 'No linked project'}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-[#475569]">
                    {ticket.category}
                  </td>

                  <td className="px-5 py-4">
                    <PriorityBadge priority={ticket.priority} />
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 text-sm text-[#475569]">
                      <UserRound className="h-4 w-4 text-[#94A3B8]" />
                      {ticket.assignedTo || 'Unassigned'}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-[#334155]">
                      {formatRelativeTime(ticket.updatedAt)}
                    </p>

                    <p className="mt-0.5 text-xs text-[#64748B]">
                      Created {formatDate(ticket.createdAt)}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge status={ticket.status} />
                  </td>

                  <td className="relative px-5 py-4 text-right">
                    <button
                      type="button"
                      aria-label={`Open actions for ${ticket.ticketRef}`}
                      onClick={() =>
                        setActiveMenuId((current) =>
                          current === ticket.id ? null : ticket.id,
                        )
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#64748B] transition hover:bg-[#0B1020]/[0.05] hover:text-[#0B1020]"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>

                    {activeMenuId === ticket.id && (
                      <div className="absolute right-5 top-14 z-20 w-56 rounded-2xl border border-[#0B1020]/10 bg-white p-1.5 text-left shadow-[0_18px_45px_rgba(11,16,32,0.16)]">
                        <ActionButton
                          icon={MessageSquareText}
                          label="Open ticket"
                          onClick={() => {
                            setSelectedTicket(ticket);
                            setActiveMenuId(null);
                          }}
                        />

                        {ticket.status === 'OPEN' && (
                          <ActionButton
                            icon={LoaderCircle}
                            label="Start work"
                            onClick={() =>
                              changeStatus(ticket, 'IN_PROGRESS')
                            }
                          />
                        )}

                        {ticket.status !== 'RESOLVED' &&
                          ticket.status !== 'CLOSED' && (
                            <ActionButton
                              icon={CheckCircle2}
                              label="Mark resolved"
                              onClick={() =>
                                changeStatus(ticket, 'RESOLVED')
                              }
                            />
                          )}

                        {ticket.status === 'RESOLVED' && (
                          <ActionButton
                            icon={CircleDot}
                            label="Close ticket"
                            onClick={() =>
                              changeStatus(ticket, 'CLOSED')
                            }
                          />
                        )}

                        <div className="my-1 border-t border-[#0B1020]/[0.06]" />

                        <ActionButton
                          icon={Trash2}
                          label="Delete"
                          danger
                          onClick={() => deleteTicket(ticket)}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {filteredTickets.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <Headphones className="mx-auto h-9 w-9 text-[#94A3B8]" />

                    <p className="mt-3 text-sm font-bold text-[#334155]">
                      No matching support tickets
                    </p>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Change your filters or create a new ticket.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#0B1020]/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#64748B]">
            Showing {filteredTickets.length} support tickets
          </p>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 text-sm font-bold text-[#A87B1B]"
          >
            Create another ticket
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {createOpen && (
        <CreateTicketModal
          form={form}
          error={formError}
          onUpdate={updateForm}
          onClose={() => setCreateOpen(false)}
          onSubmit={createTicket}
        />
      )}

      {selectedTicket && (
        <TicketDrawer
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={(updates) =>
            updateTicket(selectedTicket.id, updates)
          }
          onAddMessage={(message, internal) =>
            addMessage(selectedTicket.id, message, internal)
          }
        />
      )}
    </main>
  );
}

function CreateTicketModal({
  form,
  error,
  onUpdate,
  onClose,
  onSubmit,
}: {
  form: TicketForm;
  error: string;
  onUpdate: <Key extends keyof TicketForm>(
    key: Key,
    value: TicketForm[Key],
  ) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0B1020]/55 p-4 backdrop-blur-sm">
      <div className="mx-auto my-8 max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#0B1020]/[0.07] px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#A87B1B]">
              Client assistance
            </p>

            <h2 className="mt-1 text-xl font-bold text-[#0B1020]">
              Create support ticket
            </h2>

            <p className="mt-1 text-sm text-[#5A6173]">
              Record an issue and assign responsibility to the right
              team member.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#64748B] transition hover:bg-[#0B1020]/[0.05]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="grid gap-5 p-6 md:grid-cols-2">
            <div className="space-y-4 md:col-span-2">
              <TextField
                label="Ticket title"
                value={form.title}
                onChange={(value) => onUpdate('title', value)}
                placeholder="Briefly describe the issue"
                required
              />

              <label className="block">
                <span className="text-sm font-semibold text-[#334155]">
                  Description
                  <span className="ml-1 text-red-500">*</span>
                </span>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    onUpdate('description', event.target.value)
                  }
                  rows={5}
                  required
                  placeholder="Explain what happened, the expected behaviour and any steps already tried..."
                  className="mt-2 w-full resize-none rounded-xl border border-[#0B1020]/10 bg-[#FAFAF9] px-3.5 py-3 text-sm text-[#0B1020] outline-none transition focus:border-[#14B8A6] focus:bg-white"
                />
              </label>
            </div>

            <TextField
              label="Client"
              value={form.client}
              onChange={(value) => onUpdate('client', value)}
              placeholder="Client company"
              required
            />

            <TextField
              label="Linked project"
              value={form.project}
              onChange={(value) => onUpdate('project', value)}
              placeholder="Optional project"
            />

            <TextField
              label="Contact name"
              value={form.contactName}
              onChange={(value) => onUpdate('contactName', value)}
              placeholder="Client contact"
            />

            <TextField
              label="Contact email"
              type="email"
              value={form.contactEmail}
              onChange={(value) => onUpdate('contactEmail', value)}
              placeholder="client@example.com"
            />

            <SelectField
              label="Priority"
              value={form.priority}
              onChange={(value) =>
                onUpdate('priority', value as TicketPriority)
              }
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </SelectField>

            <SelectField
              label="Category"
              value={form.category}
              onChange={(value) => onUpdate('category', value)}
            >
              <option value="General">General</option>
              <option value="Authentication">Authentication</option>
              <option value="Billing">Billing</option>
              <option value="File uploads">File uploads</option>
              <option value="Reporting">Reporting</option>
              <option value="Content update">Content update</option>
              <option value="Performance">Performance</option>
              <option value="Bug">Bug</option>
              <option value="Feature request">
                Feature request
              </option>
            </SelectField>

            <div className="md:col-span-2">
              <SelectField
                label="Assign to"
                value={form.assignedTo}
                onChange={(value) =>
                  onUpdate('assignedTo', value)
                }
              >
                <option value="">Leave unassigned</option>

                {teamMembers.map((member) => (
                  <option key={member} value={member}>
                    {member}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>

          <div className="border-t border-[#0B1020]/[0.07] bg-[#FAFAF9] px-6 py-4">
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3">
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
                <Headphones className="h-4 w-4" />
                Create ticket
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function TicketDrawer({
  ticket,
  onClose,
  onUpdate,
  onAddMessage,
}: {
  ticket: SupportTicket;
  onClose: () => void;
  onUpdate: (updates: Partial<SupportTicket>) => void;
  onAddMessage: (message: string, internal: boolean) => void;
}) {
  const [reply, setReply] = useState('');
  const [internalNote, setInternalNote] = useState(false);

  function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = reply.trim();

    if (!message) {
      return;
    }

    onAddMessage(message, internalNote);
    setReply('');
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#0B1020]/45 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close ticket details"
        onClick={onClose}
        className="absolute inset-0"
      />

      <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-[#0B1020]/[0.07] px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#A87B1B]">
              {ticket.ticketRef}
            </p>

            <h2 className="mt-1 truncate text-xl font-bold text-[#0B1020]">
              {ticket.title}
            </h2>

            <p className="mt-1 text-sm text-[#5A6173]">
              {ticket.client} · created {formatDate(ticket.createdAt)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#64748B] hover:bg-[#0B1020]/[0.05]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-6">
            <section className="grid gap-3 sm:grid-cols-3">
              <SelectField
                label="Status"
                value={ticket.status}
                onChange={(value) =>
                  onUpdate({
                    status: value as TicketStatus,
                    resolvedAt:
                      value === 'RESOLVED'
                        ? new Date().toISOString()
                        : null,
                  })
                }
              >
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="WAITING_FOR_CLIENT">
                  Waiting for client
                </option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </SelectField>

              <SelectField
                label="Priority"
                value={ticket.priority}
                onChange={(value) =>
                  onUpdate({
                    priority: value as TicketPriority,
                  })
                }
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </SelectField>

              <SelectField
                label="Assigned to"
                value={ticket.assignedTo ?? ''}
                onChange={(value) =>
                  onUpdate({
                    assignedTo: value || null,
                  })
                }
              >
                <option value="">Unassigned</option>

                {teamMembers.map((member) => (
                  <option key={member} value={member}>
                    {member}
                  </option>
                ))}
              </SelectField>
            </section>

            <section className="rounded-2xl border border-[#0B1020]/[0.07] bg-[#FAFAF9] p-5">
              <h3 className="text-sm font-bold text-[#0B1020]">
                Issue description
              </h3>

              <p className="mt-3 text-sm leading-6 text-[#5A6173]">
                {ticket.description}
              </p>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <InfoCard
                icon={Building2}
                label="Client"
                value={ticket.client}
              />

              <InfoCard
                icon={UserRound}
                label="Contact"
                value={ticket.contactName || 'Not provided'}
              />

              <InfoCard
                icon={Mail}
                label="Email"
                value={ticket.contactEmail || 'Not provided'}
              />

              <InfoCard
                icon={Users}
                label="Project"
                value={ticket.project || 'Not linked'}
              />
            </section>

            <section>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#0B1020]">
                    Conversation
                  </h3>

                  <p className="mt-1 text-xs text-[#64748B]">
                    Complete ticket history and internal activity.
                  </p>
                </div>

                <span className="rounded-full bg-[#0B1020]/[0.05] px-2.5 py-1 text-xs font-bold text-[#64748B]">
                  {ticket.messages.length} messages
                </span>
              </div>

              <div className="mt-4 space-y-4">
                {ticket.messages.map((message) => (
                  <ConversationMessage
                    key={message.id}
                    message={message}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>

        <form
          onSubmit={submitReply}
          className="border-t border-[#0B1020]/[0.07] bg-white p-5"
        >
          <div
            className={`rounded-2xl border p-3 transition ${
              internalNote
                ? 'border-[#D4AF37]/35 bg-[#FFFDF7]'
                : 'border-[#0B1020]/10 bg-[#FAFAF9]'
            }`}
          >
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              rows={3}
              placeholder={
                internalNote
                  ? 'Add an internal note for the Syntra Grid team...'
                  : 'Write a reply to the client...'
              }
              className="w-full resize-none bg-transparent text-sm text-[#0B1020] outline-none placeholder:text-[#94A3B8]"
            />

            <div className="mt-3 flex flex-col gap-3 border-t border-[#0B1020]/[0.06] pt-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#64748B]">
                <input
                  type="checkbox"
                  checked={internalNote}
                  onChange={(event) =>
                    setInternalNote(event.target.checked)
                  }
                  className="h-4 w-4 rounded border-[#CBD5E1]"
                />
                Internal note only
              </label>

              <button
                type="submit"
                disabled={!reply.trim()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0B1020] px-4 text-xs font-bold text-white transition hover:bg-[#151D34] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {internalNote ? 'Add note' : 'Send reply'}
              </button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}

function ConversationMessage({
  message,
}: {
  message: SupportMessage;
}) {
  const internal = message.role === 'SYSTEM';
  const admin = message.role === 'ADMIN';

  return (
    <article
      className={`rounded-2xl border p-4 ${
        internal
          ? 'border-[#D4AF37]/25 bg-[#FFFDF7]'
          : admin
            ? 'border-[#14B8A6]/20 bg-[#14B8A6]/[0.05]'
            : 'border-[#0B1020]/[0.07] bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl ${
              internal
                ? 'bg-[#D4AF37]/15 text-[#A87B1B]'
                : admin
                  ? 'bg-[#14B8A6]/10 text-[#0D9488]'
                  : 'bg-[#0B1020]/[0.05] text-[#475569]'
            }`}
          >
            {internal ? (
              <AlertCircle className="h-4 w-4" />
            ) : admin ? (
              <Headphones className="h-4 w-4" />
            ) : (
              <UserRound className="h-4 w-4" />
            )}
          </div>

          <div>
            <p className="text-sm font-bold text-[#334155]">
              {message.author}
            </p>

            <p className="text-xs text-[#94A3B8]">
              {message.role === 'CLIENT'
                ? 'Client'
                : message.role === 'ADMIN'
                  ? 'Syntra Grid'
                  : 'Internal activity'}
            </p>
          </div>
        </div>

        <time className="text-xs text-[#94A3B8]">
          {formatRelativeTime(message.createdAt)}
        </time>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#5A6173]">
        {message.message}
      </p>
    </article>
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
  icon: typeof Headphones;
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

      <p className="mt-2 text-xs text-[#94A3B8]">{detail}</p>
    </article>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const styles: Record<TicketStatus, string> = {
    OPEN: 'bg-blue-50 text-blue-700',
    IN_PROGRESS: 'bg-[#14B8A6]/10 text-[#0D9488]',
    WAITING_FOR_CLIENT: 'bg-amber-50 text-amber-700',
    RESOLVED: 'bg-emerald-50 text-emerald-700',
    CLOSED: 'bg-slate-100 text-slate-600',
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

function PriorityBadge({
  priority,
}: {
  priority: TicketPriority;
}) {
  const styles: Record<TicketPriority, string> = {
    LOW: 'bg-slate-100 text-slate-600',
    MEDIUM: 'bg-blue-50 text-blue-700',
    HIGH: 'bg-amber-50 text-amber-700',
    URGENT: 'bg-red-50 text-red-700',
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${styles[priority]}`}
    >
      {tidyStatus(priority)}
    </span>
  );
}

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="relative">
      <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A6173]/60" />

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-[#0B1020]/10 bg-white pl-10 pr-10 text-sm font-semibold text-[#334155] outline-none focus:border-[#14B8A6] md:w-48"
      >
        {children}
      </select>

      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
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
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-xl border border-[#0B1020]/10 bg-[#FAFAF9] px-3.5 pr-10 text-sm font-semibold text-[#334155] outline-none focus:border-[#14B8A6] focus:bg-white"
        >
          {children}
        </select>

        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
      </div>
    </label>
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
        {required && <span className="ml-1 text-red-500">*</span>}
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

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#0B1020]/[0.07] bg-[#FAFAF9] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B1020]/[0.05] text-[#475569]">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#64748B]">
            {label}
          </p>

          <p className="mt-1 break-words text-sm font-bold text-[#334155]">
            {value}
          </p>
        </div>
      </div>
    </div>
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
  icon: typeof MessageSquareText;
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

function generateTicketReference(tickets: SupportTicket[]) {
  const year = new Date().getFullYear();

  const numbers = tickets
    .map((ticket) => {
      const match = ticket.ticketRef.match(/(\d+)$/);
      return match ? Number(match[1]) : 0;
    })
    .filter(Number.isFinite);

  const next = Math.max(0, ...numbers) + 1;

  return `SG-SUP-${year}-${String(next).padStart(3, '0')}`;
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

function tidyStatus(value: string) {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return 'Unknown';
  }

  const minutes = Math.max(
    0,
    Math.round((Date.now() - timestamp) / 60_000),
  );

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  if (minutes < 10080) {
    return `${Math.round(minutes / 1440)}d ago`;
  }

  return formatDate(value);
}