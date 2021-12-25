var Web3 = require("web3");
const jsonInterface = require("./SmartContract.json");
const infraURL = 'https://mainnet.infura.io/v3/INSERTKEYHERE'

var web3 = new Web3(infraURL)

var Contract = require('web3-eth-contract');
Contract.setProvider(infraURL);

const { createCanvas } = require('canvas')

const chart = require('chart.js')
const fs = require('fs');

async function getTransferEvents(address, _fromBlock, _toBlock){
    var myContract = new Contract(jsonInterface.abi, address);
    var events = await myContract.getPastEvents('Transfer', {
        filter: {},
        fromBlock: _fromBlock,
        toBlock: _toBlock
    })

    return events;
}

// Grabs all Transfer related events from specific abi
async function getTransferSales(address){
    const batchSize = 5000
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
        var txs = await getSales(newEvents)
        allTxs = [...allTxs, ...txs]
        count++
    }

    return allTxs
}


//Converts event to Transaction
async function getSales(events){
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

    // Final loop that pushes good txs to array that is returned to chart
    for(var i = 0; i < allRes.length; i++){
        var tx = allRes[i]
        var isSale = allResLogs[i]

        // Ignoring 0 sales
        if(tx.value !== '0' && isSale){
            parsedTxs.push(tx)
            //console.log('Block Num ' + tx.blockNumber + ' $Value: $' + tx.value + ' Index: ' + tx.transactionIndex)
        }
    }
    return parsedTxs;
}

async function getTx(tx){
    var data = await web3.eth.getTransaction(tx)
    return data
}

async function checkLogs(tx){
    var txReceipt = await web3.eth.getTransactionReceipt(tx.hash)

    //This will make sure the transaction went through
    if(txReceipt.status === false){
        return false
    }

    // Checks the logs to make sure there was a sale interaction with WyvernExchange
    // This gets rid of 0 sale Transfers and Swaps
    for(var log of txReceipt.logs){
        // Wyveryn Exchange Address
        if(log.address.toLowerCase() === '0x7be8076f4ea4a4ad08075c2508e481d6c946d12b'){
            return true
        }
    }
    return false
}

async function getTimestamps(blockNumbers){
    var allPromises = []
    for(var blockNumber of blockNumbers){
        allPromises.push(getBlockTimeStamp(blockNumber))
    }
    var timestamps = await Promise.all(allPromises)
    return timestamps
}

async function getBlockTimeStamp(blockNumber){
    var ts = await web3.eth.getBlock(blockNumber)
    //var date = timeConverter(ts.timestamp)
    return ts.timestamp
}

function timeConverter(UNIX_timestamp){
    var a = new Date(UNIX_timestamp * 1000);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    var year = a.getFullYear()
    var month = months[a.getMonth()]
    var date = a.getDate()
    var hour = a.getHours()
    var time = date + ' ' + month + ' ' + year
    return time;
}

async function makeChart(address) {
    const canvas = createCanvas(1500, 1000)
    const ctx = canvas.getContext("2d")

    var checkAddress = web3.utils.isAddress(address)
    if(!checkAddress){
        throw new Error('Invalid address');
    }
    var sales = await getTransferSales(address)
    var blockNumbers = sales.map((item) => { return item["blockNumber"] })
    var labels = await getTimestamps(blockNumbers)

    var data = sales.map((item) => { return parseFloat(item.value) / 1000000000000000000 });

    // Sorting data so that it is in order based on date
    var indicies = labels.map((_, i) => i)

    indicies.sort((a, b) => labels[a] - labels[b])
    labels = indicies.map(i => labels[i])
    data = indicies.map(i => data[i])

    labels = labels.map(i => timeConverter(i))

    labels = labels.slice(Math.max(labels.length - 100, 0))
    data = data.slice(Math.max(data.length - 100, 0))

    ctx.fillStyle = "blue";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const myChart = new chart.Chart(ctx,
        {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                  label: 'Recent Sales for Contract ' + address,
                  data: data,
                  fill: 'rgb(75, 50, 50)',
                  borderColor: 'rgb(75, 192, 192)',
                  tension: 0.1
                }]
            }
    })

    var fileName = `${address}-${Date.now()}.png`

    await fs.writeFileSync(`./charts/${fileName}`, canvas.toBuffer("image/png"));
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    return fileName
}

exports.makeChart = makeChart;