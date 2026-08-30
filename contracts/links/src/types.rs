use soroban_sdk::{contracterror, contracttype, Address};

/// Longest a link may stay payable. Bounds how far ahead storage rent must be
/// paid for, and keeps an abandoned link from lingering forever.
pub const MAX_LIFETIME: u64 = 365 * 24 * 60 * 60;

/// Page size ceiling on the list views, so one call cannot blow the read budget.
pub const MAX_PAGE: u32 = 100;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// No link exists with this id.
    NotFound = 1,
    /// The merchant closed this link.
    Closed = 2,
    /// The link passed its expiry.
    Expired = 3,
    /// The link has taken all the payments it was created to accept.
    Full = 4,
    /// This link asks for an exact amount and the payment did not match it.
    WrongAmount = 5,
    /// Amounts must be strictly positive.
    InvalidAmount = 6,
    /// Only the merchant who created the link may do this.
    NotMerchant = 7,
    /// Lifetime must be positive and no longer than MAX_LIFETIME.
    InvalidLifetime = 8,
    /// A page request larger than MAX_PAGE.
    PageTooLarge = 9,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Status {
    Open,
    Closed,
}

/// A request for payment.
///
/// `amount == 0` lets the payer choose what to send, which is what turns the
/// same primitive into a tip jar or a donation page. `max_payments == 0` means
/// the link stays payable until it expires or the merchant closes it.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Link {
    pub id: u64,
    pub merchant: Address,
    pub token: Address,
    pub amount: i128,
    pub max_payments: u32,
    pub payments: u32,
    pub collected: i128,
    pub status: Status,
    pub created_at: u64,
    pub expires_at: u64,
}

/// A settled payment. Written in the same transaction as the transfer, so a
/// merchant's records cannot drift from what the chain actually did.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Payment {
    pub link: u64,
    pub payer: Address,
    pub amount: i128,
    pub at: u64,
}

/// Running totals for a merchant, kept as counters so the dashboard never has
/// to page through history to show a headline number.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, Default)]
pub struct Totals {
    pub links: u32,
    pub payments: u32,
}

#[contracttype]
pub enum DataKey {
    NextId,
    Link(u64),
    /// (link id, sequence) -> Payment
    Payment(u64, u32),
    /// merchant -> Totals
    Totals(Address),
    /// (merchant, sequence) -> link id
    MerchantLink(Address, u32),
    /// (merchant, token) -> lifetime amount collected
    Volume(Address, Address),
}
