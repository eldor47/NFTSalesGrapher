var Web3 = require("web3");

const jsonInterface = require("./SmartContract.json");
const infraURL = 'https://arb1.arbitrum.io/rpc'

var web3 = new Web3(infraURL)

var Contract = require('web3-eth-contract');
Contract.setProvider(infraURL);

const CONTRACT_ADDRESS = '0xDf19f1216aA406DF8bC585246bee7D96933f285F'

/**
 * 
 * @param {contract_address} address @param {starting_eth_block}_fromBlock 
 * @param {ending_eth_block} _toBlock
 * @returns All Deposit Events
 */
async function getTransferEvents(address, _fromBlock, _toBlock){
    var myContract = new Contract(jsonInterface, address);
    var events = await myContract.getPastEvents('Deposit', {
        filter: {},
        fromBlock: _fromBlock,
        toBlock: _toBlock
    })

    return events;
}

/**
 * 
 * @param {contract_address} address 
 * @returns all transactions
 */
async function getWallets(address){
    const batchSize = 100

    //Lets go back 100 valid transactions
    const dataPoints = 100
    
    var toBlock, fromBlock
    var count = 0
    var allTxs = []
    while(allTxs.length < dataPoints) {
        if(count === 0)
            toBlock = await web3.eth.getBlockNumber()
        else 
            toBlock = fromBlock

        fromBlock = toBlock-batchSize
        var newEvents = await getTransferEvents(address, fromBlock, toBlock)
        var txs = await getTransactions(newEvents)
        allTxs = [...allTxs, ...txs]
        count++
    }

    return allTxs
}

/**
 * 
 * @param {transferEvents} events 
 * @returns valid events converted to transaction
 */
async function getTransactions(events){
    var parsedTxs = []

    //Utilizing Promise.all() to batch call synchronously
    var allPromises = []
    for(var i = 0; i < events.length; i++){
        // Need to create a batch promise array to run multiple web3 calls at once
        allPromises.push(getTx(events[i].transactionHash))
    }

    var allRes = await Promise.all(allPromises)

    var allLogPromises = [];
    for(var tx of allRes){
        allLogPromises.push(checkLogs(tx))
    }

    var allResLogs = await Promise.all(allLogPromises);

    // Final loop that pushes good txs to array
    for(var i = 0; i < allRes.length; i++){
        var tx = allRes[i]
        var isValid = allResLogs[i]

        if(isValid){
            parsedTxs.push(tx)
            console.log(tx)
        }
    }
    return parsedTxs;
}

async function getTx(tx){
    var data = await web3.eth.getTransaction(tx)
    return data
}

/**
 * 
 * @param {transaction} tx 
 * @returns valid status of transaction (to make sure it didn't fail)
 */
async function checkLogs(tx){
    var txReceipt = await web3.eth.getTransactionReceipt(tx.hash)

    //This will make sure the transaction went through
    if(txReceipt.status === false){
        return false
    }
    return true
}


async function lookupWallet(wallet_address, contract_address){
    var myContract = new Contract(jsonInterface, contract_address);

    //Need to get user depositIds first
    var lookup = await myContract.methods.getAllUserDepositIds(wallet_address).call()
    console.log(lookup)
    return lookup
}

// Here I am just getting the most recent 100 wallets that have deposited, then we
// are going to use that address to look it up in the contract

async function findStakedTime(){
    var txs = await getWallets(CONTRACT_ADDRESS)
    //Use a set so its unique
    var depositIds = new Set()
    for (var tx of txs){
        var lookup = await lookupWallet(tx.from, CONTRACT_ADDRESS)
        if(lookup !== []){
            for(var depositId of lookup){
                depositIds.add({
                    from: tx.from,
                    depositId,
                    hash: tx.hash
                })
            }
        }
    }

    //You can then use the depositIds to figure out more about what the user was doing
    //If you use getBlock() you can get the timestamp of the block
    console.log(depositIds)
}

findStakedTime()



