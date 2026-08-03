'use client';

// app/(dashboard)/finance/PaymentDetails.tsx
//
// Details are fetched on demand rather than rendered with the page, so the
// full account number only reaches the browser when it is actually wanted —
// and can be hidden again without reloading.

import { useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  MapPin,
  Send,
} from 'lucide-react';

type Details = {
  accountName: string;
  currency: string;
  uk: {
    sortCode: string | null;
    accountNumber: string | null;
  };
  international: {
    iban: string | null;
    bic: string | null;
    bankName: string | null;
    bankAddress: string | null;
    beneficiaryAddress: string | null;
    available: boolean;
  };
};

export type InvoiceOption = {
  id: string;
  invoiceRef: string;
  clientName: string;
  contactName: string | null;
  currency: string;
  /** Outstanding amount as a plain decimal string, e.g. "1500000.00". */
  balance: string;
};

type Mode = 'uk' | 'international';

export function PaymentDetails({ invoices }: { invoices: InvoiceOption[] }) {
  const [details, setDetails] = useState<Details | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [mode, setMode] = useState<Mode>('uk');
  const [copied, setCopied] = useState<string | null>(null);

  const invoice = invoices.find((item) => item.id === invoiceId) ?? null;

  async function toggle() {
    if (visible) {
      setVisible(false);
      setCopied(null);
      return;
    }

    // Already fetched once this session — no need to hit Monzo again.
    if (details) {
      setVisible(true);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/monzo/payment-details', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });

      const result = (await response.json()) as Details & { error?: string };

      if (!response.ok) throw new Error(result.error || 'Unable to load payment details.');

      setDetails(result);
      setVisible(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load payment details.');
    } finally {
      setLoading(false);
    }
  }

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 1800);
    } catch {
      setError('Your browser blocked clipboard access. Select the text and copy manually.');
    }
  }

  // The reference travels with the payment, so it must be the invoice ref when
  // there is one — that is what makes matching possible later.
  const reference = invoice?.invoiceRef ?? 'SYNTRAGRID';

  const message = details ? buildMessage({ details, invoice, reference, mode }) : '';
  const showing = visible && details !== null;

  return (
    <section className="rounded-3xl border border-[#D4AF37]/15 bg-white p-5 shadow-[0_1px_2px_rgba(11,16,32,0.04)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#0B1020]">Payment details</h2>
          <p className="mt-1 text-sm text-[#5A6173]">
            What to send a client so they can pay by bank transfer.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void toggle()}
          disabled={loading}
          className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold transition disabled:opacity-50 ${
            showing
              ? 'border border-[#0B1020]/[0.08] bg-white text-[#5A6173] hover:text-[#0B1020]'
              : 'bg-[#0B1020] text-white hover:bg-[#151D34]'
          }`}
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : showing ? (
            <EyeOff size={14} />
          ) : (
            <Eye size={14} />
          )}
          {loading ? 'Loading' : showing ? 'Hide details' : 'Show details'}
        </button>
      </div>

      {error && (
        <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-semibold text-red-700">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {showing && details && (
        <>
          {/* UK / International */}
          <div className="mt-5 inline-flex rounded-xl bg-[#0B1020]/[0.04] p-1">
            <ModeButton
              active={mode === 'uk'}
              onClick={() => setMode('uk')}
              icon={MapPin}
              label="UK transfer"
            />
            <ModeButton
              active={mode === 'international'}
              onClick={() => setMode('international')}
              icon={Globe}
              label="International"
            />
          </div>

          {/* Invoice picker — optional, but it sets the payment reference */}
          {invoices.length > 0 && (
            <label className="mt-5 block">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A6173]">
                For an invoice
              </span>

              <select
                value={invoiceId}
                onChange={(event) => setInvoiceId(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-[#0B1020]/[0.08] bg-[#FAFAF9] px-3.5 text-sm font-semibold text-[#0B1020] outline-none focus:border-[#0D9488] focus:bg-white"
              >
                <option value="">No specific invoice</option>

                {invoices.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.invoiceRef} · {option.clientName} ·{' '}
                    {formatMoney(option.balance, option.currency)}
                  </option>
                ))}
              </select>

              <span className="mt-1.5 block text-xs text-[#5A6173]">
                Sets the payment reference, so the transfer can be matched automatically.
              </span>
            </label>
          )}

          {/* Fields */}
          {mode === 'uk' ? (
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field
                label="Account name"
                value={details.accountName}
                copied={copied === 'name'}
                onCopy={() => void copy('name', details.accountName)}
              />
              <Field
                label="Sort code"
                value={details.uk.sortCode ?? 'Not provided'}
                mono
                copied={copied === 'sort'}
                onCopy={() =>
                  details.uk.sortCode &&
                  void copy('sort', details.uk.sortCode.replaceAll('-', ''))
                }
              />
              <Field
                label="Account number"
                value={details.uk.accountNumber ?? 'Not provided'}
                mono
                copied={copied === 'number'}
                onCopy={() =>
                  details.uk.accountNumber && void copy('number', details.uk.accountNumber)
                }
              />
              <Field
                label="Reference"
                value={reference}
                mono
                copied={copied === 'ref'}
                onCopy={() => void copy('ref', reference)}
              />
            </dl>
          ) : details.international.available ? (
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field
                label="Beneficiary"
                value={details.accountName}
                copied={copied === 'name'}
                onCopy={() => void copy('name', details.accountName)}
              />
              <Field
                label="BIC / SWIFT"
                value={details.international.bic ?? '—'}
                mono
                copied={copied === 'bic'}
                onCopy={() =>
                  details.international.bic && void copy('bic', details.international.bic)
                }
              />
              <div className="sm:col-span-2">
                <Field
                  label="IBAN"
                  value={details.international.iban ?? '—'}
                  mono
                  copied={copied === 'iban'}
                  onCopy={() =>
                    details.international.iban &&
                    void copy('iban', details.international.iban.replaceAll(' ', ''))
                  }
                />
              </div>
              {details.international.bankName && (
                <Field
                  label="Bank"
                  value={details.international.bankName}
                  copied={copied === 'bank'}
                  onCopy={() => void copy('bank', details.international.bankName as string)}
                />
              )}
              <Field
                label="Reference"
                value={reference}
                mono
                copied={copied === 'ref'}
                onCopy={() => void copy('ref', reference)}
              />
            </dl>
          ) : (
            <p className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-800">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>
                International details are not configured. Open the Monzo app → Account
                details → International, then set <code>MONZO_IBAN</code>,{' '}
                <code>MONZO_BIC</code>, <code>MONZO_BANK_NAME</code>,{' '}
                <code>MONZO_BANK_ADDRESS</code> and{' '}
                <code>MONZO_BENEFICIARY_ADDRESS</code> in Vercel, then redeploy.
              </span>
            </p>
          )}

          {/* Ready-to-send message */}
          {(mode === 'uk' || details.international.available) && (
            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A6173]">
                  Message to send
                </span>

                <button
                  type="button"
                  onClick={() => void copy('message', message)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D4AF37]/25 bg-white px-3 text-xs font-bold text-[#A87B1B] transition hover:bg-[#D4AF37]/[0.06]"
                >
                  {copied === 'message' ? <Check size={12} /> : <Send size={12} />}
                  {copied === 'message' ? 'Copied' : 'Copy message'}
                </button>
              </div>

              <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-[#0B1020]/[0.06] bg-[#FAFAF9] p-4 font-sans text-sm leading-6 text-[#0B1020]">
                {message}
              </pre>
            </div>
          )}

          {invoice && invoice.currency !== details.currency && (
            <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-800">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>
                This invoice is in {invoice.currency} but the account receives{' '}
                {details.currency}. The client pays conversion and correspondent bank
                fees, so the amount landing will be short of the invoice — agree who
                absorbs that before sending, or the invoice never closes cleanly.
              </span>
            </p>
          )}
        </>
      )}
    </section>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold transition-colors ${
        active ? 'bg-white text-[#0B1020] shadow-sm' : 'text-[#5A6173] hover:text-[#0B1020]'
      }`}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function Field({
  label,
  value,
  mono = false,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#0B1020]/[0.06] bg-[#FAFAF9] p-3.5">
      <div className="min-w-0">
        <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6173]">
          {label}
        </dt>
        <dd
          className={`mt-1 truncate text-sm font-bold text-[#0B1020] ${
            mono ? 'font-mono tracking-tight' : ''
          }`}
        >
          {value}
        </dd>
      </div>

      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label}`}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
          copied
            ? 'bg-[#14B8A6]/12 text-[#0D9488]'
            : 'bg-white text-[#5A6173] ring-1 ring-[#0B1020]/[0.06] hover:text-[#0B1020]'
        }`}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function buildMessage({
  details,
  invoice,
  reference,
  mode,
}: {
  details: Details;
  invoice: InvoiceOption | null;
  reference: string;
  mode: Mode;
}) {
  const greeting = invoice?.contactName ? `Hi ${invoice.contactName},` : 'Hello,';

  const opening = invoice
    ? `Invoice ${invoice.invoiceRef} for ${formatMoney(invoice.balance, invoice.currency)} is now due.`
    : 'Here are our bank details for payment.';

  const lines =
    mode === 'uk'
      ? [
          'Payment details (UK transfer):',
          `Account name: ${details.accountName}`,
          `Sort code: ${details.uk.sortCode ?? '—'}`,
          `Account number: ${details.uk.accountNumber ?? '—'}`,
          `Reference: ${reference}`,
        ]
      : [
          'Payment details (international transfer):',
          `Beneficiary: ${details.accountName}`,
          `IBAN: ${details.international.iban ?? '—'}`,
          `BIC / SWIFT: ${details.international.bic ?? '—'}`,
          ...(details.international.bankName
            ? [`Bank: ${details.international.bankName}`]
            : []),
          ...(details.international.bankAddress
            ? [`Bank address: ${details.international.bankAddress}`]
            : []),
          ...(details.international.beneficiaryAddress
            ? [`Beneficiary address: ${details.international.beneficiaryAddress}`]
            : []),
          `Currency: ${details.currency}`,
          `Reference: ${reference}`,
        ];

  const closing =
    mode === 'uk'
      ? 'Please quote the reference exactly so the payment is matched to your account.'
      : `Please quote the reference exactly, and send in ${details.currency} so the full amount arrives. Your bank may charge a transfer fee.`;

  return [
    greeting,
    '',
    opening,
    '',
    ...lines,
    '',
    closing,
    '',
    'Many thanks,',
    'Syntra Grid',
  ].join('\n');
}

function formatMoney(amount: string, currency: string) {
  const value = Number(amount);

  if (!Number.isFinite(value)) return amount;

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}