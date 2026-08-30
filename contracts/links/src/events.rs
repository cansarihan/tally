use soroban_sdk::{contractevent, Address};

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Created {
    #[topic]
    pub id: u64,
    #[topic]
    pub merchant: Address,
    pub token: Address,
    pub amount: i128,
    pub expires_at: u64,
}

/// Emitted in the same transaction as the transfer it describes, so an indexer
/// that trusts this event is never ahead of or behind the money.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Paid {
    #[topic]
    pub id: u64,
    #[topic]
    pub merchant: Address,
    pub payer: Address,
    pub amount: i128,
    pub payments: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ClosedLink {
    #[topic]
    pub id: u64,
    #[topic]
    pub merchant: Address,
    pub collected: i128,
}
