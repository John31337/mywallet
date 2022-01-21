// anchor-escrow.ts

import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { Marketplace } from '../target/types/marketplace';
import { PublicKey, SystemProgram, Transaction, TokenAccountsFilter } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { assert } from "chai";
import * as web3 from '@solana/web3.js';

describe('anchor-escrow', () => {

  // Configure the client to use the local cluster.
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Marketplace as Program<Marketplace>;

  let mint = null;
  let initializerTokenAccount1 = null;
  let initializerTokenAccount2 = null;
  let vault_account_pda = null;
  let vault_account_bump = null;
  let vault_authority_pda = null;
  
  
  const takerAmount = 1000;
  const initializerAmount = 500;

  const marketAccount = anchor.web3.Keypair.generate();
  const mintAuthority = anchor.web3.Keypair.generate();
  const hostAccount = anchor.web3.Keypair.generate();
  const tokenAccount1 = anchor.web3.Keypair.generate();
  const payer = anchor.web3.Keypair.generate();
  const buyer1 = anchor.web3.Keypair.generate();


  const opts = "confirmed";
  const network = "http://127.0.0.1:8899";

  it("Initialize program state", async () => {
    // Airdropping tokens to a payer.
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(payer.publicKey, 10000000000),
      "confirmed"
    );

    // Fund Main Accounts
    await provider.send(
      (() => {
        const tx = new Transaction();
        tx.add(
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: hostAccount.publicKey,
            lamports: 1000000000,
          }),
        );
        return tx;
      })(),
      [payer]
    );

    mint = await Token.createMint(
      provider.connection,
      payer,
      mintAuthority.publicKey,
      null,
      100,
      TOKEN_PROGRAM_ID
    );   
  });


  it("AddNFT marketplace", async () => {
    const [_vault_account_pda, _vault_account_bump] = await PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("marketplace"))],
      program.programId
    );
    vault_account_pda = _vault_account_pda;
    vault_account_bump = _vault_account_bump;

    console.log(vault_account_pda, vault_account_bump);

    await program.rpc.addNft(
      vault_account_bump,
      new anchor.BN(initializerAmount),
      {
        accounts: {
          initializer: hostAccount.publicKey,
          mint: mint.publicKey,
          tokenAccount: vault_account_pda,
          marketAccount: marketAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        instructions: [
          await program.account.marketAccount.createInstruction(marketAccount),
        ],
        signers: [hostAccount, marketAccount],
      }
    );

    const conn = new web3.Connection(network, opts);
    const accounts = await conn.getProgramAccounts(TOKEN_PROGRAM_ID);
    /*console.log(accounts);

    console.log(marketAccount.publicKey); 
    console.log(mintAuthority.publicKey);
    console.log(hostAccount.publicKey);
    console.log(takerMainAccount.publicKey);
    console.log(payer.publicKey);*/
  });

  it("List state", async () => {
    const accounts = await program.account.marketAccount.all();
    accounts.forEach(async element => {
      //console.log(element);
      let account = await program.account.marketAccount.fetch(element.publicKey);
      console.log("Created owner", account.ownerKey);
    });
  });

  it("Buy Token", async () => {
    const [_vault_account_pda, _vault_account_bump] = await PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("marketplace"))],
      program.programId
    );
    vault_account_pda = _vault_account_pda;
    vault_account_bump = _vault_account_bump;

    console.log(vault_account_pda, vault_account_bump);

    await program.rpc.buy(
      {
        accounts: {
          initializer: hostAccount.publicKey,
          marketAccount: marketAccount.publicKey,
          tokenAccount: vault_account_pda,
          buyerAccount: buyer1.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [hostAccount],
      }
    );

    //const conn = new web3.Connection(network, opts);
    //const accounts = await conn.getProgramAccounts(TOKEN_PROGRAM_ID);
    //console.log(accounts);
  });
  
  it("List state", async () => {
    const accounts = await program.account.marketAccount.all();
    accounts.forEach(async element => {
      //console.log(element);
      let account = await program.account.marketAccount.fetch(element.publicKey);
      console.log("Added owner", account.ownerKey);
    });
  });

});

