#![cfg(test)]

use super::*;
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Ledger as _},
    token, Address, BytesN, Env,
};

// ------------------------------------------------------------- mock oracle

/// Stands in for Reflector. Holds one price that a test can move around, so we
/// can drive the staleness and depeg branches without a live feed.
#[contract]
pub struct MockOracle;

#[contracttype]
pub enum MockKey {
    Price,
}

#[contractimpl]
impl MockOracle {
    pub fn __constructor(env: Env, price: i128, timestamp: u64) {
        env.storage()
            .instance()
            .set(&MockKey::Price, &PriceData { price, timestamp });
    }

    pub fn set(env: Env, price: i128, timestamp: u64) {
        env.storage()
            .instance()
            .set(&MockKey::Price, &PriceData { price, timestamp });
    }

    pub fn lastprice(env: Env, asset: Asset) -> Option<PriceData> {
        let _ = asset;
        env.storage().instance().get(&MockKey::Price)
    }

    pub fn decimals(_env: Env) -> u32 {
        14
    }

    pub fn resolution(_env: Env) -> u32 {
        300
    }
}

// ------------------------------------------------------------------ harness

/// 1.0 at Reflector's 14 decimals.
const PEG: i128 = 100_000_000_000_000;
const NOW: u64 = 1_700_000_000;
const MAX_AGE: u64 = 900;
const DEPEG_BPS: u32 = 200; // 2%

struct Fixture {
    env: Env,
    escrow: MissionEscrowClient<'static>,
    oracle: MockOracleClient<'static>,
    usdc: token::TokenClient<'static>,
    admin: Address,
    client: Address,
    operator: Address,
}

fn setup() -> Fixture {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.timestamp = NOW);

    let admin = Address::generate(&env);
    let client = Address::generate(&env);
    let operator = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let usdc = token::TokenClient::new(&env, &sac.address());
    token::StellarAssetClient::new(&env, &sac.address()).mint(&client, &1_000_000_000);

    let oracle_id = env.register(MockOracle, (PEG, NOW));
    let oracle = MockOracleClient::new(&env, &oracle_id);

    let escrow_id = env.register(
        MissionEscrow,
        (
            admin.clone(),
            sac.address(),
            oracle_id.clone(),
            symbol_short!("USDC"),
            MAX_AGE,
            DEPEG_BPS,
        ),
    );

    Fixture {
        escrow: MissionEscrowClient::new(&env, &escrow_id),
        oracle,
        usdc,
        admin,
        client,
        operator,
        env,
    }
}

fn proof(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[7u8; 32])
}

/// 250.00 TRY at 49.0290030 TRY/USDC.
const TRY_AMOUNT: i128 = 25_000;
const QUOTE_RATE: i128 = 490_290_030;

// -------------------------------------------------------------------- tests

#[test]
fn funds_assigns_and_pays_out() {
    let f = setup();
    let amount = MissionEscrow::settlement_usdc(TRY_AMOUNT, QUOTE_RATE).unwrap();

    f.escrow.fund_mission(
        &1,
        &f.client,
        &amount,
        &TRY_AMOUNT,
        &QUOTE_RATE,
        &(NOW + 3600),
    );

    // The escrow, not the customer, now holds the money.
    assert_eq!(f.usdc.balance(&f.escrow.address), amount);
    assert_eq!(f.escrow.get_mission(&1).status, Status::Open);

    f.escrow.assign(&1, &f.operator);
    assert_eq!(f.escrow.get_mission(&1).status, Status::Assigned);

    let paid = f.escrow.complete(&1, &proof(&f.env));

    assert_eq!(paid, amount);
    assert_eq!(f.usdc.balance(&f.operator), amount);
    assert_eq!(f.usdc.balance(&f.escrow.address), 0);

    let mission = f.escrow.get_mission(&1);
    assert_eq!(mission.status, Status::Completed);
    assert_eq!(mission.proof, Some(proof(&f.env)));
}

#[test]
fn refuses_to_settle_on_a_stale_feed() {
    let f = setup();
    let amount = MissionEscrow::settlement_usdc(TRY_AMOUNT, QUOTE_RATE).unwrap();

    f.escrow
        .fund_mission(&1, &f.client, &amount, &TRY_AMOUNT, &QUOTE_RATE, &(NOW + 3600));
    f.escrow.assign(&1, &f.operator);

    // Feed goes quiet; ledger moves past the freshness window.
    f.env.ledger().with_mut(|l| l.timestamp = NOW + MAX_AGE + 1);

    assert_eq!(
        f.escrow.try_complete(&1, &proof(&f.env)),
        Err(Ok(Error::StalePrice))
    );
    // Money stays locked rather than paying out against an unknown price.
    assert_eq!(f.usdc.balance(&f.escrow.address), amount);
    assert_eq!(f.escrow.get_mission(&1).status, Status::Assigned);
}

#[test]
fn refuses_to_settle_when_usdc_leaves_its_peg() {
    let f = setup();
    let amount = MissionEscrow::settlement_usdc(TRY_AMOUNT, QUOTE_RATE).unwrap();

    f.escrow
        .fund_mission(&1, &f.client, &amount, &TRY_AMOUNT, &QUOTE_RATE, &(NOW + 3600));
    f.escrow.assign(&1, &f.operator);

    // 0.95 USD — a 5% drift against a 2% tolerance.
    f.oracle.set(&(PEG * 95 / 100), &NOW);

    assert_eq!(
        f.escrow.try_complete(&1, &proof(&f.env)),
        Err(Ok(Error::Depegged))
    );
    assert_eq!(f.usdc.balance(&f.operator), 0);
}

#[test]
fn tolerates_drift_inside_the_band() {
    let f = setup();
    let amount = MissionEscrow::settlement_usdc(TRY_AMOUNT, QUOTE_RATE).unwrap();

    f.escrow
        .fund_mission(&1, &f.client, &amount, &TRY_AMOUNT, &QUOTE_RATE, &(NOW + 3600));
    f.escrow.assign(&1, &f.operator);

    // 0.99 USD sits inside the 2% band.
    f.oracle.set(&(PEG * 99 / 100), &NOW);

    f.escrow.complete(&1, &proof(&f.env));
    assert_eq!(f.usdc.balance(&f.operator), amount);
}

#[test]
fn customer_can_pull_an_unclaimed_mission() {
    let f = setup();
    let amount = MissionEscrow::settlement_usdc(TRY_AMOUNT, QUOTE_RATE).unwrap();
    let before = f.usdc.balance(&f.client);

    f.escrow
        .fund_mission(&1, &f.client, &amount, &TRY_AMOUNT, &QUOTE_RATE, &(NOW + 3600));
    let refunded = f.escrow.cancel(&1);

    assert_eq!(refunded, amount);
    assert_eq!(f.usdc.balance(&f.client), before);
    assert_eq!(f.escrow.get_mission(&1).status, Status::Cancelled);
}

#[test]
fn admin_can_unwind_a_claimed_mission_before_its_deadline() {
    let f = setup();
    let amount = MissionEscrow::settlement_usdc(TRY_AMOUNT, QUOTE_RATE).unwrap();
    let before = f.usdc.balance(&f.client);

    f.escrow
        .fund_mission(&1, &f.client, &amount, &TRY_AMOUNT, &QUOTE_RATE, &(NOW + 3600));
    f.escrow.assign(&1, &f.operator);

    // A drone that took the job and then went dark leaves the customer stuck
    // until the deadline, so the admin can release it. The config's admin is
    // the one the constructor recorded.
    assert_eq!(f.escrow.get_config().admin, f.admin);

    let refunded = f.escrow.cancel(&1);

    assert_eq!(refunded, amount);
    assert_eq!(f.usdc.balance(&f.client), before);
    assert_eq!(f.usdc.balance(&f.operator), 0);
    assert_eq!(f.escrow.get_mission(&1).status, Status::Cancelled);
}

#[test]
fn cancelling_is_not_a_second_payout() {
    let f = setup();
    let amount = MissionEscrow::settlement_usdc(TRY_AMOUNT, QUOTE_RATE).unwrap();

    f.escrow
        .fund_mission(&1, &f.client, &amount, &TRY_AMOUNT, &QUOTE_RATE, &(NOW + 3600));
    f.escrow.assign(&1, &f.operator);
    f.escrow.complete(&1, &proof(&f.env));

    assert_eq!(f.escrow.try_cancel(&1), Err(Ok(Error::WrongStatus)));
    assert_eq!(f.usdc.balance(&f.escrow.address), 0);
}

#[test]
fn a_mission_pays_out_once() {
    let f = setup();
    let amount = MissionEscrow::settlement_usdc(TRY_AMOUNT, QUOTE_RATE).unwrap();

    f.escrow
        .fund_mission(&1, &f.client, &amount, &TRY_AMOUNT, &QUOTE_RATE, &(NOW + 3600));
    f.escrow.assign(&1, &f.operator);
    f.escrow.complete(&1, &proof(&f.env));

    assert_eq!(
        f.escrow.try_complete(&1, &proof(&f.env)),
        Err(Ok(Error::WrongStatus))
    );
    assert_eq!(f.usdc.balance(&f.operator), amount);
}

#[test]
fn an_expired_mission_cannot_be_claimed() {
    let f = setup();
    let amount = MissionEscrow::settlement_usdc(TRY_AMOUNT, QUOTE_RATE).unwrap();

    f.escrow
        .fund_mission(&1, &f.client, &amount, &TRY_AMOUNT, &QUOTE_RATE, &(NOW + 600));
    f.env.ledger().with_mut(|l| l.timestamp = NOW + 601);

    assert_eq!(
        f.escrow.try_assign(&1, &f.operator),
        Err(Ok(Error::DeadlinePassed))
    );
}

#[test]
fn ids_are_not_reused() {
    let f = setup();
    let amount = MissionEscrow::settlement_usdc(TRY_AMOUNT, QUOTE_RATE).unwrap();

    f.escrow
        .fund_mission(&1, &f.client, &amount, &TRY_AMOUNT, &QUOTE_RATE, &(NOW + 3600));

    assert_eq!(
        f.escrow.try_fund_mission(
            &1,
            &f.client,
            &amount,
            &TRY_AMOUNT,
            &QUOTE_RATE,
            &(NOW + 3600)
        ),
        Err(Ok(Error::MissionExists))
    );
}

#[test]
fn rejects_a_mission_worth_nothing() {
    let f = setup();

    assert_eq!(
        f.escrow
            .try_fund_mission(&1, &f.client, &0, &TRY_AMOUNT, &QUOTE_RATE, &(NOW + 3600)),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn quotes_the_same_figure_the_frontend_shows() {
    // 250.00 TRY at 49.0290030 TRY/USDC is 5.0990227 USDC, carried at 7dp.
    let usdc = MissionEscrow::settlement_usdc(TRY_AMOUNT, QUOTE_RATE).unwrap();
    assert_eq!(usdc, 50_990_227);

    assert_eq!(
        MissionEscrow::settlement_usdc(0, QUOTE_RATE),
        Err(Error::InvalidAmount)
    );
}

#[test]
fn oracle_health_reports_what_settlement_would_see() {
    let f = setup();
    assert_eq!(f.escrow.oracle_health().price, PEG);

    f.env.ledger().with_mut(|l| l.timestamp = NOW + MAX_AGE + 1);
    assert_eq!(f.escrow.try_oracle_health(), Err(Ok(Error::StalePrice)));
}
