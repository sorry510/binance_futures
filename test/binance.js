const binance = require('../binance')

;(async () => {
    const result = await binance.getOrders(null,{limit: 10} )
    console.log(result)
})()