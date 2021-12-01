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
  const positions = await binance.getPosition() // 获取当前持有仓位

  await Promise.all(
    coins.map(async coin => {
      const positionSide = 'LONG'
      const positionSideShort = 'SHORT'
      const { symbol, usdt, profit, leverage, buyTimeOut, canLong, canShort } = coin

      if (!canLong && !canShort) {
        return
      }

      const openOrders = await binance.getOpenOrder(symbol) // 当前进行中的订单

      const buyOrder = openOrders.find(item => item.side === 'BUY' && item.positionSide === positionSide) // 查询开多的单
      const sellOrder = openOrders.find(item => item.side === 'SELL' && item.positionSide === positionSide) // 查询平多的单
      const positionLong = positions.find(item => item.symbol === symbol && item.positionSide === positionSide) // 是否有多头当前的持仓
      if (positionLong && canLong) {
        if (positionLong.positionAmt > 0) {
          // 有持仓
          if (!buyOrder && !sellOrder) {
            // 不是部分买入持仓且没有挂卖单
            const { unRealizedProfit, notional } = positionLong
            // const nowPrice = await binance.getPrices()[symbol]
            const sellPrice = roundOrderPrice(positionLong.entryPrice * (1 + profit / 100 / leverage))
            // console.log(nowPrice, sellPrice, positionLong.positionAmt)
            // process.exit()
            const nowProfit = (unRealizedProfit / (notional - unRealizedProfit) / 100) * leverage
            if (nowProfit > profit) {
              // 当前价格高于止盈率
              const result = await binance.sellMarket(symbol, positionLong.positionAmt, {
                positionSide,
              })
              if (result.code) {
                // 报错了
                notify.notifySellOrderFail(symbol, result.msg)
                await sleep(60 * 1000)
              } else {
                notify.notifySellOrderSuccess(
                  symbol,
                  positionLong.positionAmt,
                  roundOrderPrice(positionLong.entryPrice * (1 + nowProfit / 100))
                )
                await sleep(3 * 1000)
              }
              log(result)
            } else {
              // 挂平仓的单
              const result = await binance.sellLimit(symbol, positionLong.positionAmt, sellPrice, {
                positionSide,
              }) // 平仓-平多
              if (result.code) {
                notify.notifySellOrderFail(symbol, result.msg)
                await sleep(60 * 1000)
              } else {
                notify.notifySellOrderSuccess(symbol, positionLong.positionAmt, sellPrice)
                await sleep(3 * 1000)
              }
              log(result)
            }
          }
        } else {
          // 没有持仓
          if (!buyOrder) {
            // 没有挂买单
            const { buyPrice, sellPrice } = await getPrice(symbol)
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
              const result = await binance.cancelOrder(symbol, buyOrder.orderId) // 撤销订单
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
      }

      const buyOrderShort = openOrders.find(item => item.side === 'SELL' && item.positionSide === positionSideShort) // 查询开空的单
      const sellOrderShort = openOrders.find(item => item.side === 'BUY' && item.positionSide === positionSideShort) // 查询平空的单
      const positionShort = positions.find(item => item.symbol === symbol && item.positionSide === positionSideShort) // 是否有空头当前的持仓
      // console.log(JSON.stringify(positionShort))
      // process.exit()
      if (positionShort && canShort) {
        const positionAmt = Math.abs(positionShort.positionAmt) // 空单为负数
        if (positionAmt > 0) {
          // 有持仓
          if (!buyOrderShort && !sellOrderShort) {
            // 不是部分买入持仓且没有挂卖单
            const { unRealizedProfit, notional } = positionShort
            const sellPrice = roundOrderPrice(positionShort.entryPrice * (1 - profit / 100 / leverage))
            const nowProfit = (unRealizedProfit / (notional - unRealizedProfit) / 100) * leverage
            if (nowProfit > profit) {
              // 当前价格高于止盈率
              const result = await binance.buyMarket(symbol, positionAmt, {
                positionSide: positionSideShort,
              })
              if (result.code) {
                // 报错了
                notify.notifySellOrderFail(symbol, result.msg)
                await sleep(60 * 1000)
              } else {
                notify.notifySellOrderSuccess(symbol, positionAmt, sellPrice)
                await sleep(3 * 1000)
              }
              log(result)
            } else {
              // 挂平仓的单
              const result = await binance.buyLimit(symbol, positionAmt, sellPrice, {
                positionSide: positionSideShort,
              }) // 平仓-平空
              if (result.code) {
                notify.notifySellOrderFail(symbol, result.msg)
                await sleep(60 * 1000)
              } else {
                notify.notifySellOrderSuccess(symbol, positionAmt, sellPrice)
                await sleep(3 * 1000)
              }
              log(result)
            }
          }
        } else {
          // 没有持仓
          if (!buyOrderShort) {
            // 没有挂买单
            const { sellPrice } = await getPrice(symbol)
            const quantity = round((usdt / sellPrice) * leverage, 0) // 购买数量
            const result2 = await binance.sellLimit(symbol, Number(quantity), sellPrice, {
              positionSide: positionSideShort,
            }) // 开仓-开空
            if (result2.code) {
              notify.notifyBuyOrderFail(symbol, result2.msg)
              await sleep(60 * 1000)
            } else {
              notify.notifyBuyOrderSuccess(symbol, quantity, sellPrice, '做空')
              await sleep(3 * 1000)
            }
            log(result2)
          } else {
            // 有挂单，检查是否超时，超时取消挂单
            const nowTime = +new Date()
            if (nowTime > Number(buyOrderShort.updateTime) + buyTimeOut * 1000) {
              const result = await binance.cancelOrder(symbol, buyOrderShort.orderId) // 撤销订单
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
      }
    })
  )
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
