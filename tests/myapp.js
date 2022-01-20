const assert = require("assert");
const anchor = require("@project-serum/anchor");
const { SystemProgram } = anchor.web3;
const NFTs = require('@primenums/solana-nft-tools');
const web3 = require("@solana/web3.js");
const spl_token = require("@solana/spl-token");

describe("test token", () => {

    const provider = anchor.Provider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.Mywallet;

    let mintA = null;
    let mintB = null;
    let initializerTokenAccountA = null;
    let initializerTokenAccountB = null;
    let takerTokenAccountA = null;
    let takerTokenAccountB = null;
    let vault_account_pda = null;
    let vault_account_bump = null;
    let vault_authority_pda = null;
    let valut_authority_bump = null;
  
    const takerAmount = 1000;
    const initializerAmount = 500;

    const opts = {
      preflightCommitment: "processed"
    }
    const network = "http://127.0.0.1:8899";
  
    const myWalletAccount = anchor.web3.Keypair.generate();
    const payer = anchor.web3.Keypair.generate();
    const mintAuthority = anchor.web3.Keypair.generate();
    const initializerMainAccount = anchor.web3.Keypair.generate();
    const takerMainAccount = anchor.web3.Keypair.generate();

    it("Initialize program state", async () => {
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(payer.publicKey, 10000000000),
        "confirmed"
      );

      console.log("Here");

      // Fund Main Accounts
    await provider.send(
      (() => {
        const tx = new web3.Transaction(network, opts.preflightCommitment);
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

    mintA = await spl_token.Token.createMint(
      provider.connection,
      payer,
      mintAuthority.publicKey,
      null,
      0,
      spl_token.TOKEN_PROGRAM_ID
    );

    mintB = await spl_token.Token.createMint(
      provider.connection,
      payer,
      mintAuthority.publicKey,
      null,
      0,
      spl_token.TOKEN_PROGRAM_ID
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

    it("Initialize mywallet", async () => {
      const [_vault_account_pda, _vault_account_bump] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("token-mywallet"))],
        program.programId
      );
      vault_account_pda = _vault_account_pda;
      vault_account_bump = _vault_account_bump;
  
      console.log(vault_account_pda);
  
      const [_vault_authority_pda, _vault_authority_bump] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("escort"))],
        program.programId
      );
      vault_authority_pda = _vault_authority_pda;
      valut_authority_bump = _vault_authority_bump;
  
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
            escrowAccount: myWalletAccount.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            tokenProgram: spl_token.TOKEN_PROGRAM_ID,
          },
          instructions: [
            await program.account.walletAccount.createInstruction(myWalletAccount),
          ],
          signers: [myWalletAccount, initializerMainAccount],
        }
      );
  
      let _vault = await mintA.getAccountInfo(vault_account_pda);
  
      let _escrowAccount = await program.account.walletAccount.fetch(
        myWalletAccount.publicKey
      );

      const conn = new web3.Connection(network, opts.preflightCommitment);
      let mints = await NFTs.getMintTokensByOwner(conn, initializerMainAccount.publicKey);
      
      NFTs.getNFTsByOwner()
      NFTs.getMintTokensByOwner()
      NFTs.getMintTokenOwner()
      NFTs.getMintTokenMeta()
      NFTs.getNFTByMintAddress()

      NFTs.toNFT()
      let temp = NFTs.getNFTByMintAddress(element);
      console.log(temp.amount.toNumber());
      console.log('mints', mints);

      mintA.getAccountInfo()

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
});