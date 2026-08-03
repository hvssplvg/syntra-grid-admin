'use client';

import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Archive,
  ArrowLeft,
  Building2,
  Check,
  CheckCheck,
  ChevronDown,
  Circle,
  Clock3,
  FileText,
  Filter,
  Headphones,
  Inbox,
  Mail,
  MailOpen,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Smile,
  Star,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';

type ConversationStatus = 'OPEN' | 'WAITING' | 'RESOLVED' | 'ARCHIVED';

type MessageType = 'CLIENT' | 'ADMIN' | 'INTERNAL' | 'SYSTEM';

type ConversationMessage = {
  id: string;
  sender: string;
  senderRole: string;
  type: MessageType;
  body: string;
  createdAt: string;
  read: boolean;
  attachment?: {
    name: string;
    size: string;
  } | null;
};

type Conversation = {
  id: string;
  client: string;
  clientInitials: string;
  contactName: string;
  contactEmail: string;
  project: string | null;
  subject: string;
  preview: string;
  status: ConversationStatus;
  assignedTo: string | null;
  priority: 'NORMAL' | 'HIGH';
  unreadCount: number;
  starred: boolean;
  updatedAt: string;
  messages: ConversationMessage[];
};

type ComposeForm = {
  client: string;
  contactName: string;
  contactEmail: string;
  project: string;
  subject: string;
  message: string;
};

const teamMembers = [
  'Hassan Ahmad',
  'Technical Support',
  'Finance Team',
  'Development Team',
];

const initialConversations: Conversation[] = [
  {
    id: 'conversation-1',
    client: 'Esteem Learning Centre',
    clientInitials: 'EL',
    contactName: 'School Administrator',
    contactEmail: 'admin@esteemlearningcentre.sch.ng',
    project: 'Esteem Learning Centre Platform',
    subject: 'Teacher portal account confirmation',
    preview:
      'Yes, all the subjects and assigned classes are correct. Thank you.',
    status: 'OPEN',
    assignedTo: 'Hassan Ahmad',
    priority: 'NORMAL',
    unreadCount: 2,
    starred: true,
    updatedAt: '2026-08-02T02:58:00.000Z',
    messages: [
      {
        id: 'message-1',
        sender: 'Hassan Ahmad',
        senderRole: 'Syntra Grid',
        type: 'ADMIN',
        body:
          'Good evening. We have configured the teacher account. Please confirm that the assigned subjects and classes are correct.',
        createdAt: '2026-08-01T18:10:00.000Z',
        read: true,
      },
      {
        id: 'message-2',
        sender: 'School Administrator',
        senderRole: 'Esteem Learning Centre',
        type: 'CLIENT',
        body:
          'Thank you. I have checked the account and all the assigned subjects and classes are correct.',
        createdAt: '2026-08-02T02:47:00.000Z',
        read: false,
      },
      {
        id: 'message-3',
        sender: 'School Administrator',
        senderRole: 'Esteem Learning Centre',
        type: 'CLIENT',
        body:
          'Please let us know when the mobile application is available for the teachers and students.',
        createdAt: '2026-08-02T02:58:00.000Z',
        read: false,
      },
    ],
  },
  {
    id: 'conversation-2',
    client: 'RentWise',
    clientInitials: 'RW',
    contactName: 'Product Manager',
    contactEmail: 'product@rentwise.example',
    project: 'RentWise Platform',
    subject: 'Property image upload issue',
    preview:
      'The issue appears to happen when the image is larger than 8 MB.',
    status: 'OPEN',
    assignedTo: 'Technical Support',
    priority: 'HIGH',
    unreadCount: 1,
    starred: false,
    updatedAt: '2026-08-02T01:36:00.000Z',
    messages: [
      {
        id: 'message-4',
        sender: 'Product Manager',
        senderRole: 'RentWise',
        type: 'CLIENT',
        body:
          'Some agents are unable to upload high-resolution property images. The issue appears to happen when the image is larger than 8 MB.',
        createdAt: '2026-08-02T01:36:00.000Z',
        read: false,
      },
    ],
  },
  {
    id: 'conversation-3',
    client: 'Meldex Industries',
    clientInitials: 'MI',
    contactName: 'Operations Director',
    contactEmail: 'operations@meldex.example',
    project: 'Meldex Industries Website',
    subject: 'Website project gallery',
    preview:
      'Can completed projects automatically appear before older projects?',
    status: 'WAITING',
    assignedTo: 'Development Team',
    priority: 'NORMAL',
    unreadCount: 0,
    starred: false,
    updatedAt: '2026-08-01T19:14:00.000Z',
    messages: [
      {
        id: 'message-5',
        sender: 'Operations Director',
        senderRole: 'Meldex Industries',
        type: 'CLIENT',
        body:
          'Can completed projects automatically appear before older projects in the gallery?',
        createdAt: '2026-08-01T17:55:00.000Z',
        read: true,
      },
      {
        id: 'message-6',
        sender: 'Hassan Ahmad',
        senderRole: 'Syntra Grid',
        type: 'ADMIN',
        body:
          'Yes. We can order them automatically by completion date, or allow your team to control the order manually from the admin dashboard. Which option would you prefer?',
        createdAt: '2026-08-01T19:14:00.000Z',
        read: true,
      },
    ],
  },
  {
    id: 'conversation-4',
    client: 'Esteem Learning Centre',
    clientInitials: 'EL',
    contactName: 'Finance Officer',
    contactEmail: 'finance@esteemlearningcentre.sch.ng',
    project: 'Esteem Learning Centre Platform',
    subject: 'Monthly finance report',
    preview: 'The requested spreadsheet has been delivered successfully.',
    status: 'RESOLVED',
    assignedTo: 'Finance Team',
    priority: 'NORMAL',
    unreadCount: 0,
    starred: false,
    updatedAt: '2026-07-30T12:42:00.000Z',
    messages: [
      {
        id: 'message-7',
        sender: 'Finance Officer',
        senderRole: 'Esteem Learning Centre',
        type: 'CLIENT',
        body:
          'Please provide the monthly payment report in spreadsheet format.',
        createdAt: '2026-07-30T09:20:00.000Z',
        read: true,
      },
      {
        id: 'message-8',
        sender: 'Finance Team',
        senderRole: 'Syntra Grid',
        type: 'ADMIN',
        body:
          'The requested spreadsheet has been generated and delivered successfully.',
        createdAt: '2026-07-30T12:42:00.000Z',
        read: true,
        attachment: {
          name: 'esteem-finance-report-july.xlsx',
          size: '482 KB',
        },
      },
    ],
  },
];

const emptyComposeForm: ComposeForm = {
  client: '',
  contactName: '',
  contactEmail: '',
  project: '',
  subject: '',
  message: '',
};

export default function MessagesPage() {
  const [conversations, setConversations] =
    useState<Conversation[]>(initialConversations);

  const [selectedId, setSelectedId] = useState(
    initialConversations[0]?.id ?? '',
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [viewFilter, setViewFilter] = useState<
    'ALL' | 'UNREAD' | 'STARRED' | ConversationStatus
  >('ALL');

  const [reply, setReply] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeForm, setComposeForm] =
    useState<ComposeForm>(emptyComposeForm);
  const [composeError, setComposeError] = useState('');
  const [mobileConversationOpen, setMobileConversationOpen] =
    useState(false);

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return conversations
      .filter((conversation) => {
        const matchesSearch =
          !query ||
          conversation.client.toLowerCase().includes(query) ||
          conversation.contactName.toLowerCase().includes(query) ||
          conversation.subject.toLowerCase().includes(query) ||
          conversation.preview.toLowerCase().includes(query) ||
          conversation.project?.toLowerCase().includes(query);

        const matchesFilter =
          viewFilter === 'ALL' ||
          (viewFilter === 'UNREAD' && conversation.unreadCount > 0) ||
          (viewFilter === 'STARRED' && conversation.starred) ||
          conversation.status === viewFilter;

        return matchesSearch && matchesFilter;
      })
      .sort(
        (first, second) =>
          new Date(second.updatedAt).getTime() -
          new Date(first.updatedAt).getTime(),
      );
  }, [conversations, searchQuery, viewFilter]);

  const selectedConversation =
    conversations.find(
      (conversation) => conversation.id === selectedId,
    ) ?? filteredConversations[0] ?? null;

  const summary = useMemo(() => {
    return {
      unread: conversations.reduce(
        (total, conversation) => total + conversation.unreadCount,
        0,
      ),
      open: conversations.filter(
        (conversation) => conversation.status === 'OPEN',
      ).length,
      waiting: conversations.filter(
        (conversation) => conversation.status === 'WAITING',
      ).length,
      resolved: conversations.filter(
        (conversation) => conversation.status === 'RESOLVED',
      ).length,
    };
  }, [conversations]);

  function selectConversation(conversation: Conversation) {
    setSelectedId(conversation.id);
    setMobileConversationOpen(true);

    if (conversation.unreadCount > 0) {
      setConversations((current) =>
        current.map((item) =>
          item.id === conversation.id
            ? {
                ...item,
                unreadCount: 0,
                messages: item.messages.map((message) => ({
                  ...message,
                  read: true,
                })),
              }
            : item,
        ),
      );
    }
  }

  function updateConversation(
    conversationId: string,
    updates: Partial<Conversation>,
  ) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : conversation,
      ),
    );
  }

  function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = reply.trim();

    if (!body || !selectedConversation) {
      return;
    }

    const message: ConversationMessage = {
      id: crypto.randomUUID(),
      sender: internalNote
        ? 'Syntra Grid internal note'
        : 'Hassan Ahmad',
      senderRole: internalNote ? 'Internal' : 'Syntra Grid',
      type: internalNote ? 'INTERNAL' : 'ADMIN',
      body,
      createdAt: new Date().toISOString(),
      read: true,
    };

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === selectedConversation.id
          ? {
              ...conversation,
              messages: [...conversation.messages, message],
              preview: body,
              unreadCount: 0,
              updatedAt: message.createdAt,
              status:
                !internalNote &&
                conversation.status === 'WAITING'
                  ? 'OPEN'
                  : conversation.status,
            }
          : conversation,
      ),
    );

    setReply('');
  }

  function toggleStar(conversationId: string) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              starred: !conversation.starred,
            }
          : conversation,
      ),
    );
  }

  function archiveConversation(conversation: Conversation) {
    updateConversation(conversation.id, {
      status: 'ARCHIVED',
    });
  }

  function deleteConversation(conversation: Conversation) {
    const confirmed = window.confirm(
      `Delete the conversation with ${conversation.client}?`,
    );

    if (!confirmed) {
      return;
    }

    setConversations((current) =>
      current.filter((item) => item.id !== conversation.id),
    );

    const nextConversation = conversations.find(
      (item) => item.id !== conversation.id,
    );

    setSelectedId(nextConversation?.id ?? '');
    setMobileConversationOpen(false);
  }

  function createConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !composeForm.client.trim() ||
      !composeForm.contactEmail.trim() ||
      !composeForm.subject.trim() ||
      !composeForm.message.trim()
    ) {
      setComposeError(
        'Enter the client, email address, subject and message.',
      );
      return;
    }

    const createdAt = new Date().toISOString();

    const conversation: Conversation = {
      id: crypto.randomUUID(),
      client: composeForm.client.trim(),
      clientInitials: getInitials(composeForm.client),
      contactName:
        composeForm.contactName.trim() ||
        composeForm.client.trim(),
      contactEmail: composeForm.contactEmail.trim(),
      project: composeForm.project.trim() || null,
      subject: composeForm.subject.trim(),
      preview: composeForm.message.trim(),
      status: 'OPEN',
      assignedTo: 'Hassan Ahmad',
      priority: 'NORMAL',
      unreadCount: 0,
      starred: false,
      updatedAt: createdAt,
      messages: [
        {
          id: crypto.randomUUID(),
          sender: 'Hassan Ahmad',
          senderRole: 'Syntra Grid',
          type: 'ADMIN',
          body: composeForm.message.trim(),
          createdAt,
          read: true,
        },
      ],
    };

    setConversations((current) => [conversation, ...current]);
    setSelectedId(conversation.id);
    setComposeForm(emptyComposeForm);
    setComposeError('');
    setComposeOpen(false);
    setMobileConversationOpen(true);
  }

  return (
    <main className="space-y-6 pb-10">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#A87B1B]">
            <MessageSquareText className="h-4 w-4" />
            Client communication
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0B1020]">
            Messages
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5A6173]">
            Communicate with clients, coordinate internal responses
            and maintain a complete record of every conversation.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setComposeOpen(true)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0B1020] px-5 text-sm font-bold text-white transition hover:bg-[#151D34]"
        >
          <Plus className="h-4 w-4" />
          New message
        </button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Unread messages"
          value={summary.unread}
          icon={Mail}
          iconClasses="bg-blue-50 text-blue-700"
        />

        <SummaryCard
          label="Open conversations"
          value={summary.open}
          icon={Inbox}
          iconClasses="bg-[#14B8A6]/10 text-[#0D9488]"
        />

        <SummaryCard
          label="Waiting for client"
          value={summary.waiting}
          icon={Clock3}
          iconClasses="bg-amber-50 text-amber-700"
        />

        <SummaryCard
          label="Resolved"
          value={summary.resolved}
          icon={CheckCheck}
          iconClasses="bg-[#D4AF37]/15 text-[#A87B1B]"
        />
      </section>

      <section className="overflow-hidden rounded-3xl border border-[#0B1020]/[0.07] bg-white shadow-[0_1px_2px_rgba(11,16,32,0.04)]">
        <div className="grid min-h-[720px] lg:grid-cols-[360px_minmax(0,1fr)_300px]">
          <aside
            className={`border-r border-[#0B1020]/[0.07] ${
              mobileConversationOpen ? 'hidden lg:block' : 'block'
            }`}
          >
            <div className="border-b border-[#0B1020]/[0.07] p-4">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />

                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) =>
                    setSearchQuery(event.target.value)
                  }
                  placeholder="Search messages"
                  className="h-11 w-full rounded-xl border border-[#0B1020]/10 bg-[#FAFAF9] pl-10 pr-4 text-sm text-[#0B1020] outline-none transition focus:border-[#14B8A6] focus:bg-white"
                />
              </label>

              <div className="relative mt-3">
                <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />

                <select
                  value={viewFilter}
                  onChange={(event) =>
                    setViewFilter(
                      event.target.value as
                        | 'ALL'
                        | 'UNREAD'
                        | 'STARRED'
                        | ConversationStatus,
                    )
                  }
                  className="h-10 w-full appearance-none rounded-xl border border-[#0B1020]/10 bg-white pl-10 pr-10 text-sm font-semibold text-[#475569] outline-none focus:border-[#14B8A6]"
                >
                  <option value="ALL">All conversations</option>
                  <option value="UNREAD">Unread</option>
                  <option value="STARRED">Starred</option>
                  <option value="OPEN">Open</option>
                  <option value="WAITING">Waiting for client</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="ARCHIVED">Archived</option>
                </select>

                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              </div>
            </div>

            <div className="divide-y divide-[#0B1020]/[0.06]">
              {filteredConversations.map((conversation) => {
                const selected =
                  selectedConversation?.id === conversation.id;

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => selectConversation(conversation)}
                    className={`block w-full p-4 text-left transition ${
                      selected
                        ? 'bg-[#FFF8E1]'
                        : 'hover:bg-[#FAFAF9]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0B1020]/[0.05] text-xs font-bold text-[#0B1020]">
                        {conversation.clientInitials}

                        {conversation.unreadCount > 0 && (
                          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0B1020] px-1 text-[9px] font-bold text-white">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`truncate text-sm ${
                              conversation.unreadCount > 0
                                ? 'font-bold text-[#0B1020]'
                                : 'font-semibold text-[#334155]'
                            }`}
                          >
                            {conversation.client}
                          </p>

                          <span className="shrink-0 text-[10px] font-medium text-[#94A3B8]">
                            {formatConversationTime(
                              conversation.updatedAt,
                            )}
                          </span>
                        </div>

                        <p
                          className={`mt-1 truncate text-xs ${
                            conversation.unreadCount > 0
                              ? 'font-bold text-[#334155]'
                              : 'font-medium text-[#64748B]'
                          }`}
                        >
                          {conversation.subject}
                        </p>

                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#64748B]">
                          {conversation.preview}
                        </p>

                        <div className="mt-2 flex items-center gap-2">
                          <ConversationStatusBadge
                            status={conversation.status}
                          />

                          {conversation.priority === 'HIGH' && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-700">
                              High priority
                            </span>
                          )}

                          {conversation.starred && (
                            <Star className="h-3.5 w-3.5 fill-[#D4AF37] text-[#D4AF37]" />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {filteredConversations.length === 0 && (
                <div className="px-5 py-16 text-center">
                  <MailOpen className="mx-auto h-8 w-8 text-[#94A3B8]" />

                  <p className="mt-3 text-sm font-bold text-[#334155]">
                    No conversations found
                  </p>

                  <p className="mt-1 text-xs text-[#64748B]">
                    Change the filter or start a new message.
                  </p>
                </div>
              )}
            </div>
          </aside>

          <section
            className={`min-w-0 ${
              mobileConversationOpen ? 'flex' : 'hidden lg:flex'
            } flex-col`}
          >
            {selectedConversation ? (
              <>
                <ConversationHeader
                  conversation={selectedConversation}
                  onBack={() => setMobileConversationOpen(false)}
                  onToggleStar={() =>
                    toggleStar(selectedConversation.id)
                  }
                  onArchive={() =>
                    archiveConversation(selectedConversation)
                  }
                  onDelete={() =>
                    deleteConversation(selectedConversation)
                  }
                />

                <div className="flex-1 overflow-y-auto bg-[#FAFAF9]/60 px-4 py-6 sm:px-6">
                  <div className="mx-auto max-w-3xl space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-[#0B1020]/[0.07]" />

                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
                        Conversation started
                      </span>

                      <div className="h-px flex-1 bg-[#0B1020]/[0.07]" />
                    </div>

                    {selectedConversation.messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                      />
                    ))}
                  </div>
                </div>

                <form
                  onSubmit={sendReply}
                  className="border-t border-[#0B1020]/[0.07] bg-white p-4 sm:p-5"
                >
                  <div
                    className={`mx-auto max-w-3xl rounded-2xl border p-3 transition ${
                      internalNote
                        ? 'border-[#D4AF37]/35 bg-[#FFFDF7]'
                        : 'border-[#0B1020]/10 bg-[#FAFAF9]'
                    }`}
                  >
                    <textarea
                      value={reply}
                      onChange={(event) =>
                        setReply(event.target.value)
                      }
                      rows={3}
                      placeholder={
                        internalNote
                          ? 'Add an internal note for the Syntra Grid team...'
                          : `Reply to ${selectedConversation.contactName}...`
                      }
                      className="w-full resize-none bg-transparent text-sm leading-6 text-[#0B1020] outline-none placeholder:text-[#94A3B8]"
                    />

                    <div className="mt-3 flex flex-col gap-3 border-t border-[#0B1020]/[0.06] pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-1">
                        <ComposerButton
                          icon={Paperclip}
                          label="Attach file"
                        />

                        <ComposerButton
                          icon={FileText}
                          label="Insert document"
                        />

                        <ComposerButton
                          icon={Smile}
                          label="Add emoji"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#64748B]">
                          <input
                            type="checkbox"
                            checked={internalNote}
                            onChange={(event) =>
                              setInternalNote(
                                event.target.checked,
                              )
                            }
                            className="h-4 w-4 rounded border-[#CBD5E1]"
                          />
                          Internal note
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
                  </div>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <MessageSquareText className="h-10 w-10 text-[#94A3B8]" />

                <h2 className="mt-4 text-lg font-bold text-[#0B1020]">
                  Select a conversation
                </h2>

                <p className="mt-2 max-w-sm text-sm leading-6 text-[#64748B]">
                  Select a client conversation or start a new
                  message.
                </p>
              </div>
            )}
          </section>

          <aside className="hidden border-l border-[#0B1020]/[0.07] xl:block">
            {selectedConversation && (
              <ConversationDetails
                conversation={selectedConversation}
                onUpdate={(updates) =>
                  updateConversation(
                    selectedConversation.id,
                    updates,
                  )
                }
              />
            )}
          </aside>
        </div>
      </section>

      {composeOpen && (
        <ComposeModal
          form={composeForm}
          error={composeError}
          onUpdate={(key, value) =>
            setComposeForm((current) => ({
              ...current,
              [key]: value,
            }))
          }
          onClose={() => {
            setComposeOpen(false);
            setComposeError('');
          }}
          onSubmit={createConversation}
        />
      )}
    </main>
  );
}

function ConversationHeader({
  conversation,
  onBack,
  onToggleStar,
  onArchive,
  onDelete,
}: {
  conversation: Conversation;
  onBack: () => void;
  onToggleStar: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex items-start justify-between gap-4 border-b border-[#0B1020]/[0.07] bg-white px-4 py-4 sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          aria-label="Return to conversations"
          onClick={onBack}
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#64748B] hover:bg-[#0B1020]/[0.05] lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B1020]/[0.05] text-xs font-bold text-[#0B1020]">
          {conversation.clientInitials}
        </div>

        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-[#0B1020] sm:text-base">
            {conversation.subject}
          </h2>

          <p className="mt-1 truncate text-xs text-[#64748B]">
            {conversation.contactName} · {conversation.client}
          </p>
        </div>
      </div>

      <div className="relative flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label="Star conversation"
          onClick={onToggleStar}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#64748B] transition hover:bg-[#FFF8E1] hover:text-[#A87B1B]"
        >
          <Star
            className={`h-4 w-4 ${
              conversation.starred
                ? 'fill-[#D4AF37] text-[#D4AF37]'
                : ''
            }`}
          />
        </button>

        <button
          type="button"
          aria-label="Conversation options"
          onClick={() => setMenuOpen((current) => !current)}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#64748B] hover:bg-[#0B1020]/[0.05]"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-11 z-30 w-48 rounded-2xl border border-[#0B1020]/10 bg-white p-1.5 shadow-[0_18px_45px_rgba(11,16,32,0.16)]">
            <MenuAction
              icon={Archive}
              label="Archive conversation"
              onClick={() => {
                onArchive();
                setMenuOpen(false);
              }}
            />

            <MenuAction
              icon={Trash2}
              label="Delete conversation"
              danger
              onClick={() => {
                onDelete();
                setMenuOpen(false);
              }}
            />
          </div>
        )}
      </div>
    </header>
  );
}

function MessageBubble({
  message,
}: {
  message: ConversationMessage;
}) {
  const outgoing = message.type === 'ADMIN';
  const internal = message.type === 'INTERNAL';
  const system = message.type === 'SYSTEM';

  if (system) {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-[#0B1020]/[0.05] px-3 py-1.5 text-[10px] font-semibold text-[#64748B]">
          {message.body}
        </span>
      </div>
    );
  }

  return (
    <article
      className={`flex ${
        outgoing ? 'justify-end' : 'justify-start'
      }`}
    >
      <div className="max-w-[85%] sm:max-w-[72%]">
        <div
          className={`rounded-2xl px-4 py-3 ${
            internal
              ? 'border border-[#D4AF37]/30 bg-[#FFFDF7]'
              : outgoing
                ? 'rounded-br-md bg-[#0B1020] text-white'
                : 'rounded-bl-md border border-[#0B1020]/[0.07] bg-white text-[#334155]'
          }`}
        >
          <div className="mb-2 flex items-center justify-between gap-5">
            <p
              className={`text-xs font-bold ${
                outgoing
                  ? 'text-white'
                  : internal
                    ? 'text-[#A87B1B]'
                    : 'text-[#334155]'
              }`}
            >
              {message.sender}
            </p>

            {internal && (
              <span className="rounded-full bg-[#D4AF37]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#A87B1B]">
                Internal
              </span>
            )}
          </div>

          <p
            className={`whitespace-pre-wrap text-sm leading-6 ${
              outgoing ? 'text-white/90' : 'text-[#5A6173]'
            }`}
          >
            {message.body}
          </p>

          {message.attachment && (
            <div
              className={`mt-3 flex items-center gap-3 rounded-xl border p-3 ${
                outgoing
                  ? 'border-white/15 bg-white/10'
                  : 'border-[#0B1020]/[0.07] bg-[#FAFAF9]'
              }`}
            >
              <FileText className="h-5 w-5 shrink-0" />

              <div className="min-w-0">
                <p className="truncate text-xs font-bold">
                  {message.attachment.name}
                </p>

                <p
                  className={`mt-0.5 text-[10px] ${
                    outgoing ? 'text-white/55' : 'text-[#94A3B8]'
                  }`}
                >
                  {message.attachment.size}
                </p>
              </div>
            </div>
          )}
        </div>

        <div
          className={`mt-1.5 flex items-center gap-1.5 text-[10px] text-[#94A3B8] ${
            outgoing ? 'justify-end' : 'justify-start'
          }`}
        >
          <span>{formatMessageTime(message.createdAt)}</span>

          {outgoing && (
            message.read ? (
              <CheckCheck className="h-3.5 w-3.5 text-[#0D9488]" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )
          )}
        </div>
      </div>
    </article>
  );
}

function ConversationDetails({
  conversation,
  onUpdate,
}: {
  conversation: Conversation;
  onUpdate: (updates: Partial<Conversation>) => void;
}) {
  return (
    <div className="space-y-6 p-5">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#0B1020]/[0.05] text-lg font-bold text-[#0B1020]">
          {conversation.clientInitials}
        </div>

        <h3 className="mt-4 text-sm font-bold text-[#0B1020]">
          {conversation.contactName}
        </h3>

        <p className="mt-1 text-xs text-[#64748B]">
          {conversation.client}
        </p>

        <a
          href={`mailto:${conversation.contactEmail}`}
          className="mt-1 block truncate text-xs font-semibold text-[#0D9488]"
        >
          {conversation.contactEmail}
        </a>
      </div>

      <div className="space-y-4 border-t border-[#0B1020]/[0.07] pt-5">
        <DetailRow
          icon={Building2}
          label="Client"
          value={conversation.client}
        />

        <DetailRow
          icon={FileText}
          label="Project"
          value={conversation.project || 'Not linked'}
        />

        <DetailRow
          icon={Clock3}
          label="Last activity"
          value={formatConversationTime(
            conversation.updatedAt,
          )}
        />
      </div>

      <div className="space-y-4 border-t border-[#0B1020]/[0.07] pt-5">
        <SelectField
          label="Conversation status"
          value={conversation.status}
          onChange={(value) =>
            onUpdate({
              status: value as ConversationStatus,
            })
          }
        >
          <option value="OPEN">Open</option>
          <option value="WAITING">Waiting for client</option>
          <option value="RESOLVED">Resolved</option>
          <option value="ARCHIVED">Archived</option>
        </SelectField>

        <SelectField
          label="Assigned to"
          value={conversation.assignedTo ?? ''}
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

        <SelectField
          label="Priority"
          value={conversation.priority}
          onChange={(value) =>
            onUpdate({
              priority: value as 'NORMAL' | 'HIGH',
            })
          }
        >
          <option value="NORMAL">Normal</option>
          <option value="HIGH">High</option>
        </SelectField>
      </div>

      <div className="border-t border-[#0B1020]/[0.07] pt-5">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#64748B]">
          Conversation
        </p>

        <div className="mt-3 space-y-2 text-xs text-[#64748B]">
          <div className="flex items-center justify-between">
            <span>Total messages</span>
            <span className="font-bold text-[#334155]">
              {conversation.messages.length}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span>Unread</span>
            <span className="font-bold text-[#334155]">
              {conversation.unreadCount}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span>Starred</span>
            <span className="font-bold text-[#334155]">
              {conversation.starred ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComposeModal({
  form,
  error,
  onUpdate,
  onClose,
  onSubmit,
}: {
  form: ComposeForm;
  error: string;
  onUpdate: (key: keyof ComposeForm, value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0B1020]/55 p-4 backdrop-blur-sm">
      <div className="mx-auto my-8 max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-[#0B1020]/[0.07] px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#A87B1B]">
              Client communication
            </p>

            <h2 className="mt-1 text-xl font-bold text-[#0B1020]">
              New message
            </h2>

            <p className="mt-1 text-sm text-[#5A6173]">
              Start a new conversation with a client contact.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close new message"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#64748B] hover:bg-[#0B1020]/[0.05]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={onSubmit}>
          <div className="grid gap-5 p-6 sm:grid-cols-2">
            <TextField
              label="Client"
              value={form.client}
              onChange={(value) => onUpdate('client', value)}
              placeholder="Client or company"
              required
            />

            <TextField
              label="Contact name"
              value={form.contactName}
              onChange={(value) =>
                onUpdate('contactName', value)
              }
              placeholder="Contact person"
            />

            <TextField
              label="Email address"
              type="email"
              value={form.contactEmail}
              onChange={(value) =>
                onUpdate('contactEmail', value)
              }
              placeholder="client@example.com"
              required
            />

            <TextField
              label="Linked project"
              value={form.project}
              onChange={(value) => onUpdate('project', value)}
              placeholder="Optional project"
            />

            <div className="sm:col-span-2">
              <TextField
                label="Subject"
                value={form.subject}
                onChange={(value) =>
                  onUpdate('subject', value)
                }
                placeholder="Message subject"
                required
              />
            </div>

            <label className="sm:col-span-2">
              <span className="text-sm font-semibold text-[#334155]">
                Message
                <span className="ml-1 text-red-500">*</span>
              </span>

              <textarea
                value={form.message}
                onChange={(event) =>
                  onUpdate('message', event.target.value)
                }
                rows={6}
                required
                placeholder="Write your message..."
                className="mt-2 w-full resize-none rounded-xl border border-[#0B1020]/10 bg-[#FAFAF9] px-3.5 py-3 text-sm leading-6 text-[#0B1020] outline-none transition focus:border-[#14B8A6] focus:bg-white"
              />
            </label>
          </div>

          <footer className="border-t border-[#0B1020]/[0.07] bg-[#FAFAF9] px-6 py-4">
            {error && (
              <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#0B1020]/10 bg-white px-4 text-sm font-bold text-[#475569]"
              >
                <Paperclip className="h-4 w-4" />
                Attach file
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-11 rounded-xl border border-[#0B1020]/10 bg-white px-4 text-sm font-bold text-[#475569]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0B1020] px-5 text-sm font-bold text-white transition hover:bg-[#151D34]"
                >
                  <Send className="h-4 w-4" />
                  Send message
                </button>
              </div>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  iconClasses,
}: {
  label: string;
  value: number;
  icon: typeof Mail;
  iconClasses: string;
}) {
  return (
    <article className="rounded-3xl border border-[#0B1020]/[0.07] bg-white p-5 shadow-[0_1px_2px_rgba(11,16,32,0.04)]">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconClasses}`}
      >
        <Icon className="h-5 w-5" />
      </div>

      <p className="mt-5 text-sm font-semibold text-[#64748B]">
        {label}
      </p>

      <p className="mt-1 text-3xl font-bold tracking-tight text-[#0B1020]">
        {value}
      </p>
    </article>
  );
}

function ConversationStatusBadge({
  status,
}: {
  status: ConversationStatus;
}) {
  const styles: Record<ConversationStatus, string> = {
    OPEN: 'bg-blue-50 text-blue-700',
    WAITING: 'bg-amber-50 text-amber-700',
    RESOLVED: 'bg-emerald-50 text-emerald-700',
    ARCHIVED: 'bg-slate-100 text-slate-600',
  };

  const labels: Record<ConversationStatus, string> = {
    OPEN: 'Open',
    WAITING: 'Waiting',
    RESOLVED: 'Resolved',
    ARCHIVED: 'Archived',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${styles[status]}`}
    >
      <Circle className="h-1.5 w-1.5 fill-current" />
      {labels[status]}
    </span>
  );
}

function ComposerButton({
  icon: Icon,
  label,
}: {
  icon: typeof Paperclip;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-xl text-[#64748B] transition hover:bg-white hover:text-[#0B1020]"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B1020]/[0.05] text-[#475569]">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">
          {label}
        </p>

        <p className="mt-1 break-words text-sm font-semibold text-[#334155]">
          {value}
        </p>
      </div>
    </div>
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
      <span className="text-xs font-semibold text-[#64748B]">
        {label}
      </span>

      <div className="relative mt-2">
        <select
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="h-10 w-full appearance-none rounded-xl border border-[#0B1020]/10 bg-[#FAFAF9] px-3 pr-9 text-xs font-bold text-[#334155] outline-none focus:border-[#14B8A6]"
        >
          {children}
        </select>

        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
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

function MenuAction({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: typeof Archive;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition ${
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

function formatConversationTime(value: string) {
  const date = new Date(value);
  const difference = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(difference / 60_000));

  if (minutes < 1) {
    return 'Now';
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  if (minutes < 1440) {
    return `${Math.floor(minutes / 60)}h`;
  }

  if (minutes < 10080) {
    return `${Math.floor(minutes / 1440)}d`;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function formatMessageTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}