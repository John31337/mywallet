// anchor-escrow.ts

import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { Mywallet } from '../target/types/mywallet';
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

  const program = anchor.workspace.Mywallet as Program<Mywallet>;

  let mintA = null;
  let mintB = null;
  let initializerTokenAccountA = null;
  let initializerTokenAccountB = null;
  let takerTokenAccountA = null;
  let takerTokenAccountB = null;
  let vault_account_pda = null;
  let vault_account_bump = null;
  let vault_authority_pda = null;

  const takerAmount = 1000;
  const initializerAmount = 500;

  const escrowAccount = anchor.web3.Keypair.generate();
  const payer = anchor.web3.Keypair.generate();
  const mintAuthority = anchor.web3.Keypair.generate();
  const initializerMainAccount = anchor.web3.Keypair.generate();
  const takerMainAccount = anchor.web3.Keypair.generate();

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
            toPubkey: initializerMainAccount.publicKey,
            lamports: 1000000000,
          }),
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: takerMainAccount.publicKey,
            lamports: 1000000000,
          })
        );
        return tx;
      })(),
      [payer]
    );

    mintA = await Token.createMint(
      provider.connection,
      payer,
      mintAuthority.publicKey,
      null,
      0,
      TOKEN_PROGRAM_ID
    );

    mintB = await Token.createMint(
      provider.connection,
      payer,
      mintAuthority.publicKey,
      null,
      0,
      TOKEN_PROGRAM_ID
    );

    initializerTokenAccountA = await mintA.createAccount(initializerMainAccount.publicKey);
    takerTokenAccountA = await mintA.createAccount(takerMainAccount.publicKey);

    initializerTokenAccountB = await mintB.createAccount(initializerMainAccount.publicKey);
    takerTokenAccountB = await mintB.createAccount(takerMainAccount.publicKey);

    await mintA.mintTo(
      initializerTokenAccountA,
      mintAuthority.publicKey,
      [mintAuthority],
      initializerAmount
    );

    await mintB.mintTo(
      takerTokenAccountB,
      mintAuthority.publicKey,
      [mintAuthority],
      takerAmount
    );

    let _initializerTokenAccountA = await mintA.getAccountInfo(initializerTokenAccountA);
    let _takerTokenAccountB = await mintB.getAccountInfo(takerTokenAccountB);

    assert.ok(_initializerTokenAccountA.amount.toNumber() == initializerAmount);
    assert.ok(_takerTokenAccountB.amount.toNumber() == takerAmount);
  });

  it("Initialize escrow", async () => {
    const [_vault_account_pda, _vault_account_bump] = await PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("token-seed"))],
      program.programId
    );
    vault_account_pda = _vault_account_pda;
    vault_account_bump = _vault_account_bump;

    const [_vault_authority_pda, _vault_authority_bump] = await PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("escrow"))],
      program.programId
    );
    vault_authority_pda = _vault_authority_pda;

    await program.rpc.initialize(
      vault_account_bump,
      new anchor.BN(initializerAmount),
      new anchor.BN(takerAmount),
      {
        accounts: {
          initializer: initializerMainAccount.publicKey,
          vaultAccount: vault_account_pda,
          mint: mintA.publicKey,
          initializerDepositTokenAccount: initializerTokenAccountA,
          initializerReceiveTokenAccount: initializerTokenAccountB,
          escrowAccount: escrowAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        instructions: [
          await program.account.escrowAccount.createInstruction(escrowAccount),
        ],
        signers: [escrowAccount, initializerMainAccount],
      }
    );

    let _vault = await mintA.getAccountInfo(vault_account_pda);

    let _escrowAccount = await program.account.escrowAccount.fetch(
      escrowAccount.publicKey
    );

    // Check that the new owner is the PDA.
    assert.ok(_vault.owner.equals(vault_authority_pda));

    // Check that the values in the escrow account match what we expect.
    assert.ok(_escrowAccount.initializerKey.equals(initializerMainAccount.publicKey));
    assert.ok(_escrowAccount.initializerAmount.toNumber() == initializerAmount);
    assert.ok(_escrowAccount.takerAmount.toNumber() == takerAmount);
    assert.ok(
      _escrowAccount.initializerDepositTokenAccount.equals(initializerTokenAccountA)
    );
    assert.ok(
      _escrowAccount.initializerReceiveTokenAccount.equals(initializerTokenAccountB)
    );
  });

  it("Exchange escrow state", async () => {
    await program.rpc.exchange({
      accounts: {
        taker: takerMainAccount.publicKey,
        takerDepositTokenAccount: takerTokenAccountB,
        takerReceiveTokenAccount: takerTokenAccountA,
        initializerDepositTokenAccount: initializerTokenAccountA,
        initializerReceiveTokenAccount: initializerTokenAccountB,
        initializer: initializerMainAccount.publicKey,
        escrowAccount: escrowAccount.publicKey,
        vaultAccount: vault_account_pda,
        vaultAuthority: vault_authority_pda,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [takerMainAccount]
    });

    let _takerTokenAccountA = await mintA.getAccountInfo(takerTokenAccountA);
    let _takerTokenAccountB = await mintB.getAccountInfo(takerTokenAccountB);
    let _initializerTokenAccountA = await mintA.getAccountInfo(initializerTokenAccountA);
    let _initializerTokenAccountB = await mintB.getAccountInfo(initializerTokenAccountB);

    //console.log(_takerTokenAccountA.owner, _initializerTokenAccountA.owner, _takerTokenAccountB.owner, _initializerTokenAccountB.owner);
    //console.log(takerTokenAccountA, initializerTokenAccountA, takerTokenAccountB, initializerTokenAccountB);
    //console.log(_initializerTokenAccountA.address._bn);
    const conn = new web3.Connection(network, opts);
    //console.log(initializerMainAccount.publicKey);
    let allMyNFTs = await NFTs.getMintTokensByOwner(conn, initializerMainAccount.publicKey);
    //console.log('allMyNFTs', allMyNFTs);

    allMyNFTs.forEach(async element => {
      let mintPublicKey = toPublicKey(element);
      //console.log(mintPublicKey);
      //let temp = await NFTs.getMintTokenOwner(conn, mintPublicKey);
      //console.log(temp);

      //let largestAccs = [];
      try {
        let largestAccs = await conn.getTokenLargestAccounts(mintPublicKey, opts);
        console.log(element, largestAccs.value[0].amount);
      } catch (err) {
        return {
          error: err.message
        };
      }
    });

    

    assert.ok(_takerTokenAccountA.amount.toNumber() == initializerAmount);
    assert.ok(_initializerTokenAccountA.amount.toNumber() == 0);
    assert.ok(_initializerTokenAccountB.amount.toNumber() == takerAmount);
    assert.ok(_takerTokenAccountB.amount.toNumber() == 0);
  });

  it("Initialize escrow and cancel escrow", async () => {
    // Put back tokens into initializer token A account.
    await mintA.mintTo(
      initializerTokenAccountA,
      mintAuthority.publicKey,
      [mintAuthority],
      initializerAmount
    );

    await program.rpc.initialize(
      vault_account_bump,
      new anchor.BN(initializerAmount),
      new anchor.BN(takerAmount),
      {
        accounts: {
          initializer: initializerMainAccount.publicKey,
          vaultAccount: vault_account_pda,
          mint: mintA.publicKey,
          initializerDepositTokenAccount: initializerTokenAccountA,
          initializerReceiveTokenAccount: initializerTokenAccountB,
          escrowAccount: escrowAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        instructions: [
          await program.account.escrowAccount.createInstruction(escrowAccount),
        ],
        signers: [escrowAccount, initializerMainAccount],
      }
    );

    // Cancel the escrow.
    await program.rpc.cancel({
      accounts: {
        initializer: initializerMainAccount.publicKey,
        initializerDepositTokenAccount: initializerTokenAccountA,
        vaultAccount: vault_account_pda,
        vaultAuthority: vault_authority_pda,
        escrowAccount: escrowAccount.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [initializerMainAccount]
    });

    // Check the final owner should be the provider public key.
    const _initializerTokenAccountA = await mintA.getAccountInfo(initializerTokenAccountA);
    
    assert.ok(_initializerTokenAccountA.owner.equals(initializerMainAccount.publicKey));

    // Check all the funds are still there.
    assert.ok(_initializerTokenAccountA.amount.toNumber() == initializerAmount);


    // Or use this function with pagination and caching
    /*let page = 1;
    const perPage = 10;
    const cacheTtlMins = 1; // Will keep the mint tokens cached for 1 minute
    console.log(_initializerTokenAccountA.owner);
    let myNFTsPage1 = await NFTs.getNFTsByOwner(conn, _initializerTokenAccountA.owner, page, perPage, cacheTtlMins);
    console.log('myNFTsPage1', myNFTsPage1);*/
  });
});