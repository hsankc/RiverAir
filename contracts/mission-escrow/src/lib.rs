#![no_std]
//! RiverAir mission escrow.
//!
//! A drone mission is priced in Turkish lira and settled in USDC. The lira
//! amount and the TRY/USDC rate come from the anchor's SEP-38 quote at the
//! moment the mission is funded; both are recorded here so the payout is
//! auditable against the quote the customer actually saw.
//!
//! Settlement is gated on a Reflector price feed. Before any USDC leaves the
//! escrow the contract reads the feed and refuses to pay when the quote is
//! stale or when USDC has drifted off its dollar peg beyond a configured
//! tolerance. A mission cannot be completed while the oracle is unhealthy.
//!
//! On testnet Reflector carries USDC but not TRY, so the peg check runs
//! against USDC/USD and the lira rate is carried in from SEP-38. On mainnet
//! the fiat feed does carry TRY, and `settlement_usdc` can derive the payout
//! entirely on-chain — see `README.md`.

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    token, Address, BytesN, Env, Symbol,
};

// ---------------------------------------------------------------- Reflector

/// Price feed reading, as returned by the deployed Reflector contract.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PriceData {
    pub price: i128,
    pub timestamp: u64,
}

/// Reflector's asset selector. Variant order is part of the XDR encoding and
/// must match the deployed contract: `Stellar` first, then `Other`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Asset {
    Stellar(Address),
    Other(Symbol),
}

/// The slice of Reflector we call. The deployed contract is the newer "Pulse"
/// build, which does not expose `x_last_price` or `twap` — only mirror what is
/// actually there.
#[contractclient(name = "ReflectorClient")]
pub trait ReflectorOracle {
    fn lastprice(env: Env, asset: Asset) -> Option<PriceData>;
    fn decimals(env: Env) -> u32;
    fn resolution(env: Env) -> u32;
}

// ------------------------------------------------------------------- Types

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Status {
    /// Funded by the customer, no operator yet.
    Open,
    /// An operator has taken the mission.
    Assigned,
    /// Flown, verified, and paid out.
    Completed,
    /// Refunded to the customer.
    Cancelled,
}

#[contracttype]
#[derive(Clone)]
pub struct Mission {
    pub id: u32,
    pub client: Address,
    pub operator: Option<Address>,
    /// USDC held by this contract for the mission, 7 decimals.
    pub amount: i128,
    /// Price the customer agreed to, in lira, 2 decimals.
    pub try_amount: i128,
    /// TRY per USDC from the SEP-38 quote, scaled by 1e7.
    pub quote_rate: i128,
    pub status: Status,
    pub created_at: u64,
    pub deadline: u64,
    /// Hash of the flight record submitted on completion.
    pub proof: Option<BytesN<32>>,
}

#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub admin: Address,
    /// USDC token contract (the anchor's issuer, via its SAC).
    pub usdc: Address,
    /// Reflector feed carrying the settlement asset.
    pub oracle: Address,
    /// Asset symbol to read from the feed, e.g. `USDC`.
    pub oracle_asset: Symbol,
    /// Reject a price older than this many seconds.
    pub max_price_age: u64,
    /// Allowed drift from the dollar peg, in basis points.
    pub depeg_bps: u32,
}

#[contracttype]
pub enum DataKey {
    Config,
    Mission(u32),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    MissionExists = 2,
    MissionNotFound = 3,
    WrongStatus = 4,
    NotOperator = 5,
    NotAuthorized = 6,
    InvalidAmount = 7,
    DeadlinePassed = 8,
    /// Reflector returned nothing for the configured asset.
    NoPrice = 9,
    /// The feed's newest price is older than `max_price_age`.
    StalePrice = 10,
    /// USDC has drifted off the dollar peg beyond `depeg_bps`.
    Depegged = 11,
}

// ------------------------------------------------------------------ Events

#[contractevent]
pub struct MissionFunded {
    #[topic]
    pub client: Address,
    pub id: u32,
    pub amount: i128,
    pub try_amount: i128,
    pub quote_rate: i128,
}

#[contractevent]
pub struct MissionAssigned {
    #[topic]
    pub operator: Address,
    pub id: u32,
}

#[contractevent]
pub struct MissionCompleted {
    #[topic]
    pub operator: Address,
    pub id: u32,
    pub amount: i128,
    /// Oracle price used to clear the settlement, at the feed's own decimals.
    pub oracle_price: i128,
}

#[contractevent]
pub struct MissionCancelled {
    #[topic]
    pub client: Address,
    pub id: u32,
    pub amount: i128,
}

// ------------------------------------------------------------------ Ledger

/// Roughly 30 days of ledgers at 5 s close time.
const BUMP_AMOUNT: u32 = 518_400;
const BUMP_THRESHOLD: u32 = int_min(BUMP_AMOUNT / 2, 500_000);

const fn int_min(a: u32, b: u32) -> u32 {
    if a < b {
        a
    } else {
        b
    }
}

// ---------------------------------------------------------------- Contract

#[contract]
pub struct MissionEscrow;

#[contractimpl]
impl MissionEscrow {
    pub fn __constructor(
        env: Env,
        admin: Address,
        usdc: Address,
        oracle: Address,
        oracle_asset: Symbol,
        max_price_age: u64,
        depeg_bps: u32,
    ) {
        env.storage().instance().set(
            &DataKey::Config,
            &Config {
                admin,
                usdc,
                oracle,
                oracle_asset,
                max_price_age,
                depeg_bps,
            },
        );
    }

    /// Lock a mission's payment. Moves `amount` USDC from the customer into
    /// this contract; the customer signs for the transfer.
    pub fn fund_mission(
        env: Env,
        id: u32,
        client: Address,
        amount: i128,
        try_amount: i128,
        quote_rate: i128,
        deadline: u64,
    ) -> Result<(), Error> {
        client.require_auth();

        if amount <= 0 || try_amount <= 0 || quote_rate <= 0 {
            return Err(Error::InvalidAmount);
        }
        if env.storage().persistent().has(&DataKey::Mission(id)) {
            return Err(Error::MissionExists);
        }
        let now = env.ledger().timestamp();
        if deadline <= now {
            return Err(Error::DeadlinePassed);
        }

        let cfg = Self::config(&env)?;
        token::TokenClient::new(&env, &cfg.usdc).transfer(
            &client,
            &env.current_contract_address(),
            &amount,
        );

        let mission = Mission {
            id,
            client: client.clone(),
            operator: None,
            amount,
            try_amount,
            quote_rate,
            status: Status::Open,
            created_at: now,
            deadline,
            proof: None,
        };
        Self::put(&env, &mission);

        MissionFunded {
            client,
            id,
            amount,
            try_amount,
            quote_rate,
        }
        .publish(&env);

        Ok(())
    }

    /// Take an open mission. The operator signs, so a drone operator claims
    /// work directly rather than waiting to be granted it.
    pub fn assign(env: Env, id: u32, operator: Address) -> Result<(), Error> {
        operator.require_auth();

        let mut mission = Self::get(&env, id)?;
        if mission.status != Status::Open {
            return Err(Error::WrongStatus);
        }
        if env.ledger().timestamp() >= mission.deadline {
            return Err(Error::DeadlinePassed);
        }

        mission.operator = Some(operator.clone());
        mission.status = Status::Assigned;
        Self::put(&env, &mission);

        MissionAssigned { operator, id }.publish(&env);
        Ok(())
    }

    /// Release the escrow to the operator against a flight-record hash.
    ///
    /// Reads Reflector first: a stale feed or a depegged USDC aborts the
    /// settlement and the funds stay locked.
    pub fn complete(env: Env, id: u32, proof: BytesN<32>) -> Result<i128, Error> {
        let mut mission = Self::get(&env, id)?;
        if mission.status != Status::Assigned {
            return Err(Error::WrongStatus);
        }
        let operator = mission.operator.clone().ok_or(Error::NotOperator)?;
        operator.require_auth();

        let cfg = Self::config(&env)?;
        let price = Self::checked_price(&env, &cfg)?;

        token::TokenClient::new(&env, &cfg.usdc).transfer(
            &env.current_contract_address(),
            &operator,
            &mission.amount,
        );

        mission.status = Status::Completed;
        mission.proof = Some(proof);
        Self::put(&env, &mission);

        MissionCompleted {
            operator,
            id,
            amount: mission.amount,
            oracle_price: price.price,
        }
        .publish(&env);

        Ok(mission.amount)
    }

    /// Refund the customer. Open missions can be pulled by the customer at any
    /// time; once assigned, only the deadline or the admin releases them.
    pub fn cancel(env: Env, id: u32) -> Result<i128, Error> {
        let mut mission = Self::get(&env, id)?;
        let cfg = Self::config(&env)?;

        match mission.status {
            Status::Open => mission.client.require_auth(),
            Status::Assigned => {
                if env.ledger().timestamp() < mission.deadline {
                    cfg.admin.require_auth();
                } else {
                    mission.client.require_auth();
                }
            }
            _ => return Err(Error::WrongStatus),
        }

        token::TokenClient::new(&env, &cfg.usdc).transfer(
            &env.current_contract_address(),
            &mission.client,
            &mission.amount,
        );

        mission.status = Status::Cancelled;
        Self::put(&env, &mission);

        MissionCancelled {
            client: mission.client.clone(),
            id,
            amount: mission.amount,
        }
        .publish(&env);

        Ok(mission.amount)
    }

    // ------------------------------------------------------------- views

    pub fn get_mission(env: Env, id: u32) -> Result<Mission, Error> {
        Self::get(&env, id)
    }

    pub fn get_config(env: Env) -> Result<Config, Error> {
        Self::config(&env)
    }

    /// The price the next settlement would use. Returns the same errors
    /// `complete` would, so a client can show why a mission cannot be paid out
    /// before anyone signs a transaction.
    pub fn oracle_health(env: Env) -> Result<PriceData, Error> {
        let cfg = Self::config(&env)?;
        Self::checked_price(&env, &cfg)
    }

    /// USDC owed for a lira amount at a given SEP-38 rate, 7 decimals.
    /// Mirrors what the frontend quotes so both sides agree on the figure.
    pub fn settlement_usdc(try_amount: i128, quote_rate: i128) -> Result<i128, Error> {
        if try_amount <= 0 || quote_rate <= 0 {
            return Err(Error::InvalidAmount);
        }
        // try_amount is 2dp and quote_rate is TRY-per-USDC scaled 1e7, so
        // usdc_7dp = (try/100) / (rate/1e7) * 1e7 = try * 1e12 / rate.
        try_amount
            .checked_mul(1_000_000_000_000i128)
            .and_then(|n| n.checked_div(quote_rate))
            .ok_or(Error::InvalidAmount)
    }

    // ---------------------------------------------------------- internals

    /// Read Reflector and reject anything we would not settle against.
    fn checked_price(env: &Env, cfg: &Config) -> Result<PriceData, Error> {
        let oracle = ReflectorClient::new(env, &cfg.oracle);

        let price = oracle
            .lastprice(&Asset::Other(cfg.oracle_asset.clone()))
            .ok_or(Error::NoPrice)?;

        let now = env.ledger().timestamp();
        if now.saturating_sub(price.timestamp) > cfg.max_price_age {
            return Err(Error::StalePrice);
        }

        // The feed quotes against USD, so a healthy USDC sits at 1.0 scaled to
        // the feed's own decimals.
        let one = 10i128
            .checked_pow(oracle.decimals())
            .ok_or(Error::NoPrice)?;
        let drift = (price.price - one).abs();
        let tolerance = one
            .checked_mul(cfg.depeg_bps as i128)
            .and_then(|n| n.checked_div(10_000))
            .ok_or(Error::NoPrice)?;
        if drift > tolerance {
            return Err(Error::Depegged);
        }

        Ok(price)
    }

    fn config(env: &Env) -> Result<Config, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialized)
    }

    fn get(env: &Env, id: u32) -> Result<Mission, Error> {
        let key = DataKey::Mission(id);
        let mission: Mission = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::MissionNotFound)?;
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
        Ok(mission)
    }

    fn put(env: &Env, mission: &Mission) {
        let key = DataKey::Mission(mission.id);
        env.storage().persistent().set(&key, mission);
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
    }
}

#[cfg(test)]
mod test;
