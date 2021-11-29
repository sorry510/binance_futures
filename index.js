const Binance = require('node-binance-api')
const process = require('process')
const fs = require('fs')
const { round } = require('mathjs')
const { sleep, log, dateFormat, roundOrderPrice } = require('./utils')
const { knex, createTableIF } = require('./db')
const { coins, sleep_time } = require('./config')
const notify = require('./notify')
const binance = require('./binance')

async function hasOrder(symbol) {
  const orders = await binance.getOrder(symbol, { limit: 1 }) // 所有最后的订单
  const newOrders = orders.filter(order => order.status === 'new' || order.status === 'PARTIALLY_FILLED') // 未成交或部分成交
  return newOrders.length
}

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

  await Promise.all(
    coins.map(async coin => {
      const positionSide = 'LONG'
      const { symbol, usdt, profit, leverage } = coin
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
      if (
        lastOrder &&
        lastOrder.status === 'FILLED' &&
        lastOrder.side === 'BUY' &&
        lastOrder.positionSide === positionSide
      ) {
        // 有持仓
        if (!buyOrder && !sellOrder) {
          // 挂平仓的单
          const sellPrice = roundOrderPrice(lastOrder.avgPrice * (1 + profit / 100))
          const result = await binance.sellLimit(symbol, lastOrder.executedQty, sellPrice, {
            positionSide: 'LONG',
          }) // 平仓-平多
          if (result.code) {
            // 报错了
            notify.notifySellOrderFail(symbol, result.msg)
            sleep(60 * 1000)
          } else {
            notify.notifySellOrderSuccess(symbol, lastOrder.executedQty, sellPrice)
            sleep(3 * 1000)
          }
          log(result)
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
            // 报错了
            notify.notifyBuyOrderFail(symbol, result.msg)
            sleep(60 * 1000)
          } else {
            notify.notifyBuyOrderSuccess(symbol, quantity, buyPrice)
            sleep(3 * 1000)
          }
          log(result)
          // const insertedId = await knex('order').insert(result) // 写入数据库
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

  // const ticks = await binance.candlesticks('ADAUSDT', '1m')
  // let last_tick = ticks[ticks.length - 1]
  // let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] =
  //   last_tick
  // console.log(last_tick)
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
