use anchor_lang::prelude::*;
use anchor_spl::token::{ self, Mint, SetAuthority, TokenAccount, Transfer};
use spl_token::instruction::AuthorityType;

declare_id!("AJKJVBUiLsE453wiKgowNtgLtrZUVv5GRsGuBrXY9GCq");

// Program Account (fully implemented)

#[account]
pub struct MarketAccount {
    pub initializer_key: Pubkey,
    pub initializer_market_account: Pubkey,
    pub amount: u64,
}

#[program]
pub mod marketplace {
    use super::*;

    const MARKET_PDA_SEED: &[u8] = b"marketplace";

    pub fn initialize(
        ctx: Context<Initialize>,
        _vault_account_bump: u8,
        initializer_amount: u64,
    ) -> ProgramResult {
        ctx.accounts.market_account.initializer_key = *ctx.accounts.initializer.key;
        ctx.accounts.market_account.amount = initializer_amount;

        let (_vault_authority, _vault_authority_bump) =
        Pubkey::find_program_address(&[MARKET_PDA_SEED], ctx.program_id);

        token::set_authority(
            ctx.accounts.into_set_authority_context(),
            AuthorityType::AccountOwner,
            Some(_vault_authority),
        )?;

        Ok(())
    }

    pub fn buy(ctx: Context<Buy>) -> ProgramResult {
        let (_vault_authority, _vault_authority_bump) =
            Pubkey::find_program_address(&[MARKET_PDA_SEED], ctx.program_id);

        token::transfer(
            ctx.accounts.into_transfer_to_pda_context(),
            ctx.accounts.market_account.amount,
        )?;

        Ok(())
    }

    
}
// Instructions (fully implementated)

#[derive(Accounts)]
#[instruction(vault_account_bump: u8, initializer_amount: u64)]
pub struct Initialize<'info> {
    #[account(mut, signer)]
    pub initializer: AccountInfo<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        seeds = [b"marketplace".as_ref()],
        bump = vault_account_bump,
        payer = initializer,
        token::mint = mint,
        token::authority = initializer,
    )]
    pub vault_account: Account<'info, TokenAccount>,
    #[account(zero)]
    pub market_account: Box<Account<'info, MarketAccount>>,
    pub system_program: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut, signer)]
    pub initializer: AccountInfo<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = market_account.initializer_key == *initializer.key,
        close = initializer
    )]
    pub market_account: Box<Account<'info, MarketAccount>>,
    #[account(mut)]
    pub vault_account: Account<'info, TokenAccount>,
    pub token_program: AccountInfo<'info>,
}



// Utils (fully implemented)

impl<'info> Initialize<'info> {
    fn into_set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            account_or_mint: self.vault_account.to_account_info().clone(),
            current_authority: self.initializer.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
}

impl<'info> Buy<'info> {
    fn into_transfer_to_pda_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.initializer.to_account_info().clone(),
            to: self.vault_account.to_account_info().clone(),
            authority: self.initializer.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
}