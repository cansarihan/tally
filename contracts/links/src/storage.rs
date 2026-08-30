use soroban_sdk::{Address, Env};

use crate::types::{DataKey, Error, Link, Payment, Totals};

const DAY_IN_LEDGERS: u32 = 17_280;

const INSTANCE_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
const INSTANCE_EXTEND: u32 = DAY_IN_LEDGERS * 90;

/// Links and their payments are the merchant's records; they outlive the link
/// itself, so they are kept for a year past the longest allowed lifetime.
const RECORD_THRESHOLD: u32 = DAY_IN_LEDGERS * 90;
const RECORD_EXTEND: u32 = DAY_IN_LEDGERS * 365;

pub fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_EXTEND);
}

pub fn take_next_id(env: &Env) -> u64 {
    let id: u64 = env.storage().instance().get(&DataKey::NextId).unwrap_or(0);
    env.storage().instance().set(&DataKey::NextId, &(id + 1));
    id
}

pub fn peek_next_id(env: &Env) -> u64 {
    env.storage().instance().get(&DataKey::NextId).unwrap_or(0)
}

pub fn read_link(env: &Env, id: u64) -> Result<Link, Error> {
    let key = DataKey::Link(id);
    match env.storage().persistent().get::<_, Link>(&key) {
        Some(link) => {
            env.storage()
                .persistent()
                .extend_ttl(&key, RECORD_THRESHOLD, RECORD_EXTEND);
            Ok(link)
        }
        None => Err(Error::NotFound),
    }
}

pub fn try_read_link(env: &Env, id: u64) -> Option<Link> {
    env.storage().persistent().get(&DataKey::Link(id))
}

pub fn write_link(env: &Env, link: &Link) {
    let key = DataKey::Link(link.id);
    env.storage().persistent().set(&key, link);
    env.storage()
        .persistent()
        .extend_ttl(&key, RECORD_THRESHOLD, RECORD_EXTEND);
}

pub fn write_payment(env: &Env, sequence: u32, payment: &Payment) {
    let key = DataKey::Payment(payment.link, sequence);
    env.storage().persistent().set(&key, payment);
    env.storage()
        .persistent()
        .extend_ttl(&key, RECORD_THRESHOLD, RECORD_EXTEND);
}

pub fn read_payment(env: &Env, link: u64, sequence: u32) -> Option<Payment> {
    env.storage()
        .persistent()
        .get(&DataKey::Payment(link, sequence))
}

pub fn read_totals(env: &Env, merchant: &Address) -> Totals {
    env.storage()
        .persistent()
        .get(&DataKey::Totals(merchant.clone()))
        .unwrap_or_default()
}

pub fn write_totals(env: &Env, merchant: &Address, totals: &Totals) {
    let key = DataKey::Totals(merchant.clone());
    env.storage().persistent().set(&key, totals);
    env.storage()
        .persistent()
        .extend_ttl(&key, RECORD_THRESHOLD, RECORD_EXTEND);
}

pub fn write_merchant_link(env: &Env, merchant: &Address, sequence: u32, id: u64) {
    let key = DataKey::MerchantLink(merchant.clone(), sequence);
    env.storage().persistent().set(&key, &id);
    env.storage()
        .persistent()
        .extend_ttl(&key, RECORD_THRESHOLD, RECORD_EXTEND);
}

pub fn read_merchant_link(env: &Env, merchant: &Address, sequence: u32) -> Option<u64> {
    env.storage()
        .persistent()
        .get(&DataKey::MerchantLink(merchant.clone(), sequence))
}

pub fn read_volume(env: &Env, merchant: &Address, token: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Volume(merchant.clone(), token.clone()))
        .unwrap_or(0)
}

pub fn write_volume(env: &Env, merchant: &Address, token: &Address, amount: i128) {
    let key = DataKey::Volume(merchant.clone(), token.clone());
    env.storage().persistent().set(&key, &amount);
    env.storage()
        .persistent()
        .extend_ttl(&key, RECORD_THRESHOLD, RECORD_EXTEND);
}
