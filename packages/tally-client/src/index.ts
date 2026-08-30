import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCKFGICF5BOWRXXWC6KSGZQ3UIL6BT23ZO3RIMLNQA7M5XNB6PZT5WKR",
  }
} as const


/**
 * A request for payment.
 * 
 * `amount == 0` lets the payer choose what to send, which is what turns the
 * same primitive into a tip jar or a donation page. `max_payments == 0` means
 * the link stays payable until it expires or the merchant closes it.
 */
export interface Link {
  amount: i128;
  collected: i128;
  created_at: u64;
  expires_at: u64;
  id: u64;
  max_payments: u32;
  merchant: string;
  payments: u32;
  status: Status;
  token: string;
}

export const Errors = {
  /**
   * No link exists with this id.
   */
  1: {message:"NotFound"},
  /**
   * The merchant closed this link.
   */
  2: {message:"Closed"},
  /**
   * The link passed its expiry.
   */
  3: {message:"Expired"},
  /**
   * The link has taken all the payments it was created to accept.
   */
  4: {message:"Full"},
  /**
   * This link asks for an exact amount and the payment did not match it.
   */
  5: {message:"WrongAmount"},
  /**
   * Amounts must be strictly positive.
   */
  6: {message:"InvalidAmount"},
  /**
   * Only the merchant who created the link may do this.
   */
  7: {message:"NotMerchant"},
  /**
   * Lifetime must be positive and no longer than MAX_LIFETIME.
   */
  8: {message:"InvalidLifetime"},
  /**
   * A page request larger than MAX_PAGE.
   */
  9: {message:"PageTooLarge"}
}

export type Status = {tag: "Open", values: void} | {tag: "Closed", values: void};


/**
 * Running totals for a merchant, kept as counters so the dashboard never has
 * to page through history to show a headline number.
 */
export interface Totals {
  links: u32;
  payments: u32;
}

export type DataKey = {tag: "NextId", values: void} | {tag: "Link", values: readonly [u64]} | {tag: "Payment", values: readonly [u64, u32]} | {tag: "Totals", values: readonly [string]} | {tag: "MerchantLink", values: readonly [string, u32]} | {tag: "Volume", values: readonly [string, string]};


/**
 * A settled payment. Written in the same transaction as the transfer, so a
 * merchant's records cannot drift from what the chain actually did.
 */
export interface Payment {
  amount: i128;
  at: u64;
  link: u64;
  payer: string;
}




export interface Client {
  /**
   * Construct and simulate a pay transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pays a link. The tokens move from `payer` straight to the merchant;
   * this contract is never in the path of the funds.
   */
  pay: ({id, payer, amount}: {id: u64, payer: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a link transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  link: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Link>>>

  /**
   * Construct and simulate a close transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Stops a link accepting payments. Payments already taken are untouched;
   * they went to the merchant when they were made.
   */
  close: ({merchant, id}: {merchant: string, id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Creates a payment link and returns its id.
   * 
   * `amount` of `0` lets the payer decide. `max_payments` of `0` accepts
   * payments until the link expires or is closed.
   */
  create: ({merchant, token, amount, max_payments, lifetime}: {merchant: string, token: string, amount: i128, max_payments: u32, lifetime: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a payable transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * True when the link would accept a payment right now. The payment page
   * asks this before showing a pay button, so a shopper learns the link is
   * dead before they sign rather than after.
   */
  payable: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<boolean>>>

  /**
   * Construct and simulate a links_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * A merchant's links, newest first, which is the order a dashboard reads.
   */
  links_of: ({merchant, offset, limit}: {merchant: string, offset: u32, limit: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<Link>>>>

  /**
   * Construct and simulate a totals_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  totals_of: ({merchant}: {merchant: string}, options?: MethodOptions) => Promise<AssembledTransaction<Totals>>

  /**
   * Construct and simulate a volume_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Lifetime amount a merchant has collected in one token.
   */
  volume_of: ({merchant, token}: {merchant: string, token: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a link_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  link_count: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a payments_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Payments against one link, oldest first.
   */
  payments_of: ({id, offset, limit}: {id: u64, offset: u32, limit: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<Payment>>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAHRQYXlzIGEgbGluay4gVGhlIHRva2VucyBtb3ZlIGZyb20gYHBheWVyYCBzdHJhaWdodCB0byB0aGUgbWVyY2hhbnQ7CnRoaXMgY29udHJhY3QgaXMgbmV2ZXIgaW4gdGhlIHBhdGggb2YgdGhlIGZ1bmRzLgAAAANwYXkAAAAAAwAAAAAAAAACaWQAAAAAAAYAAAAAAAAABXBheWVyAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAEbGluawAAAAEAAAAAAAAAAmlkAAAAAAAGAAAAAQAAA+kAAAfQAAAABExpbmsAAAAD",
        "AAAAAAAAAHVTdG9wcyBhIGxpbmsgYWNjZXB0aW5nIHBheW1lbnRzLiBQYXltZW50cyBhbHJlYWR5IHRha2VuIGFyZSB1bnRvdWNoZWQ7CnRoZXkgd2VudCB0byB0aGUgbWVyY2hhbnQgd2hlbiB0aGV5IHdlcmUgbWFkZS4AAAAAAAAFY2xvc2UAAAAAAAACAAAAAAAAAAhtZXJjaGFudAAAABMAAAAAAAAAAmlkAAAAAAAGAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAJ5DcmVhdGVzIGEgcGF5bWVudCBsaW5rIGFuZCByZXR1cm5zIGl0cyBpZC4KCmBhbW91bnRgIG9mIGAwYCBsZXRzIHRoZSBwYXllciBkZWNpZGUuIGBtYXhfcGF5bWVudHNgIG9mIGAwYCBhY2NlcHRzCnBheW1lbnRzIHVudGlsIHRoZSBsaW5rIGV4cGlyZXMgb3IgaXMgY2xvc2VkLgAAAAAABmNyZWF0ZQAAAAAABQAAAAAAAAAIbWVyY2hhbnQAAAATAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAMbWF4X3BheW1lbnRzAAAABAAAAAAAAAAIbGlmZXRpbWUAAAAGAAAAAQAAA+kAAAAGAAAAAw==",
        "AAAAAAAAALVUcnVlIHdoZW4gdGhlIGxpbmsgd291bGQgYWNjZXB0IGEgcGF5bWVudCByaWdodCBub3cuIFRoZSBwYXltZW50IHBhZ2UKYXNrcyB0aGlzIGJlZm9yZSBzaG93aW5nIGEgcGF5IGJ1dHRvbiwgc28gYSBzaG9wcGVyIGxlYXJucyB0aGUgbGluayBpcwpkZWFkIGJlZm9yZSB0aGV5IHNpZ24gcmF0aGVyIHRoYW4gYWZ0ZXIuAAAAAAAAB3BheWFibGUAAAAAAQAAAAAAAAACaWQAAAAAAAYAAAABAAAD6QAAAAEAAAAD",
        "AAAAAAAAAEdBIG1lcmNoYW50J3MgbGlua3MsIG5ld2VzdCBmaXJzdCwgd2hpY2ggaXMgdGhlIG9yZGVyIGEgZGFzaGJvYXJkIHJlYWRzLgAAAAAIbGlua3Nfb2YAAAADAAAAAAAAAAhtZXJjaGFudAAAABMAAAAAAAAABm9mZnNldAAAAAAABAAAAAAAAAAFbGltaXQAAAAAAAAEAAAAAQAAA+kAAAPqAAAH0AAAAARMaW5rAAAAAw==",
        "AAAAAAAAAAAAAAAJdG90YWxzX29mAAAAAAAAAQAAAAAAAAAIbWVyY2hhbnQAAAATAAAAAQAAB9AAAAAGVG90YWxzAAA=",
        "AAAAAAAAADZMaWZldGltZSBhbW91bnQgYSBtZXJjaGFudCBoYXMgY29sbGVjdGVkIGluIG9uZSB0b2tlbi4AAAAAAAl2b2x1bWVfb2YAAAAAAAACAAAAAAAAAAhtZXJjaGFudAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAEAAAAL",
        "AAAAAAAAAAAAAAAKbGlua19jb3VudAAAAAAAAAAAAAEAAAAG",
        "AAAAAAAAAChQYXltZW50cyBhZ2FpbnN0IG9uZSBsaW5rLCBvbGRlc3QgZmlyc3QuAAAAC3BheW1lbnRzX29mAAAAAAMAAAAAAAAAAmlkAAAAAAAGAAAAAAAAAAZvZmZzZXQAAAAAAAQAAAAAAAAABWxpbWl0AAAAAAAABAAAAAEAAAPpAAAD6gAAB9AAAAAHUGF5bWVudAAAAAAD",
        "AAAAAQAAAPBBIHJlcXVlc3QgZm9yIHBheW1lbnQuCgpgYW1vdW50ID09IDBgIGxldHMgdGhlIHBheWVyIGNob29zZSB3aGF0IHRvIHNlbmQsIHdoaWNoIGlzIHdoYXQgdHVybnMgdGhlCnNhbWUgcHJpbWl0aXZlIGludG8gYSB0aXAgamFyIG9yIGEgZG9uYXRpb24gcGFnZS4gYG1heF9wYXltZW50cyA9PSAwYCBtZWFucwp0aGUgbGluayBzdGF5cyBwYXlhYmxlIHVudGlsIGl0IGV4cGlyZXMgb3IgdGhlIG1lcmNoYW50IGNsb3NlcyBpdC4AAAAAAAAABExpbmsAAAAKAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACWNvbGxlY3RlZAAAAAAAAAsAAAAAAAAACmNyZWF0ZWRfYXQAAAAAAAYAAAAAAAAACmV4cGlyZXNfYXQAAAAAAAYAAAAAAAAAAmlkAAAAAAAGAAAAAAAAAAxtYXhfcGF5bWVudHMAAAAEAAAAAAAAAAhtZXJjaGFudAAAABMAAAAAAAAACHBheW1lbnRzAAAABAAAAAAAAAAGc3RhdHVzAAAAAAfQAAAABlN0YXR1cwAAAAAAAAAAAAV0b2tlbgAAAAAAABM=",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACQAAABxObyBsaW5rIGV4aXN0cyB3aXRoIHRoaXMgaWQuAAAACE5vdEZvdW5kAAAAAQAAAB5UaGUgbWVyY2hhbnQgY2xvc2VkIHRoaXMgbGluay4AAAAAAAZDbG9zZWQAAAAAAAIAAAAbVGhlIGxpbmsgcGFzc2VkIGl0cyBleHBpcnkuAAAAAAdFeHBpcmVkAAAAAAMAAAA9VGhlIGxpbmsgaGFzIHRha2VuIGFsbCB0aGUgcGF5bWVudHMgaXQgd2FzIGNyZWF0ZWQgdG8gYWNjZXB0LgAAAAAAAARGdWxsAAAABAAAAERUaGlzIGxpbmsgYXNrcyBmb3IgYW4gZXhhY3QgYW1vdW50IGFuZCB0aGUgcGF5bWVudCBkaWQgbm90IG1hdGNoIGl0LgAAAAtXcm9uZ0Ftb3VudAAAAAAFAAAAIkFtb3VudHMgbXVzdCBiZSBzdHJpY3RseSBwb3NpdGl2ZS4AAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAABgAAADNPbmx5IHRoZSBtZXJjaGFudCB3aG8gY3JlYXRlZCB0aGUgbGluayBtYXkgZG8gdGhpcy4AAAAAC05vdE1lcmNoYW50AAAAAAcAAAA6TGlmZXRpbWUgbXVzdCBiZSBwb3NpdGl2ZSBhbmQgbm8gbG9uZ2VyIHRoYW4gTUFYX0xJRkVUSU1FLgAAAAAAD0ludmFsaWRMaWZldGltZQAAAAAIAAAAJEEgcGFnZSByZXF1ZXN0IGxhcmdlciB0aGFuIE1BWF9QQUdFLgAAAAxQYWdlVG9vTGFyZ2UAAAAJ",
        "AAAAAgAAAAAAAAAAAAAABlN0YXR1cwAAAAAAAgAAAAAAAAAAAAAABE9wZW4AAAAAAAAAAAAAAAZDbG9zZWQAAA==",
        "AAAAAQAAAH1SdW5uaW5nIHRvdGFscyBmb3IgYSBtZXJjaGFudCwga2VwdCBhcyBjb3VudGVycyBzbyB0aGUgZGFzaGJvYXJkIG5ldmVyIGhhcwp0byBwYWdlIHRocm91Z2ggaGlzdG9yeSB0byBzaG93IGEgaGVhZGxpbmUgbnVtYmVyLgAAAAAAAAAAAAAGVG90YWxzAAAAAAACAAAAAAAAAAVsaW5rcwAAAAAAAAQAAAAAAAAACHBheW1lbnRzAAAABA==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABgAAAAAAAAAAAAAABk5leHRJZAAAAAAAAQAAAAAAAAAETGluawAAAAEAAAAGAAAAAQAAAB4obGluayBpZCwgc2VxdWVuY2UpIC0+IFBheW1lbnQAAAAAAAdQYXltZW50AAAAAAIAAAAGAAAABAAAAAEAAAASbWVyY2hhbnQgLT4gVG90YWxzAAAAAAAGVG90YWxzAAAAAAABAAAAEwAAAAEAAAAfKG1lcmNoYW50LCBzZXF1ZW5jZSkgLT4gbGluayBpZAAAAAAMTWVyY2hhbnRMaW5rAAAAAgAAABMAAAAEAAAAAQAAAC4obWVyY2hhbnQsIHRva2VuKSAtPiBsaWZldGltZSBhbW91bnQgY29sbGVjdGVkAAAAAAAGVm9sdW1lAAAAAAACAAAAEwAAABM=",
        "AAAAAQAAAIpBIHNldHRsZWQgcGF5bWVudC4gV3JpdHRlbiBpbiB0aGUgc2FtZSB0cmFuc2FjdGlvbiBhcyB0aGUgdHJhbnNmZXIsIHNvIGEKbWVyY2hhbnQncyByZWNvcmRzIGNhbm5vdCBkcmlmdCBmcm9tIHdoYXQgdGhlIGNoYWluIGFjdHVhbGx5IGRpZC4AAAAAAAAAAAAHUGF5bWVudAAAAAAEAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAmF0AAAAAAAGAAAAAAAAAARsaW5rAAAABgAAAAAAAAAFcGF5ZXIAAAAAAAAT",
        "AAAABQAAAIlFbWl0dGVkIGluIHRoZSBzYW1lIHRyYW5zYWN0aW9uIGFzIHRoZSB0cmFuc2ZlciBpdCBkZXNjcmliZXMsIHNvIGFuIGluZGV4ZXIKdGhhdCB0cnVzdHMgdGhpcyBldmVudCBpcyBuZXZlciBhaGVhZCBvZiBvciBiZWhpbmQgdGhlIG1vbmV5LgAAAAAAAAAAAAAEUGFpZAAAAAEAAAAEcGFpZAAAAAUAAAAAAAAAAmlkAAAAAAAGAAAAAQAAAAAAAAAIbWVyY2hhbnQAAAATAAAAAQAAAAAAAAAFcGF5ZXIAAAAAAAATAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAAIcGF5bWVudHMAAAAEAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAB0NyZWF0ZWQAAAAAAQAAAAdjcmVhdGVkAAAAAAUAAAAAAAAAAmlkAAAAAAAGAAAAAQAAAAAAAAAIbWVyY2hhbnQAAAATAAAAAQAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAACkNsb3NlZExpbmsAAAAAAAEAAAALY2xvc2VkX2xpbmsAAAAAAwAAAAAAAAACaWQAAAAAAAYAAAABAAAAAAAAAAhtZXJjaGFudAAAABMAAAABAAAAAAAAAAljb2xsZWN0ZWQAAAAAAAALAAAAAAAAAAI=" ]),
      options
    )
  }
  public readonly fromJSON = {
    pay: this.txFromJSON<Result<void>>,
        link: this.txFromJSON<Result<Link>>,
        close: this.txFromJSON<Result<void>>,
        create: this.txFromJSON<Result<u64>>,
        payable: this.txFromJSON<Result<boolean>>,
        links_of: this.txFromJSON<Result<Array<Link>>>,
        totals_of: this.txFromJSON<Totals>,
        volume_of: this.txFromJSON<i128>,
        link_count: this.txFromJSON<u64>,
        payments_of: this.txFromJSON<Result<Array<Payment>>>
  }
}