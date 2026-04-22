import { readFile } from 'node:fs/promises';

const SPLIT_IDS_REGEX = /[\s,]+/;
const FLAG_NAME_TO_BIT = new Map<string, number>([
  ['linked', 1 << 0],
  ['debits_must_not_exceed_credits', 1 << 1],
  ['credits_must_not_exceed_debits', 1 << 2],
  ['history', 1 << 3],
  ['imported', 1 << 4],
  ['closed', 1 << 5],
  ['pending', 1 << 1],
  ['post_pending_transfer', 1 << 2],
  ['void_pending_transfer', 1 << 3],
  ['balancing_debit', 1 << 4],
  ['balancing_credit', 1 << 5],
  ['closing_debit', 1 << 6],
  ['closing_credit', 1 << 7],
  ['debits', 1 << 0],
  ['credits', 1 << 1],
  ['reversed', 1 << 2],
]);

export const tbOperationNames = [
  'create_accounts',
  'create_transfers',
  'lookup_accounts',
  'lookup_transfers',
  'get_account_transfers',
  'get_account_balances',
  'query_accounts',
  'query_transfers',
] as const;

export type TbOperationName = typeof tbOperationNames[number];

export interface PayloadOverrideOptions {
  file?: string;
  payload?: string;
}

export async function resolveTbPayload<T>(options: PayloadOverrideOptions, buildFromFlags: () => T) {
  if (options.file) {
    return JSON.parse(await readFile(options.file, 'utf8')) as T;
  }

  if (options.payload) {
    return JSON.parse(options.payload) as T;
  }

  return buildFromFlags();
}

export function buildCreateAccountsPayload(options: {
  code?: string;
  flags?: string[];
  id?: string;
  ledger?: string;
  userData128?: string;
  userData32?: string;
  userData64?: string;
}) {
  return [omitEmpty({
    code: requiredValue(options.code, '--code'),
    flags: flagsBitfield(options.flags),
    id: options.id ?? randomTbId(),
    ledger: requiredValue(options.ledger, '--ledger'),
    user_data_128: options.userData128,
    user_data_32: options.userData32,
    user_data_64: options.userData64,
  })];
}

export function buildCreateTransfersPayload(options: {
  amount?: string;
  code?: string;
  creditAccountId?: string;
  debitAccountId?: string;
  flags?: string[];
  id?: string;
  ledger?: string;
  pendingId?: string;
  timeout?: string;
}) {
  return [omitEmpty({
    amount: requiredValue(options.amount, '--amount'),
    code: requiredValue(options.code, '--code'),
    credit_account_id: requiredValue(options.creditAccountId, '--to'),
    debit_account_id: requiredValue(options.debitAccountId, '--from'),
    flags: flagsBitfield(options.flags),
    id: options.id ?? randomTbId(),
    ledger: requiredValue(options.ledger, '--ledger'),
    pending_id: options.pendingId,
    timeout: options.timeout,
  })];
}

export function buildLookupPayload(options: {
  id?: string[];
  ids?: string;
}) {
  const ids = [
    ...(options.id ?? []),
    ...splitIds(options.ids),
  ];

  if (ids.length === 0) {
    throw new Error('Provide at least one `--id` or `--ids` value.');
  }

  return ids;
}

export function buildAccountFilterPayload(options: {
  accountId?: string;
  code?: string;
  flags?: string[];
  limit?: string;
  timestampMax?: string;
  timestampMin?: string;
  userData128?: string;
  userData32?: string;
  userData64?: string;
}) {
  return omitEmpty({
    account_id: requiredValue(options.accountId, '--account-id'),
    code: options.code,
    flags: flagsBitfield(options.flags),
    limit: requiredValue(options.limit, '--limit'),
    timestamp_max: options.timestampMax,
    timestamp_min: options.timestampMin,
    user_data_128: options.userData128,
    user_data_32: options.userData32,
    user_data_64: options.userData64,
  });
}

export function buildQueryPayload(options: {
  code?: string;
  flags?: string[];
  ledger?: string;
  limit?: string;
  timestampMax?: string;
  timestampMin?: string;
  userData128?: string;
  userData32?: string;
  userData64?: string;
}) {
  return omitEmpty({
    code: options.code,
    flags: flagsBitfield(options.flags),
    ledger: options.ledger,
    limit: requiredValue(options.limit, '--limit'),
    timestamp_max: options.timestampMax,
    timestamp_min: options.timestampMin,
    user_data_128: options.userData128,
    user_data_32: options.userData32,
    user_data_64: options.userData64,
  });
}

function flagsBitfield(flags?: string[]) {
  if (!flags || flags.length === 0) {
    return '0';
  }

  let bitfield = 0;
  for (const flag of flags) {
    const normalized = flag.trim();
    if (!normalized) {
      continue;
    }

    const direct = Number.parseInt(normalized, 10);
    if (Number.isInteger(direct) && direct >= 0) {
      bitfield |= direct;
      continue;
    }

    const bit = FLAG_NAME_TO_BIT.get(normalized);
    if (bit === undefined) {
      throw new Error(`Unsupported flag: ${flag}`);
    }
    bitfield |= bit;
  }

  return bitfield.toString();
}

function omitEmpty(input: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value.trim().length > 0),
  );
}

function randomTbId() {
  return BigInt(`0x${crypto.getRandomValues(new Uint8Array(16)).reduce((value, byte) => value + byte.toString(16).padStart(2, '0'), '')}`).toString();
}

function requiredValue(value: string | undefined, flagName: string) {
  if (!value || value.trim().length === 0) {
    throw new Error(`${flagName} is required unless --payload or --file is used.`);
  }
  return value.trim();
}

function splitIds(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(SPLIT_IDS_REGEX)
    .map(item => item.trim())
    .filter(Boolean);
}
