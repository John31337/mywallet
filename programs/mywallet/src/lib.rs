use anchor_lang::prelude::*;
use anchor_spl::token::{ self, Mint, SetAuthority, TokenAccount, Transfer, CloseAccount};
use spl_token::instruction::{ AuthorityType };

declare_id!("AJKJVBUiLsE453wiKgowNtgLtrZUVv5GRsGuBrXY9GCq");

// Program Account (fully implemented)

#[account]
pub struct MarketAccount {
    pub initializer_key: Pubkey,
    pub mint_key: Pubkey,
    pub token_key: Pubkey,
    pub owner_key: Pubkey,
    pub amount: u64,
}

#[program]
pub mod marketplace {
    use super::*;

    const MARKET_PDA_SEED: &[u8] = b"marketplace";

    pub fn add_nft(
        ctx: Context<AddNFT>,
        _vault_account_bump: u8,
        initializer_amount: u64,
    ) -> ProgramResult {
        ctx.accounts.market_account.initializer_key = *ctx.accounts.initializer.key;
        ctx.accounts.market_account.amount = initializer_amount;

        let (_vault_authority, _vault_authority_bump) =
        Pubkey::find_program_address(&[MARKET_PDA_SEED], ctx.program_id);

        ctx.accounts.market_account.mint_key = *ctx.accounts.mint.to_account_info().key;
        ctx.accounts.market_account.owner_key = *ctx.accounts.token_account.to_account_info().key;

        token::set_authority(
            ctx.accounts.into_set_authority_context(),
            AuthorityType::AccountOwner,
            Some(_vault_authority),
        )?;

        Ok(())
    }

    pub fn buy(
        ctx: Context<Buy>,
    ) -> ProgramResult {
        let (_vault_authority, _vault_authority_bump) =
        Pubkey::find_program_address(&[MARKET_PDA_SEED], ctx.program_id);
        ctx.accounts.market_account.owner_key = *ctx.accounts.buyer_account.to_account_info().key;
        /*token::set_authority(
            ctx.accounts.into_set_authority_context(),
            AuthorityType::AccountOwner,
            Some(_vault_authority),
        )?;*/


        Ok(())
    }
}


// Instructions (fully implementated)

#[derive(Accounts)]
#[instruction(vault_account_bump: u8, initializer_amount: u64)]
pub struct AddNFT<'info> {
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
    pub token_account: Account<'info, TokenAccount>,
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
    #[account(mut)]
    pub market_account: Box<Account<'info, MarketAccount>>,
    pub token_account: Account<'info, TokenAccount>,
    pub token_program: AccountInfo<'info>,
    pub buyer_account: AccountInfo<'info>,
}

// Utils (fully implemented)

impl<'info> AddNFT<'info> {
    fn into_set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            account_or_mint: self.token_account.to_account_info().clone(),
            current_authority: self.initializer.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
}

impl<'info> Buy<'info> {
    fn into_set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            account_or_mint: self.token_account.to_account_info().clone(),
            current_authority: self.initializer.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
}

