/* The following are tests to ensure the wallet contract is running smoothly */

const Dex = artifacts.require("Dex")
const Link = artifacts.require("Link")
const truffleAssert = require("truffle-assertions");

contract("Dex", accounts => {
    
    //Token tickers should only be added by contract owner
    it("should only be possible for owner to add tokens", async () => {
        let dex = await Dex.deployed()
        let link = await Link.deployed()
        await truffleAssert.passes(
            dex.addToken(web3.utils.fromUtf8("LINK"), link.address, {from: accounts[0]})
        )
        await truffleAssert.reverts(
            dex.addToken(web3.utils.fromUtf8("AAVE"), link.address, {from: accounts[1]})
        )
    })
    //User balance should equal previous balance plus deposit
    it("should handle deposits correctly", async () => {
        let dex = await Dex.deployed()
        let link = await Link.deployed()
        await link.approve(dex.address, 500);
        await dex.deposit(100,web3.utils.fromUtf8("LINK"))
        let balance = await dex.balances(accounts[0], web3.utils.fromUtf8("LINK"))
        assert.equal(balance.toNumber(),100)
    })
    //Users should not be able to withdraw more tokens than they have
    it("should handle faulty withdrawals correctly", async () => {
        let dex = await Dex.deployed()
        await truffleAssert.reverts(dex.withdraw(500, web3.utils.fromUtf8("LINK")))
    })
    //Users should be able to withdraw less than or equal to the amount of tokens in their balance
    it("should handle correct withdrawals correctly", async () => {
        let dex = await Dex.deployed()
        await truffleAssert.passes(dex.withdraw(100, web3.utils.fromUtf8("LINK")))
    })
    //User ETH balance should equal previous balance plus deposit
    it("should deposit the correct amount of ETH", async () => {
        let dex = await Dex.deployed()
        await dex.depositEth({value: 50000})
        let balance = await dex.balances(accounts[0], web3.utils.fromUtf8("ETH"))
        assert.equal(balance, 50000)
    })
    //Users should be able to withdraw less than or equal to the amount of ETH their balance
    it("should withdraw the correct amount of ETH", async () => {
        let dex = await Dex.deployed()
        await dex.withdrawEth(40000)
        let balance = await dex.balances(accounts[0], web3.utils.fromUtf8("ETH"))
        assert.equal(balance, 10000)
    })
    //Users should not be able to withdraw more ETH than they have
    it("should should not allow over-withdrawal of ETH", async () => {
        let dex = await Dex.deployed()
        truffleAssert.reverts(dex.withdrawEth(40000))
    })
})