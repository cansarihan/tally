#![no_std]
//! # Tally
//!
//! Payment links on Stellar. A merchant creates a link; anyone with a wallet
//! opens it and pays; the payment is recorded against the link in the same
//! transaction that moves the money.
//!
//! The decision that shapes everything else: **this contract never holds
//! funds.** `pay` transfers straight from the payer to the merchant and writes
//! a record. The contract is a registry and a witness, not a custodian, so
//! there is no pooled balance for an attacker to go after and no withdrawal
//! path to get wrong. The worst a bug here can do is misrecord a payment that
//! already went to the right place.
//!
//! One link covers several products because two fields are allowed to be zero:
//! `amount == 0` lets the payer choose the amount, and `max_payments == 0`
//! lets the link be paid any number of times. An invoice is `(amount, 1)`; a
//! tip jar is `(0, 0)`; a ticket sale is `(price, capacity)`.

use soroban_sdk::{contract, contractimpl, token, vec, Address, Env, Vec};

mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

use events::{ClosedLink, Created, Paid};
pub use types::{Error, Link, Payment, Status, Totals};
use types::{MAX_LIFETIME, MAX_PAGE};

#[contract]
pub struct TallyLinks;

#[contractimpl]
impl TallyLinks {
    /// Creates a payment link and returns its id.
    ///
    /// `amount` of `0` lets the payer decide. `max_payments` of `0` accepts
    /// payments until the link expires or is closed.
    pub fn create(
        env: Env,
        merchant: Address,
        token: Address,
        amount: i128,
        max_payments: u32,
        lifetime: u64,
    ) -> Result<u64, Error> {
        merchant.require_auth();
        if amount < 0 {
            return Err(Error::InvalidAmount);
        }
        if lifetime == 0 || lifetime > MAX_LIFETIME {
            return Err(Error::InvalidLifetime);
        }
        storage::bump_instance(&env);

        let now = env.ledger().timestamp();
        let id = storage::take_next_id(&env);
        let link = Link {
            id,
            merchant: merchant.clone(),
            token: token.clone(),
            amount,
            max_payments,
            payments: 0,
            collected: 0,
            status: Status::Open,
            created_at: now,
            expires_at: now + lifetime,
        };
        storage::write_link(&env, &link);

        // Index the link under the merchant so the dashboard can page through
        // their links without scanning every link ever created.
        let mut totals = storage::read_totals(&env, &merchant);
        storage::write_merchant_link(&env, &merchant, totals.links, id);
        totals.links += 1;
        storage::write_totals(&env, &merchant, &totals);

        Created {
            id,
            merchant,
            token,
            amount,
            expires_at: link.expires_at,
        }
        .publish(&env);
        Ok(id)
    }

    /// Pays a link. The tokens move from `payer` straight to the merchant;
    /// this contract is never in the path of the funds.
    pub fn pay(env: Env, id: u64, payer: Address, amount: i128) -> Result<(), Error> {
        payer.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        storage::bump_instance(&env);

        let mut link = storage::read_link(&env, id)?;
        if link.status == Status::Closed {
            return Err(Error::Closed);
        }
        if env.ledger().timestamp() > link.expires_at {
            return Err(Error::Expired);
        }
        if link.max_payments > 0 && link.payments >= link.max_payments {
            return Err(Error::Full);
        }
        // A fixed-amount link is a price, not a suggestion: paying the wrong
        // amount is rejected rather than accepted and reconciled later.
        if link.amount > 0 && amount != link.amount {
            return Err(Error::WrongAmount);
        }

        let now = env.ledger().timestamp();
        let sequence = link.payments;
        let payment = Payment {
            link: id,
            payer: payer.clone(),
            amount,
            at: now,
        };

        // Record before transferring. A token that re-enters finds the payment
        // already counted, so the link cannot be paid twice on one call.
        link.payments += 1;
        link.collected += amount;
        storage::write_link(&env, &link);
        storage::write_payment(&env, sequence, &payment);

        let mut totals = storage::read_totals(&env, &link.merchant);
        totals.payments += 1;
        storage::write_totals(&env, &link.merchant, &totals);

        let volume = storage::read_volume(&env, &link.merchant, &link.token) + amount;
        storage::write_volume(&env, &link.merchant, &link.token, volume);

        token::TokenClient::new(&env, &link.token).transfer(&payer, &link.merchant, &amount);

        Paid {
            id,
            merchant: link.merchant,
            payer,
            amount,
            payments: link.payments,
        }
        .publish(&env);
        Ok(())
    }

    /// Stops a link accepting payments. Payments already taken are untouched;
    /// they went to the merchant when they were made.
    pub fn close(env: Env, merchant: Address, id: u64) -> Result<(), Error> {
        merchant.require_auth();
        storage::bump_instance(&env);

        let mut link = storage::read_link(&env, id)?;
        if link.merchant != merchant {
            return Err(Error::NotMerchant);
        }
        if link.status == Status::Closed {
            return Err(Error::Closed);
        }

        link.status = Status::Closed;
        storage::write_link(&env, &link);

        ClosedLink {
            id,
            merchant,
            collected: link.collected,
        }
        .publish(&env);
        Ok(())
    }

    // ----- views -----

    pub fn link(env: Env, id: u64) -> Result<Link, Error> {
        storage::read_link(&env, id)
    }

    /// True when the link would accept a payment right now. The payment page
    /// asks this before showing a pay button, so a shopper learns the link is
    /// dead before they sign rather than after.
    pub fn payable(env: Env, id: u64) -> Result<bool, Error> {
        let link = storage::read_link(&env, id)?;
        Ok(link.status == Status::Open
            && env.ledger().timestamp() <= link.expires_at
            && (link.max_payments == 0 || link.payments < link.max_payments))
    }

    /// A merchant's links, newest first, which is the order a dashboard reads.
    pub fn links_of(
        env: Env,
        merchant: Address,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<Link>, Error> {
        if limit > MAX_PAGE {
            return Err(Error::PageTooLarge);
        }
        let total = storage::read_totals(&env, &merchant).links;
        let mut page = vec![&env];

        let mut index = total.saturating_sub(offset);
        while index > 0 && page.len() < limit {
            index -= 1;
            if let Some(id) = storage::read_merchant_link(&env, &merchant, index) {
                if let Some(link) = storage::try_read_link(&env, id) {
                    page.push_back(link);
                }
            }
        }
        Ok(page)
    }

    /// Payments against one link, oldest first.
    pub fn payments_of(env: Env, id: u64, offset: u32, limit: u32) -> Result<Vec<Payment>, Error> {
        if limit > MAX_PAGE {
            return Err(Error::PageTooLarge);
        }
        let link = storage::read_link(&env, id)?;
        let mut page = vec![&env];

        let mut sequence = offset;
        while sequence < link.payments && page.len() < limit {
            if let Some(payment) = storage::read_payment(&env, id, sequence) {
                page.push_back(payment);
            }
            sequence += 1;
        }
        Ok(page)
    }

    pub fn totals_of(env: Env, merchant: Address) -> Totals {
        storage::read_totals(&env, &merchant)
    }

    /// Lifetime amount a merchant has collected in one token.
    pub fn volume_of(env: Env, merchant: Address, token: Address) -> i128 {
        storage::read_volume(&env, &merchant, &token)
    }

    pub fn link_count(env: Env) -> u64 {
        storage::peek_next_id(&env)
    }
}
