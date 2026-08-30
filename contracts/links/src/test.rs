#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

use crate::{Error, Status, TallyLinks, TallyLinksClient};

const START: u64 = 1_700_000_000;
const WEEK: u64 = 7 * 24 * 60 * 60;

struct Ctx<'a> {
    env: Env,
    links: TallyLinksClient<'a>,
    contract: Address,
    token: Address,
    coin: TokenClient<'a>,
    merchant: Address,
    payer: Address,
    stranger: Address,
}

impl Ctx<'_> {
    fn advance(&self, seconds: u64) {
        let now = self.env.ledger().timestamp();
        self.env.ledger().set_timestamp(now + seconds);
    }

    /// What the merchant has actually received.
    fn merchant_balance(&self) -> i128 {
        self.coin.balance(&self.merchant)
    }

    /// Should be zero after every single operation, forever.
    fn contract_balance(&self) -> i128 {
        self.coin.balance(&self.contract)
    }
}

fn setup() -> Ctx<'static> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(START);

    let issuer = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(issuer);
    let token = asset.address();

    let contract = env.register(TallyLinks, ());
    let payer = Address::generate(&env);
    StellarAssetClient::new(&env, &token).mint(&payer, &10_000);

    Ctx {
        links: TallyLinksClient::new(&env, &contract),
        coin: TokenClient::new(&env, &token),
        contract,
        token,
        merchant: Address::generate(&env),
        payer,
        stranger: Address::generate(&env),
        env,
    }
}

// ----- creating links -----

#[test]
fn a_new_link_records_its_terms() {
    let ctx = setup();
    let id = ctx.links.create(&ctx.merchant, &ctx.token, &250, &1, &WEEK);

    let link = ctx.links.link(&id);
    assert_eq!(link.merchant, ctx.merchant);
    assert_eq!(link.amount, 250);
    assert_eq!(link.max_payments, 1);
    assert_eq!(link.payments, 0);
    assert_eq!(link.status, Status::Open);
    assert_eq!(link.expires_at, START + WEEK);
    assert!(ctx.links.payable(&id));
}

#[test]
fn ids_are_handed_out_in_order() {
    let ctx = setup();
    assert_eq!(
        ctx.links.create(&ctx.merchant, &ctx.token, &1, &0, &WEEK),
        0
    );
    assert_eq!(
        ctx.links.create(&ctx.merchant, &ctx.token, &1, &0, &WEEK),
        1
    );
    assert_eq!(ctx.links.link_count(), 2);
}

#[test]
fn a_negative_price_is_rejected() {
    let ctx = setup();
    assert_eq!(
        ctx.links
            .try_create(&ctx.merchant, &ctx.token, &-1, &1, &WEEK),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn a_link_must_have_a_sane_lifetime() {
    let ctx = setup();
    assert_eq!(
        ctx.links.try_create(&ctx.merchant, &ctx.token, &1, &1, &0),
        Err(Ok(Error::InvalidLifetime))
    );
    assert_eq!(
        ctx.links
            .try_create(&ctx.merchant, &ctx.token, &1, &1, &(400 * 24 * 60 * 60)),
        Err(Ok(Error::InvalidLifetime))
    );
}

// ----- paying -----

/// The property the whole design rests on: money goes payer to merchant, and
/// the contract is never holding any of it.
#[test]
fn payment_goes_straight_to_the_merchant() {
    let ctx = setup();
    let id = ctx.links.create(&ctx.merchant, &ctx.token, &250, &1, &WEEK);

    ctx.links.pay(&id, &ctx.payer, &250);

    assert_eq!(ctx.merchant_balance(), 250);
    assert_eq!(ctx.coin.balance(&ctx.payer), 9_750);
    assert_eq!(ctx.contract_balance(), 0, "the contract must never custody");
}

#[test]
fn a_fixed_price_link_refuses_the_wrong_amount() {
    let ctx = setup();
    let id = ctx.links.create(&ctx.merchant, &ctx.token, &250, &1, &WEEK);

    assert_eq!(
        ctx.links.try_pay(&id, &ctx.payer, &249),
        Err(Ok(Error::WrongAmount))
    );
    assert_eq!(
        ctx.links.try_pay(&id, &ctx.payer, &251),
        Err(Ok(Error::WrongAmount))
    );
    assert_eq!(ctx.merchant_balance(), 0);
}

/// `amount == 0` is what turns the same primitive into a tip jar.
#[test]
fn an_open_amount_link_takes_whatever_is_sent() {
    let ctx = setup();
    let id = ctx.links.create(&ctx.merchant, &ctx.token, &0, &0, &WEEK);

    ctx.links.pay(&id, &ctx.payer, &5);
    ctx.links.pay(&id, &ctx.payer, &500);

    assert_eq!(ctx.merchant_balance(), 505);
    assert_eq!(ctx.links.link(&id).collected, 505);
    assert_eq!(ctx.contract_balance(), 0);
}

#[test]
fn a_payment_must_be_positive() {
    let ctx = setup();
    let id = ctx.links.create(&ctx.merchant, &ctx.token, &0, &0, &WEEK);
    assert_eq!(
        ctx.links.try_pay(&id, &ctx.payer, &0),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn paying_an_unknown_link_fails() {
    let ctx = setup();
    assert_eq!(
        ctx.links.try_pay(&99, &ctx.payer, &1),
        Err(Ok(Error::NotFound))
    );
}

// ----- limits -----

#[test]
fn a_single_use_invoice_can_only_be_paid_once() {
    let ctx = setup();
    let id = ctx.links.create(&ctx.merchant, &ctx.token, &250, &1, &WEEK);

    ctx.links.pay(&id, &ctx.payer, &250);

    assert!(!ctx.links.payable(&id));
    assert_eq!(
        ctx.links.try_pay(&id, &ctx.payer, &250),
        Err(Ok(Error::Full))
    );
    assert_eq!(ctx.merchant_balance(), 250);
}

#[test]
fn a_capped_link_stops_at_its_capacity() {
    let ctx = setup();
    let id = ctx.links.create(&ctx.merchant, &ctx.token, &100, &3, &WEEK);

    for _ in 0..3 {
        ctx.links.pay(&id, &ctx.payer, &100);
    }

    assert_eq!(ctx.links.link(&id).payments, 3);
    assert_eq!(
        ctx.links.try_pay(&id, &ctx.payer, &100),
        Err(Ok(Error::Full))
    );
    assert_eq!(ctx.merchant_balance(), 300);
}

#[test]
fn an_expired_link_stops_taking_money() {
    let ctx = setup();
    let id = ctx.links.create(&ctx.merchant, &ctx.token, &100, &0, &WEEK);

    ctx.advance(WEEK + 1);

    assert!(!ctx.links.payable(&id));
    assert_eq!(
        ctx.links.try_pay(&id, &ctx.payer, &100),
        Err(Ok(Error::Expired))
    );
}

// ----- closing -----

#[test]
fn a_merchant_can_close_their_link() {
    let ctx = setup();
    let id = ctx.links.create(&ctx.merchant, &ctx.token, &100, &0, &WEEK);
    ctx.links.pay(&id, &ctx.payer, &100);

    ctx.links.close(&ctx.merchant, &id);

    assert_eq!(ctx.links.link(&id).status, Status::Closed);
    assert!(!ctx.links.payable(&id));
    assert_eq!(
        ctx.links.try_pay(&id, &ctx.payer, &100),
        Err(Ok(Error::Closed))
    );
    // Closing does not claw anything back: that payment was already theirs.
    assert_eq!(ctx.merchant_balance(), 100);
}

#[test]
fn a_stranger_cannot_close_someone_elses_link() {
    let ctx = setup();
    let id = ctx.links.create(&ctx.merchant, &ctx.token, &100, &0, &WEEK);

    assert_eq!(
        ctx.links.try_close(&ctx.stranger, &id),
        Err(Ok(Error::NotMerchant))
    );
    assert!(ctx.links.payable(&id));
}

#[test]
fn closing_twice_is_rejected() {
    let ctx = setup();
    let id = ctx.links.create(&ctx.merchant, &ctx.token, &100, &0, &WEEK);
    ctx.links.close(&ctx.merchant, &id);

    assert_eq!(
        ctx.links.try_close(&ctx.merchant, &id),
        Err(Ok(Error::Closed))
    );
}

// ----- records -----

#[test]
fn totals_and_volume_accumulate_per_merchant() {
    let ctx = setup();
    let one = ctx.links.create(&ctx.merchant, &ctx.token, &100, &0, &WEEK);
    let two = ctx.links.create(&ctx.merchant, &ctx.token, &50, &0, &WEEK);

    ctx.links.pay(&one, &ctx.payer, &100);
    ctx.links.pay(&two, &ctx.payer, &50);
    ctx.links.pay(&two, &ctx.payer, &50);

    let totals = ctx.links.totals_of(&ctx.merchant);
    assert_eq!(totals.links, 2);
    assert_eq!(totals.payments, 3);
    assert_eq!(ctx.links.volume_of(&ctx.merchant, &ctx.token), 200);
}

#[test]
fn one_merchants_numbers_do_not_leak_into_anothers() {
    let ctx = setup();
    let mine = ctx.links.create(&ctx.merchant, &ctx.token, &100, &0, &WEEK);
    ctx.links.create(&ctx.stranger, &ctx.token, &100, &0, &WEEK);
    ctx.links.pay(&mine, &ctx.payer, &100);

    assert_eq!(ctx.links.totals_of(&ctx.merchant).payments, 1);
    assert_eq!(ctx.links.totals_of(&ctx.stranger).payments, 0);
    assert_eq!(ctx.links.volume_of(&ctx.stranger, &ctx.token), 0);
}

#[test]
fn payments_are_recorded_in_order() {
    let ctx = setup();
    let id = ctx.links.create(&ctx.merchant, &ctx.token, &0, &0, &WEEK);
    ctx.links.pay(&id, &ctx.payer, &10);
    ctx.advance(60);
    ctx.links.pay(&id, &ctx.payer, &20);

    let page = ctx.links.payments_of(&id, &0, &10);
    assert_eq!(page.len(), 2);
    assert_eq!(page.get(0).unwrap().amount, 10);
    assert_eq!(page.get(1).unwrap().amount, 20);
    assert_eq!(page.get(1).unwrap().at, START + 60);
    assert_eq!(page.get(0).unwrap().payer, ctx.payer);
}

#[test]
fn a_merchants_links_come_back_newest_first() {
    let ctx = setup();
    let first = ctx.links.create(&ctx.merchant, &ctx.token, &1, &0, &WEEK);
    let second = ctx.links.create(&ctx.merchant, &ctx.token, &2, &0, &WEEK);
    let third = ctx.links.create(&ctx.merchant, &ctx.token, &3, &0, &WEEK);

    let page = ctx.links.links_of(&ctx.merchant, &0, &2);
    assert_eq!(page.len(), 2);
    assert_eq!(page.get(0).unwrap().id, third);
    assert_eq!(page.get(1).unwrap().id, second);

    let next = ctx.links.links_of(&ctx.merchant, &2, &2);
    assert_eq!(next.len(), 1);
    assert_eq!(next.get(0).unwrap().id, first);
}

#[test]
fn an_oversized_page_is_refused() {
    let ctx = setup();
    assert_eq!(
        ctx.links.try_links_of(&ctx.merchant, &0, &1_000),
        Err(Ok(Error::PageTooLarge))
    );
}

#[test]
fn a_merchant_with_no_links_reads_as_empty_rather_than_failing() {
    let ctx = setup();
    assert_eq!(ctx.links.links_of(&ctx.stranger, &0, &10).len(), 0);
    assert_eq!(ctx.links.totals_of(&ctx.stranger).links, 0);
}

#[test]
fn many_payers_can_settle_the_same_link() {
    let ctx = setup();
    let id = ctx.links.create(&ctx.merchant, &ctx.token, &100, &0, &WEEK);

    for _ in 0..3 {
        let buyer = Address::generate(&ctx.env);
        StellarAssetClient::new(&ctx.env, &ctx.token).mint(&buyer, &100);
        ctx.links.pay(&id, &buyer, &100);
    }

    assert_eq!(ctx.merchant_balance(), 300);
    assert_eq!(ctx.links.payments_of(&id, &0, &10).len(), 3);
    assert_eq!(ctx.contract_balance(), 0);
}
