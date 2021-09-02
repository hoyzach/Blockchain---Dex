//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.6;
pragma experimental ABIEncoderV2;

import "./wallet.sol";

contract Dex is Wallet{

    using SafeMath for uint256;

    enum Side {
        BUY,
        SELL
    }

    struct Order {
        uint id;
        address trader;
        Side side;
        bytes32 ticker;
        uint amount;
        uint filled;
        uint price;
    }

    uint nextOrderID = 0;

            //ticker            //side
    mapping(bytes32 => mapping(uint => Order[])) public orderBook;

    //returns orderBook Order[] struct array given ticker and buy/sell side
    function getOrderBook(bytes32 ticker, Side side) view public returns(Order[] memory){
        return orderBook[ticker][uint(side)];
    }

    //pushes a limit order to the Order[] struct array given ticker, buy/sell side, amount, and price
    function createLimitOrder(bytes32 ticker, Side side, uint amount, uint price) public tokenExists(ticker){
        if(side == Side.BUY){
            require(balances[msg.sender]["ETH"] >= amount.mul(price));
        }
        else if(side == Side.SELL){
            require(balances[msg.sender][ticker] >= amount);
        }

        Order[] storage orders = orderBook[ticker][uint(side)];
        orders.push(Order(nextOrderID, msg.sender, side, ticker, amount, 0, price));

        uint i = orders.length > 0 ? orders.length - 1 : 0;
        if(side == Side.BUY){
            for(i; i>0; i--){
                if(orders[i].price > orders[i-1].price){
                    Order memory temp = orders[i];
                    orders[i] = orders[i-1];
                    orders[i-1] = temp;
                }
            }
        }
        else if(side == Side.SELL){
            for(i; i>0; i--){
                if(orders[i].price < orders[i-1].price){
                    Order memory temp = orders[i];
                    orders[i] = orders[i-1];
                    orders[i-1] = temp;
                }
            }
        }
        nextOrderID++;
    }

    //matches amount for ticker and side given, for the best available price in the orderbook
    function marketOrder(bytes32 ticker, Side side, uint amount) public tokenExists(ticker){
        if(side == Side.SELL){
            require(balances[msg.sender][ticker] >= amount, "Insufficient balance");
        }
        uint orderBookSide;
        //retrieve appropriate order book
        if(side == Side.BUY){ orderBookSide = 1; }
            else if(side == Side.SELL) { orderBookSide = 0; }

        Order[] storage orders = orderBook[ticker][orderBookSide];

        //tracker variable for total amount of market order filled
        uint totalFilled = 0;
        //tracker variable for total amount of market order to be filled per loop
        uint amountToBeFilled = 0;

        for (uint256 i = 0; i < orders.length && totalFilled < amount; i++) {
            
            uint leftToFill = amount.sub(totalFilled);
            uint limitOrderUnfilled = orders[i].amount.sub(orders[i].filled);

            //how much we can fill from order[i]
            if ( limitOrderUnfilled <= leftToFill ) {
                amountToBeFilled = limitOrderUnfilled; //fill as much as is available in order[i]
            }
                else if ( limitOrderUnfilled > leftToFill ) {
                    amountToBeFilled = leftToFill; //fill the remainder of the market order
                }
            //Verify that the buyer has enough ETH to cover, if not change amountToBeFilled    
            if( side == Side.BUY ){
                require(balances[msg.sender]["ETH"] > 0, "ETH balance is insufficient");
                if( balances[msg.sender]["ETH"] < amountToBeFilled.mul(orders[i].price) ) {
                    amountToBeFilled = balances[msg.sender]["ETH"].div(orders[i].price);
                }
            }
            //update totalfilled
            totalFilled = totalFilled.add(amountToBeFilled);
            orders[i].filled = orders[i].filled.add(amountToBeFilled);
            uint cost = amountToBeFilled.mul(orders[i].price);

            //execute the trade & shift balances between buyer/seller
            if( side == Side.SELL ) {
                balances[msg.sender][ticker] = balances[msg.sender][ticker].sub(amountToBeFilled);
                balances[msg.sender]["ETH"] = balances[msg.sender]["ETH"].add(cost);
                balances[orders[i].trader][ticker] = balances[orders[i].trader][ticker].add(amountToBeFilled);
                balances[orders[i].trader]["ETH"] = balances[orders[i].trader]["ETH"].sub(cost);
            }
                else if( side == Side.BUY ) {
                    balances[msg.sender][ticker] = balances[msg.sender][ticker].add(amountToBeFilled);
                    balances[msg.sender]["ETH"] = balances[msg.sender]["ETH"].sub(cost);
                    balances[orders[i].trader][ticker] = balances[orders[i].trader][ticker].sub(amountToBeFilled);
                    balances[orders[i].trader]["ETH"] = balances[orders[i].trader]["ETH"].add(cost);
                }
        }
        //loop through the orderbook and remove 100% filled orders
        while(orders.length > 0 && orders[0].filled == orders[0].amount){
            for ( uint256 i = 0; i < orders.length - 1; i++ ) {
                orders[i] = orders[i+1];
            }
            orders.pop();
        }
    }

}