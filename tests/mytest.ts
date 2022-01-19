// anchor-escrow.ts

import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { Marketplace } from '../target/types/marketplace';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { assert } from "chai";
import * as NFTs from '@primenums/solana-nft-tools';
import * as web3 from '@solana/web3.js';
import {toPublicKey} from '@primenums/solana-nft-tools/lib/utils.js'

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
  const takerMainAccount = anchor.web3.Keypair.generate();
  const payer = anchor.web3.Keypair.generate();


  const opts = "processed";
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

    initializerTokenAccount1 = await mint.createAccount(hostAccount.publicKey);
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

  it("List state", async () => {
    const conn = new web3.Connection(network, opts);
    let allMyNFTs = await NFTs.getMintTokensByOwner(conn, hostAccount.publicKey);

    allMyNFTs.forEach(async element => {
      let mintPublicKey = toPublicKey(element);
      try {
        let largestAccs = await conn.getTokenLargestAccounts(mintPublicKey, opts);
        console.log(element, largestAccs.value[0].amount);
      } catch (err) {
        return {
          error: err.message
        };
      }
    });
  });


  it("Initialize marketplace", async () => {
    const [_vault_account_pda, _vault_account_bump] = await PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("marketplace"))],
      program.programId
    );
    vault_account_pda = _vault_account_pda;
    vault_account_bump = _vault_account_bump;

    const [_vault_authority_pda, _vault_authority_bump] = await PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("market"))],
      program.programId
    );
    vault_authority_pda = _vault_authority_pda;

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
        signers: [marketAccount, hostAccount],
      }
    );

    let _marketAccount = await program.account.marketAccount.fetch(
      marketAccount.publicKey
    );

    // Check that the values in the escrow account match what we expect.
    assert.ok(_marketAccount.initializerKey.equals(hostAccount.publicKey));
    assert.ok(_marketAccount.amount.toNumber() == initializerAmount);
  });

  it("Buy state", async () => {
    await program.rpc.buy({
      accounts: {
        initializer: hostAccount.publicKey,
        vaultAccount: vault_account_pda,
        mint: mint.publicKey,
        marketAccount: marketAccount.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [hostAccount]
    });

    //initializerTokenAccount2 = await mint.createAccount(marketAccount.publicKey);
    
    console.log(marketAccount);
  });
});