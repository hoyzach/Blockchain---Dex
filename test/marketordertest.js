/* The following are tests to ensure the market order function within the Dex contract is running smoothly */

const Dex = artifacts.require("Dex")
const Link = artifacts.require("Link")
const truffleAssert = require('truffle-assertions');

contract("Dex", accounts => {
    //When creating a SELL market order, the seller needs to have enough tokens for the trade
    it("Should throw an error when creating a sell market order without adequate token balance", async () => {
        let dex = await Dex.deployed()
        let link = await Link.deployed()

        await dex.addToken(web3.utils.fromUtf8("LINK"), link.address)

        let balance = await dex.balances(accounts[0], web3.utils.fromUtf8("LINK"))
        assert.equal( balance.toNumber(), 0, "Initial LINK balance is not 0" );
        
        await truffleAssert.reverts(
            dex.marketOrder(web3.utils.fromUtf8("LINK"), 1, 10)
        )
    })
    //Market orders can be submitted even if the order book is empty
    it("Market orders can be submitted even if the order book is empty", async () => {
        let dex = await Dex.deployed()
        
        await dex.depositEth({value: 50000});

        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 0); //Get buy side orderbook
        assert(orderbook.length == 0, "Buy side Orderbook length is not 0");
        
        await truffleAssert.passes(
            dex.marketOrder(web3.utils.fromUtf8("LINK"), 0, 10)
        )
    })
    //Market orders should be filled until the order book is empty or the market order is 100% filled
    it("Market orders should not fill more limit orders than the market order amount", async () => {
        let dex = await Dex.deployed()
        let link = await Link.deployed()

        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1); //Get sell side orderbook
        assert(orderbook.length == 0, "Sell side Orderbook should be empty at start of test");

        //Send LINK tokens to accounts 1, 2, 3 from account 0
        await link.transfer(accounts[1], 150)
        await link.transfer(accounts[2], 150)
        await link.transfer(accounts[3], 150)

        //Approve DEX for accounts 1, 2, 3
        await link.approve(dex.address, 50, {from: accounts[1]});
        await link.approve(dex.address, 50, {from: accounts[2]});
        await link.approve(dex.address, 50, {from: accounts[3]});

        //Deposit LINK into DEX for accounts 1, 2, 3
        await dex.deposit(50, web3.utils.fromUtf8("LINK"), {from: accounts[1]});
        await dex.deposit(50, web3.utils.fromUtf8("LINK"), {from: accounts[2]});
        await dex.deposit(50, web3.utils.fromUtf8("LINK"), {from: accounts[3]});

        //Fill up the sell order book
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 5, 300, {from: accounts[1]})
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 5, 400, {from: accounts[2]})
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 5, 500, {from: accounts[3]})

        //Create market order that should fill 2/3 orders in the book
        await dex.marketOrder(web3.utils.fromUtf8("LINK"), 0, 10);

        orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1); //Get sell side orderbook
        assert(orderbook.length == 1, "Sell side Orderbook should only have 1 order left");
        assert(orderbook[0].filled == 0, "Sell side order should have 0 filled");

    })
    //Market orders should be filled until the order book is empty or the market order is 100% filled
    it("Market orders should be filled until the order book is empty", async () => {
        let dex = await Dex.deployed()

        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1); //Get sell side orderbook
        assert(orderbook.length == 1, "Sell side Orderbook should have 1 order left");

        //Fill up the sell order book again
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 5, 400, {from: accounts[1]})
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 5, 500, {from: accounts[2]})

        //check buyer link balance before link purchase
        let balanceBefore = await dex.balances(accounts[0], web3.utils.fromUtf8("LINK"))

        //Create market order that could fill more than the entire order book (15 link)
        await dex.marketOrder(web3.utils.fromUtf8("LINK"), 0, 50);

        //check buyer link balance after link purchase
        let balanceAfter = await dex.balances(accounts[0], web3.utils.fromUtf8("LINK"))

        //Buyer should have 15 more link after, even though order was for 50. 
        assert.equal(balanceBefore.toNumber() + 15, balanceAfter.toNumber());
    })

    //The eth balance of the buyer should decrease with the filled amount
    it("The eth balance of the buyer should decrease with the filled amount", async () => {
        let dex = await Dex.deployed()
        let link = await Link.deployed()

        //Seller deposits link and creates a sell limit order for 1 link for 300 wei
        await link.approve(dex.address, 500, {from: accounts[1]});
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 1, 300, {from: accounts[1]})

        //Check buyer ETH balance before trade
        let balanceBefore = await dex.balances(accounts[0], web3.utils.fromUtf8("ETH"));
        await dex.marketOrder(web3.utils.fromUtf8("LINK"), 0, 1);
        let balanceAfter = await dex.balances(accounts[0], web3.utils.fromUtf8("ETH"));

        assert.equal(balanceBefore.toNumber() - 300, balanceAfter.toNumber());
    })

    //The token balances of the limit order sellers should decrease with the filled amounts.
    it("The token balances of the limit order sellers should decrease with the filled amounts.", async () => {
        let dex = await Dex.deployed()
        let link = await Link.deployed()

        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1); //Get sell side orderbook
        assert(orderbook.length == 0, "Sell side Orderbook should be empty at start of test");

        //Seller Account[2] deposits link
        await link.approve(dex.address, 500, {from: accounts[2]});
        await dex.deposit(100, web3.utils.fromUtf8("LINK"), {from: accounts[2]});

        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 1, 300, {from: accounts[1]})
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 1, 400, {from: accounts[2]})

        //Check sellers Link balances before trade
        let account1balanceBefore = await dex.balances(accounts[1], web3.utils.fromUtf8("LINK"));
        let account2balanceBefore = await dex.balances(accounts[2], web3.utils.fromUtf8("LINK"));

        //Account[0] created market order to buy up both sell orders
        await dex.marketOrder(web3.utils.fromUtf8("LINK"), 0, 2);

        //Check sellers Link balances after trade
        let account1balanceAfter = await dex.balances(accounts[1], web3.utils.fromUtf8("LINK"));
        let account2balanceAfter = await dex.balances(accounts[2], web3.utils.fromUtf8("LINK"));

        assert.equal(account1balanceBefore.toNumber() - 1, account1balanceAfter.toNumber());
        assert.equal(account2balanceBefore.toNumber() - 1, account2balanceAfter.toNumber());
    })

    //Filled limit orders should be removed from the orderbook
    it("Filled limit orders should be removed from the orderbook", async () => {
        let dex = await Dex.deployed()
        let link = await Link.deployed()
        await dex.addToken(web3.utils.fromUtf8("LINK"), link.address)

        //Seller deposits link and creates a sell limit order for 1 link for 300 wei
        await link.approve(dex.address, 500);
        await dex.deposit(50, web3.utils.fromUtf8("LINK"));
        
        await dex.depositEth({value: 10000});

        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1); //Get sell side orderbook

        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 1, 300)
        await dex.marketOrder(web3.utils.fromUtf8("LINK"), 0, 1);

        orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1); //Get sell side orderbook
        assert(orderbook.length == 0, "Sell side Orderbook should be empty after trade");
    })

    //Partly filled limit orders should be modified to represent the filled/remaining amount
    it("Limit orders filled property should be set correctly after a trade", async () => {
        let dex = await Dex.deployed()

        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1); //Get sell side orderbook
        assert(orderbook.length == 0, "Sell side Orderbook should be empty at start of test");

        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 5, 300, {from: accounts[1]})
        await dex.marketOrder(web3.utils.fromUtf8("LINK"), 0, 2);

        orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1); //Get sell side orderbook
        assert.equal(orderbook[0].filled, 2);
        assert.equal(orderbook[0].amount, 5);
    })
    //When creating a BUY market order, the buyer needs to have enough ETH for the trade
    it("Should handle market orders correctly where buyer does not haven enough ETH to fill entire market order", async () => {
        let dex = await Dex.deployed()
        
        let balance = await dex.balances(accounts[4], web3.utils.fromUtf8("ETH"))
        assert.equal( balance.toNumber(), 0, "Initial ETH balance is not 0" );

        await dex.depositEth({value: 700, from: accounts[4]});
        let account4balanceETHBefore = await dex.balances(accounts[4], web3.utils.fromUtf8("ETH"))
        let account4balanceLINKBefore = await dex.balances(accounts[4], web3.utils.fromUtf8("LINK"))
        let account1balanceETHBefore = await dex.balances(accounts[1], web3.utils.fromUtf8("ETH"))
        let account1balanceLINKBefore = await dex.balances(accounts[1], web3.utils.fromUtf8("LINK"))

        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 5, 300, {from: accounts[1]})
        await dex.marketOrder(web3.utils.fromUtf8("LINK"), 0, 5, {from: accounts[4]})

        let account4balanceETHAfter = await dex.balances(accounts[4], web3.utils.fromUtf8("ETH"))
        let account4balanceLINKAfter = await dex.balances(accounts[4], web3.utils.fromUtf8("LINK"))
        let account1balanceETHAfter = await dex.balances(accounts[1], web3.utils.fromUtf8("ETH"))
        let account1balanceLINKAfter = await dex.balances(accounts[1], web3.utils.fromUtf8("LINK"))

        assert.equal(account4balanceETHBefore.toNumber() - 600, account4balanceETHAfter.toNumber());
        assert.equal(account4balanceLINKBefore.toNumber() + 2, account4balanceLINKAfter.toNumber());
        assert.equal(account1balanceETHBefore.toNumber() + 600, account1balanceETHAfter.toNumber());
        assert.equal(account1balanceLINKBefore.toNumber() - 2, account1balanceLINKAfter.toNumber());
    })
        //When creating a BUY market order, the buyer needs to have enough ETH for the trade
        it("Should handle market orders correctly where buyer does not haven enough ETH to fill any of the market order", async () => {
            let dex = await Dex.deployed()
            
            let balance = await dex.balances(accounts[4], web3.utils.fromUtf8("ETH"))
            assert.equal( balance.toNumber(), 100, "Initial ETH balance is not 100" );
    
            let account4balanceETHBefore = await dex.balances(accounts[4], web3.utils.fromUtf8("ETH"))
            let account4balanceLINKBefore = await dex.balances(accounts[4], web3.utils.fromUtf8("LINK"))
            let account1balanceETHBefore = await dex.balances(accounts[1], web3.utils.fromUtf8("ETH"))
            let account1balanceLINKBefore = await dex.balances(accounts[1], web3.utils.fromUtf8("LINK"))
    
            await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 5, 300, {from: accounts[1]})
            await dex.marketOrder(web3.utils.fromUtf8("LINK"), 0, 5, {from: accounts[4]})
    
            let account4balanceETHAfter = await dex.balances(accounts[4], web3.utils.fromUtf8("ETH"))
            let account4balanceLINKAfter = await dex.balances(accounts[4], web3.utils.fromUtf8("LINK"))
            let account1balanceETHAfter = await dex.balances(accounts[1], web3.utils.fromUtf8("ETH"))
            let account1balanceLINKAfter = await dex.balances(accounts[1], web3.utils.fromUtf8("LINK"))
    
            assert.equal(account4balanceETHBefore.toNumber(), account4balanceETHAfter.toNumber());
            assert.equal(account4balanceLINKBefore.toNumber(), account4balanceLINKAfter.toNumber());
            assert.equal(account1balanceETHBefore.toNumber(), account1balanceETHAfter.toNumber());
            assert.equal(account1balanceLINKBefore.toNumber(), account1balanceLINKAfter.toNumber());
        })
})