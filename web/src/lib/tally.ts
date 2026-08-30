import { Client, type Link, type Payment, type Totals, type contract } from "tally-client";

import { config } from "./config";
import { sign } from "./wallet";

export interface Settlement {
  readonly hash: string;
}

/**
 * Without a public key the SDK simulates against a null account, which is all
 * a read needs — so a payment page renders for a visitor with no wallet.
 */
export function client(publicKey?: string): Client {
  return new Client({
    contractId: config.contractId,
    networkPassphrase: config.passphrase,
    rpcUrl: config.rpcUrl,
    ...(publicKey ? { publicKey } : {}),
  });
}

const signWith = (address: string) => (xdr: string) => sign(xdr, address);

async function send(
  prepared: contract.AssembledTransaction<unknown>,
  address: string,
): Promise<Settlement> {
  const sent = await prepared.signAndSend({ signTransaction: signWith(address) });
  return { hash: sent.sendTransactionResponse?.hash ?? "" };
}

// ----- reads -----

export interface MerchantView {
  readonly totals: Totals;
  readonly volume: bigint;
  readonly links: readonly Link[];
}

export async function readMerchant(merchant: string): Promise<MerchantView> {
  const api = client();
  const [totals, volume, links] = await Promise.all([
    api.totals_of({ merchant }),
    api.volume_of({ merchant, token: config.nativeToken }),
    api.links_of({ merchant, offset: 0, limit: 100 }),
  ]);
  return { totals: totals.result, volume: volume.result, links: links.result.unwrap() };
}

export async function readLink(id: bigint): Promise<Link> {
  const { result } = await client().link({ id });
  return result.unwrap();
}

export async function readPayable(id: bigint): Promise<boolean> {
  const { result } = await client().payable({ id });
  return result.unwrap();
}

export async function readPayments(id: bigint): Promise<Payment[]> {
  const { result } = await client().payments_of({ id, offset: 0, limit: 100 });
  return result.unwrap();
}

// ----- writes -----

export interface NewLink {
  readonly token: string;
  readonly amount: bigint;
  readonly maxPayments: number;
  readonly lifetime: bigint;
}

export async function createLink(merchant: string, link: NewLink): Promise<Settlement> {
  const prepared = await client(merchant).create({
    merchant,
    token: link.token,
    amount: link.amount,
    max_payments: link.maxPayments,
    lifetime: link.lifetime,
  });
  return send(prepared, merchant);
}

export async function payLink(id: bigint, payer: string, amount: bigint): Promise<Settlement> {
  return send(await client(payer).pay({ id, payer, amount }), payer);
}

export async function closeLink(merchant: string, id: bigint): Promise<Settlement> {
  return send(await client(merchant).close({ merchant, id }), merchant);
}
