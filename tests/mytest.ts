/** anchor-escrow.ts

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
  const marketAccount1 = anchor.web3.Keypair.generate();
  const mintAuthority = anchor.web3.Keypair.generate();
  const hostAccount = anchor.web3.Keypair.generate();
  const takerMainAccount = anchor.web3.Keypair.generate();
  const payer = anchor.web3.Keypair.generate();


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

    /*initializerTokenAccount1 = await mint.createAccount(hostAccount.publicKey);
    initializerTokenAccount2 = await mint.createAccount(hostAccount.publicKey);

    await mint.mintTo(
      initializerTokenAccount1,
      mintAuthority.publicKey,
      [mintAuthority],
      initializerAmount
    );

    await mint.mintTo(
      initializerTokenAccount2,
      mintAuthority.publicKey,
      [mintAuthority],
      takerAmount
    );

    let account1 = await mint.getAccountInfo(initializerTokenAccount1);
    let account2 = await mint.getAccountInfo(initializerTokenAccount2);

    assert.ok(account1.amount.toNumber() == initializerAmount);
    assert.ok(account2.amount.toNumber() == takerAmount);
    
  });

  it("Initialize marketplace", async () => {
    const [_vault_account_pda, _vault_account_bump] = await PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("marketplace"))],
      program.programId
    );
    vault_account_pda = _vault_account_pda;
    vault_account_bump = _vault_account_bump;

    await program.rpc.initialize(
      vault_account_bump,
      new anchor.BN(initializerAmount),
      {
        accounts: {
          initializer: hostAccount.publicKey,
          vaultAccount: vault_account_pda,
          mint: mint.publicKey,
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
    //console.log(accounts);
    //console.log(TOKEN_PROGRAM_ID);
    accounts.forEach(async element => {
      //console.log(element.account.owner);
      //console.log(element.account.lamports);
    });

    //console.log(hostAccount.publicKey);
    //let valut_account = await conn.getAccountInfo(vault_account_pda);
    //console.log(valut_account);
    // Check that the values in the escrow account match what we expect.
    //assert.ok(_marketAccount.initializerKey.equals(hostAccount.publicKey));
    //assert.ok(_marketAccount.amount.toNumber() == initializerAmount);
  });

  //it("Buy state", async () => {
    const [_vault_account_pda, _vault_account_bump] = await PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("marketplace"))],
      program.programId
    );
    vault_account_pda = _vault_account_pda;
    vault_account_bump = _vault_account_bump;

    await program.rpc.buy({
      accounts: {
        initializer: hostAccount.publicKey,
        vaultAccount: vault_account_pda,
        mint: mint.publicKey,
        marketAccount: takerMainAccount.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [hostAccount]
    });

    //initializerTokenAccount2 = await mint.createAccount(marketAccount.publicKey);
    
    console.log(initializerTokenAccount1);
  });//

  
  it("Initialize marketplace", async () => {
    const [_vault_account_pda, _vault_account_bump] = await PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("marketplace"))],
      program.programId
    );
    vault_account_pda = _vault_account_pda;
    vault_account_bump = _vault_account_bump;

    await program.rpc.initialize(
      vault_account_bump,
      new anchor.BN(initializerAmount),
      {
        accounts: {
          initializer: hostAccount.publicKey,
          vaultAccount: vault_account_pda,
          mint: mint.publicKey,
          marketAccount: marketAccount1.publicKey,
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
    //console.log(accounts);
    //console.log(TOKEN_PROGRAM_ID);
    accounts.forEach(async element => {
      //console.log(element.account.owner);
      //console.log(element.account.lamports);
    });

    //console.log(hostAccount.publicKey);
    //let valut_account = await conn.getAccountInfo(vault_account_pda);
    //console.log(valut_account);
    // Check that the values in the escrow account match what we expect.
    //assert.ok(_marketAccount.initializerKey.equals(hostAccount.publicKey));
    //assert.ok(_marketAccount.amount.toNumber() == initializerAmount);
  });

  it("List state", async () => {
    const conn = new web3.Connection(network, opts);
    const accounts = await conn.getParsedProgramAccounts(
      TOKEN_PROGRAM_ID,
      {
        filters: [
          {
            dataSize: 165, // number of bytes
          },
          {
            memcmp: {
              offset: 32, // number of bytes
              bytes: hostAccount.publicKey.toBase58(), // base58 encoded string
            },
          },
        ],
      }
    );

    const accountss = await conn.getParsedTokenAccountsByOwner(
      hostAccount.publicKey, 
      {
            mint : mint.publicKey,
            programId: TOKEN_PROGRAM_ID,
      });

    //console.log(accounts);
    //console.log(accountss);

    const temp = await program.account.marketAccount.all();
    console.log(temp);

    accountss.value.forEach(async element => {
      //let balance = await conn.getTokenAccountBalance(element.pubkey);
      //console.log(element.pubkey, balance.value.amount);
      let _marketAccount = await program.account.marketAccount.fetch(
        element.pubkey
      );
      console.log(_marketAccount);
      //console.log(element.account.owner);
      //console.log(element.account.data);        
    }); 
  });
});

*/