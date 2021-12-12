const { exit } = require('process')
const { round } = require('mathjs')
const { sleep, log, roundOrderPrice, tries } = require('./utils')
const { knex } = require('./db')
const { symbols, usdt, profit, loss = 100, leverage, buyTimeOut, sleep_time, excludeSymbols, cha } = require('./config')
const notify = require('./notify')
const binance = require('./binance')

async function getPrice(symbol) {
  const result = await binance.depth(symbol)
  function avg(data) {
    let num = 0
    let sum = 0
    data.map(item => {
      sum += item[0] * item[1]
      num += Number(item[1])
    })
    return num > 0 ? sum / num : 0
  }
  return {
    buyPrice: roundOrderPrice(avg(result.bids)),
    sellPrice: roundOrderPrice(avg(result.asks)),
  }
}

async function run() {
  // await createTableIF() // 创建数据库

  const coins = [
    {
      symbol: symbols[0],
      canLong: true, // 开启多单
      canShort: false, // 开启空单
      sellNum: 0, // 卖容错次数
    },
  ]

  /************************************************获取账户信息 start******************************************************************* */
  const positions = await binance.getPosition() // 获取当前持有仓位
  if (!Array.isArray(positions)) {
    notify.notifyServiceError(JSON.stringify(positions))
    await sleep(60 * 1000)
    return
  }

  // const currentSymbols = new Set(coins.map(item => item.symbol)) // 当前要交易的币种
  // const excludeOrderSymbols = new Set(excludeSymbols || []) // 手动交易的白名单
  /************************************************获取账户信息 end******************************************************************* */

  /*************************************************开始交易挂单与平仓 start************************************************************ */
  await Promise.all(
    coins.map(async coin => {
      const positionSide = 'LONG'
      const { symbol, canLong, canShort } = coin

      if (!canLong && !canShort) {
        return
      }
      const positionLong = positions.find(item => item.symbol === symbol && item.positionSide === positionSide) // 是否有多头当前的持仓
      const [ma2, ma20] = await binance.getMaCompare(symbol, '3m', [2, 20])
      log(`ma2 ${ma2 >= ma20 ? '>' : '<'} ma20`)

      if (ma2 >= ma20) {
        // 买
        coin.sellNum = 0
        if (positionLong && positionLong.positionAmt > 0) {
          // 已经买过了
        } else {
          await binance.marginType(symbol) // 逐仓
          await binance.leverage(symbol, leverage) // 合约倍数
          const result = await binance.buyMarket(symbol, Number(quantity), {
            positionSide,
          }) // 开仓-开多
          if (result.code) {
            notify.notifyBuyOrderFail(symbol, result.msg)
            await sleep(60 * 1000)
          } else {
            notify.notifyBuyOrderSuccess(symbol, quantity)
            await sleep(140 * 1000) // 买入后停留140秒
          }
          log(result)
        }
      } else {
        if (positionLong && positionLong.positionAmt > 0) {
          coin.sellNum++
          if (coin.sellNum > 3) {
            // 卖出
            const result = await binance.sellMarket(symbol, positionLong.positionAmt, {
              positionSide,
            })
            if (result.code) {
              // 报错了
              notify.notifySellOrderFail(symbol, result.msg)
              await sleep(60 * 1000)
            } else {
              notify.notifySellOrderSuccess(symbol, positionLong.unRealizedProfit)
              await sleep(10 * 1000)
            }
            log(result)
          } else {
            log(`sellNum is ${coin.sellNum}`)
          }
        }
      }

      // console.log(JSON.stringify(positionShort))
      // process.exit()
    })
  )
  /*************************************************开始交易挂单与平仓 end************************************************************ */
}

;(async () => {
  while (true) {
    // binance.resetWeight()
    try {
      await run()
      // log('weight = ' + binance.getWeight())
      await sleep(sleep_time * 1000)
      log(`wait ${sleep_time} second`)
    } catch (e) {
      log(e)
      notify.notifyServiceError(e + 'stop 1 min')
      await sleep(1 * 60 * 1000)
    }
  }

  // const result = await binance.buyLimit('DOTUSDT', 0.5, 36, {
  //   positionSide: 'LONG',
  // }) // 开仓-开多

  // const result = await binance.sellLimit('DOTUSDT', 0.5, 37.6, {
  //   positionSide: 'SHORT',
  // }) // 开仓-开空

  // const result = await binance.sellLimit('DOTUSDT', 0.5, 36, {
  //   positionSide: 'LONG',
  // }) // 平仓-平多

  // const result = await binance.buyLimit('DOTUSDT', 0.5, 37.6, {
  //   positionSide: 'SHORT',
  // }) // 平仓-平空

  // const result = await binance.cancelOrder('DOTUSDT', 10250044975) // 撤销订单
  // const result = await binance.orderStatus('DOTUSDT', 10250044975) // 订单状态
  // const result = await binance.depth('DOTUSDT', 10250044975) // 深度
  // const result = await binance.leverage('DOTUSDT', 70) // 合约倍数
  // const result = await binance.getOrder('DOTUSDT') // 所有订单

  // console.log(JSON.stringify(result))
  // process.exit()
})()
