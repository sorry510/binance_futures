const Binance = require('node-binance-api')
const process = require('process')
const fs = require('fs')
const { round } = require('mathjs')
const { sleep, log, dateFormat, roundOrderPrice } = require('./utils')
const { knex, createTableIF } = require('./db')
const { coins, sleep_time } = require('./config')
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

  const openOrders = await binance.getOpenOrder('ONEUSDT') // 当前进行中的订单

  if (openOrders.length > 0) {
    notify.notifyServiceStop()
    await sleep(24 * 3600 * 1000)
  }

  await Promise.all(
    coins.map(async coin => {
      const positionSide = 'LONG'
      const { symbol, usdt, profit, leverage, buyTimeOut } = coin
      const openOrders = await binance.getOpenOrder(symbol) // 当前进行中的订单
      const historyOrders = (await binance.getOrder(symbol, { limit: 100 })) || []
      const historyOrdersHas = historyOrders.filter(
        item => item.status === 'NEW' || item.status === 'PARTIALLY_FILLED' || item.status === 'FILLED'
      ) // 过滤掉无效订单,订单正向排序
      const lastOrder = historyOrdersHas.length === 0 ? null : historyOrdersHas[historyOrdersHas.length - 1]
      // console.log(JSON.stringify(historyOrdersHas))
      // process.exit()
      const buyOrder = openOrders.find(item => item.side === 'BUY' && item.positionSide === positionSide) // 查询开多的单
      const sellOrder = openOrders.find(item => item.side === 'SELL' && item.positionSide === positionSide) // 查询平多的单

      // 买多与平多
      if (
        lastOrder &&
        lastOrder.status === 'FILLED' &&
        lastOrder.side === 'BUY' &&
        lastOrder.positionSide === positionSide
      ) {
        // 有持仓
        if (!buyOrder && !sellOrder) {
          const nowPrice = await binance.getPrices()[symbol]
          const sellPrice = roundOrderPrice(lastOrder.avgPrice * (1 + profit / 100))
          if (nowPrice > sellPrice) {
            // 当前价格高于止盈率
            const result = await binance.sellMarket(symbol, lastOrder.executedQty, {
              positionSide: 'LONG',
            })
            if (result.code) {
              // 报错了
              notify.notifySellOrderFail(symbol, result.msg)
              await sleep(60 * 1000)
            }
            log(result)
          } else {
            // 挂平仓的单
            const result = await binance.sellLimit(symbol, lastOrder.executedQty, sellPrice, {
              positionSide: 'LONG',
            }) // 平仓-平多
            if (result.code) {
              notify.notifySellOrderFail(symbol, result.msg)
              await sleep(60 * 1000)
            } else {
              notify.notifySellOrderSuccess(symbol, lastOrder.executedQty, sellPrice)
              await sleep(3 * 1000)
            }
            log(result)
          }
        }
      } else {
        // 无持仓
        if (!buyOrder) {
          // 没有挂买单
          const { buyPrice, sellPrice } = await getPrice(symbol, positionSide)
          const quantity = round((usdt / buyPrice) * leverage, 0) // 购买数量
          await binance.leverage(symbol, leverage) // 修改合约倍数
          const result = await binance.buyLimit(symbol, Number(quantity), buyPrice, {
            positionSide,
          }) // 开仓-开多
          if (result.code) {
            notify.notifyBuyOrderFail(symbol, result.msg)
            await sleep(60 * 1000)
          } else {
            notify.notifyBuyOrderSuccess(symbol, quantity, buyPrice)
            await sleep(3 * 1000)
          }
          log(result)

          // const result2 = await binance.sellLimit(symbol, Number(quantity), sellPrice, {
          //   positionSide: 'SHORT',
          // }) // 开仓-开空
          // if (result2.code) {
          //   notify.notifyBuyOrderFail(symbol, result2.msg)
          //   await sleep(60 * 1000)
          // } else {
          //   notify.notifyBuyOrderSuccess(symbol, quantity, buyPrice)
          //   await sleep(3 * 1000)
          // }
          // log(result2)
        } else {
          // 有挂单，检查是否超时，超时取消挂单
          const nowTime = +new Date()
          if (nowTime > Number(buyOrder.updateTime) + buyTimeOut * 1000) {
            const result = await binance.cancelOrder(symbol) // 撤销订单
            if (result.code) {
              notify.notifyCancelOrderFail(symbol, result.msg)
              await sleep(60 * 1000)
            } else {
              notify.notifyCancelOrderSuccess(symbol)
              await sleep(3 * 1000)
            }
            log(result)
          }
        }
      }
    })
  )

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
  // }) // 开仓-平空

  // const result = await binance.cancelOrder('DOTUSDT', 10250044975) // 撤销订单
  // const result = await binance.orderStatus('DOTUSDT', 10250044975) // 订单状态
  // const result = await binance.depth('DOTUSDT', 10250044975) // 深度
  // const result = await binance.leverage('DOTUSDT', 70) // 合约倍数
  // const result = await binance.getOrder('DOTUSDT') // 所有订单

  // console.log(JSON.stringify(result))
  // process.exit()
}

;(async () => {
  while (true) {
    try {
      await run()
      await sleep(sleep_time * 1000)
    } catch (e) {
      notify.notifyServiceError(e)
    }
  }
})()
