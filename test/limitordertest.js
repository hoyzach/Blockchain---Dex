/* The following are tests to ensure the limit order function within the Dex contract is running smoothly */

const Dex = artifacts.require("Dex")
const Link = artifacts.require("Link")
const truffleAssert = require("truffle-assertions");

contract("Dex", accounts => {
    
    //The user only inputs ticker supported by dex
    it("should not allow limit orders for tokens not supported", async () => {
        let dex = await Dex.deployed()
        let link = await Link.deployed()
        await dex.addToken(web3.utils.fromUtf8("LINK"), link.address, {from: accounts[0]})
        await truffleAssert.passes(
            dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 0, 0, 0)
        )
        await truffleAssert.reverts(
            dex.createLimitOrder(web3.utils.fromUtf8("ASDF"), 0, 0, 0)
        )
    })
    //The user must have ETH deposited such that deposited eth >= buy order value
    it("should only be possible buy tokens up to total ETH value deposited", async () => {
        let dex = await Dex.deployed()
        await dex.depositEth({value: 5})
        await truffleAssert.reverts(
            dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 0, 10, 1)
        )
        await truffleAssert.passes(
            dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 0, 5, 1)
        )
    })
    //The user must have enough tokens deposited such that the token balance > sell order amount
    it("should only be possible sell up to total token amount deposited", async () => {
        let dex = await Dex.deployed()
        let link = await Link.deployed()
        await link.approve(dex.address, 20);
        await dex.deposit(20, web3.utils.fromUtf8("LINK"))
        await truffleAssert.reverts(
            dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 30, 1)
        )
        await truffleAssert.passes(
            dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 20, 6)
        )
    })
    //The BUY order book should be ordered on price from highest to lowest starting at index 0
    it("should sort buy orders correctly", async () => {
        let dex = await Dex.deployed()
        await dex.depositEth({value: 40})
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 0, 5, 3)
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 0, 3, 5)
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 0, 1, 4)
        let book = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 0)
        assert(book.length > 0, "there are no orders in the orderbook")
        for(i=0; i<book.length-1; i++){
            assert(book[i].price >= book[i+1].price, "Orderbook is not sorted correctly")
        }
    })
    //The SELL order book should be ordered on price from lowest to highest
    it("should sort sell orders correctly", async () => {
        let dex = await Dex.deployed()
        let link = await Link.deployed()
        await link.approve(dex.address, 9);
        await dex.deposit(9, web3.utils.fromUtf8("LINK"))
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 5, 7)
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 3, 9)
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 1, 8)
        let book = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1)
        assert(book.length > 0, "there are no orders in the orderbook")
        for(i=0; i<book.length-1; i++){
            assert(book[i].price <= book[i+1].price, "Orderbook is not sorted correctly")
        }
    })
})