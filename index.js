const { exit } = require('process')
const { round } = require('mathjs')
const { sleep, log, roundOrderPrice, roundOrderQuantity, tries } = require('./utils')
const { knex } = require('./db')
const { usdt, profit, loss = 100, leverage, buyTimeOut, sleep_time, excludeSymbols, cha } = require('./config')
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
    buyPrice: roundOrderPrice(avg(result.bids), symbol), // 平均买单价格(低)
    sellPrice: roundOrderPrice(avg(result.asks), symbol), // 平均卖单价格(高)
  }
}

async function run() {
  /************************************************寻找交易币种 start******************************************************************* */
  const allSymbols = await tries(async () => await knex('symbols'))
  if (!Array.isArray(allSymbols)) {
    notify.notifyServiceError(JSON.stringify(allSymbols))
    exit()
  }
  const sortAllSymbols = allSymbols
    .filter(item => item.enable == 1) // 查询所有开启的币种
    .map(item => ({ ...item, percentChange: Number(item.percentChange) }))
    .sort((a, b) => (a.percentChange < b.percentChange ? -1 : 1)) // 涨幅从小到大排序

  const posiSymbols = sortAllSymbols.filter(item => item.percentChange > 0) // 涨的币
  const negaSymbols = sortAllSymbols.filter(item => item.percentChange <= 0) // 跌的币

  const posiSymbolsReverse = posiSymbols.reverse() // 从高到低排
  const posiSymbolFilter = posiSymbolsReverse.filter((item, key) => {
    if (key < posiSymbolsReverse.length - 1) {
      const perCha = item.percentChange - posiSymbolsReverse[key + 1].percentChange // 2个币种之间的涨幅差
      return perCha > cha[0] && perCha < cha[1]
    }
    return false
  }) // 2个币涨幅相差在范围内的币

  const negaSymbolFilter = negaSymbols.filter((item, key) => {
    if (key < negaSymbols.length - 1) {
      const perCha = negaSymbols[key + 1].percentChange - item.percentChange // 2个币种之间的涨幅差
      return perCha > cha[0] && perCha < cha[1]
    }
    return false
  }) // 2个币跌幅相差在范围内的币

  let coins = []
  if (posiSymbols.length / allSymbols.length > 0.7) {
    // 70%的币都在涨,可以买多2个
    posiSymbolFilter.slice(0, 2).map(function(item) {
      coins.push({
        symbol: item.symbol,
        canLong: true, // 开启多单
        canShort: false, // 开启空单
      })
    })
  } else if (negaSymbols.length / allSymbols.length > 0.7) {
    // 70%的币都在涨,可以买空2个
    negaSymbolFilter.slice(0, 2).map(function(item) {
      coins.push({
        symbol: item.symbol,
        canLong: false, // 开启多单
        canShort: true, // 开启空单
      })
    })
  } else {
    posiSymbolFilter.slice(0, 1).map(function(item) {
      coins.push({
        symbol: item.symbol,
        canLong: true, // 开启多单
        canShort: false, // 开启空单
      })
    })
    negaSymbolFilter.slice(0, 1).map(function(item) {
      coins.push({
        symbol: item.symbol,
        canLong: false, // 开启多单
        canShort: true, // 开启空单
      })
    })
  }
  if (coins.length === 0) {
    log('没有发现适合交易的币种，请等待')
    return
  }
  /************************************************寻找交易币种 end******************************************************************* */

  /************************************************获取账户信息 start******************************************************************* */

  const positions = await binance.getPosition() // 获取当前持有仓位
  if (!Array.isArray(positions)) {
    notify.notifyServiceError(JSON.stringify(positions))
    await sleep(60 * 1000)
    return
  }
  const allOpenOrders = await binance.getOpenOrder() // 当前币种的订单
  if (!Array.isArray(allOpenOrders)) {
    notify.notifyServiceError(JSON.stringify(allOpenOrders))
    await sleep(60 * 1000)
    return
  }
  const currentSymbols = new Set(coins.map(item => item.symbol)) // 当前要交易的币种
  const excludeOrderSymbols = new Set(excludeSymbols || []) // 手动交易的白名单
  /************************************************获取账户信息 end******************************************************************* */

  /*************************************************撤销挂单 start************************************************************ */
  // const openOrderFilter = allOpenOrders.filter(
  //   item =>
  //     !currentSymbols.has(item.symbol) && // 非当前要挂单的币种
  //     !excludeOrderSymbols.has(item.symbol) // 非手动交易的白名单
  // )
  // await Promise.all(
  //   openOrderFilter.map(async buyOrder => {
  //     // 有挂单，检查是否超时，超时取消挂单
  //     const nowTime = +new Date()
  //     if (nowTime > Number(buyOrder.updateTime) + buyTimeOut * 1000) {
  //       const result = await binance.cancelOrder(buyOrder.symbol, buyOrder.orderId) // 撤销订单
  //       if (result.code) {
  //         notify.notifyCancelOrderFail(buyOrder.symbol, result.msg)
  //       } else {
  //         notify.notifyCancelOrderSuccess(buyOrder.symbol)
  //       }
  //       log('撤销订单')
  //       log(result)
  //     }
  //   })
  // )
  /*************************************************撤销挂单 end************************************************************ */

  /*************************************************强制平仓那些非当前交易币和白名单币 start************************************************************ */
  const positionFilter = positions.filter(
    item =>
      Number(item.positionAmt) != 0 && // 有持仓的
      !currentSymbols.has(item.symbol) && // 非当前要挂单的币种
      !excludeOrderSymbols.has(item.symbol) // 非手动交易的白名单
  )
  if (positionFilter.length > 0) {
    // 强制平仓止损
    await Promise.all(
      positionFilter.map(async posi => {
        const positionAmt = Math.abs(posi.positionAmt) // 空单为负数
        const { unRealizedProfit, entryPrice } = posi
        const nowProfit = (unRealizedProfit / (positionAmt * entryPrice)) * leverage * 100
        if (nowProfit <= -loss || nowProfit >= loss) {
          // 收益在止盈之外的
          if (posi.positionSide === 'LONG') {
            // 存在多头,平多
            const [k1, k2] = await binance.getMaCompare(posi.symbol, '1m', [3, 30]) // 1min的kline 最近3条均值 与 30条的均值
            if (k1 < k2) {
              // 还是再跌的趋势中
              await binance.sellMarket(posi.symbol, positionAmt, {
                positionSide: posi.positionSide,
              })
            }
          } else if (posi.positionSide === 'SHORT') {
            // 存在空头,平空
            const [k1, k2] = await binance.getMaCompare(posi.symbol, '1m', [3, 30]) // 1min的kline 最近3条均值 与 30条的均
            if (k1 > k2) {
              // 还是在涨的趋势中
              await binance.buyMarket(posi.symbol, positionAmt, {
                positionSide: posi.positionSide,
              })
            }
          }
        }
      })
    )
  }
  /*************************************************强制平仓 end************************************************************ */

  /*************************************************开始交易挂单与平仓 start************************************************************ */
  await Promise.all(
    coins.map(async coin => {
      const positionSide = 'LONG'
      const positionSideShort = 'SHORT'
      let { symbol, canLong, canShort } = coin

      const [k1, k2, k3, k4] = await binance.getMaCompare(symbol, '1m', [3, 30, 1, 2]) // 1min的kline 最近 n 条值
      const [m1, m2] = await binance.getMaCompare(symbol, '3m', [2, 20]) // 3min的kline 最近 n 条值

      if (k1 > k2 && m1 > m2) {
        // 涨的时刻
        canLong = true
        canShort = false
      } else if (k1 < k2 && m1 < m2) {
        // 跌的时刻
        canLong = false
        canShort = true
      } else {
        canLong = false
        canShort = false
      }

      if (!canLong && !canShort) {
        log(symbol + ':没有达到条件不可开仓')
        return
      }

      const buyOrder = allOpenOrders.find(
        item => item.symbol === symbol && item.side === 'BUY' && item.positionSide === positionSide
      ) // 查询开多的单
      const sellOrder = allOpenOrders.find(
        item => item.symbol === symbol && item.side === 'SELL' && item.positionSide === positionSide
      ) // 查询平多的单
      const positionLong = positions.find(item => item.symbol === symbol && item.positionSide === positionSide) // 是否有多头当前的持仓

      const buyOrderShort = allOpenOrders.find(
        item => item.symbol === symbol && item.side === 'SELL' && item.positionSide === positionSideShort
      ) // 查询开空的单
      const sellOrderShort = allOpenOrders.find(
        item => item.symbol === symbol && item.side === 'BUY' && item.positionSide === positionSideShort
      ) // 查询平空的单
      const positionShort = positions.find(item => item.symbol === symbol && item.positionSide === positionSideShort) // 是否有空头当前的持仓

      if (positionLong && canLong) {
        if (positionLong.positionAmt > 0) {
          // 有持仓
          const { unRealizedProfit, entryPrice, positionAmt } = positionLong
          const nowProfit = (unRealizedProfit / (positionAmt * entryPrice)) * leverage * 100
          const sellPrice = roundOrderPrice(entryPrice * (1 + profit / 100 / leverage), symbol)
          if (k3 > k4) {
            log(symbol + ':处于上升期, 多仓继续等待')
            return
          }
          if (!buyOrder && !sellOrder) {
            // 不是部分买入持仓且没有挂卖单
            if (nowProfit > profit) {
              const result = await binance.sellMarket(symbol, positionAmt, {
                positionSide,
              })
              if (result.code) {
                // 报错了
                notify.notifySellOrderFail(symbol, result.msg)
                await sleep(60 * 1000)
              } else {
                notify.notifySellOrderSuccess(symbol, unRealizedProfit, sellPrice, '做多', '止赢')
                await sleep(10 * 1000)
              }
              log(result)
            } else {
              // 挂平仓的单
              const result = await binance.sellLimit(symbol, positionAmt, sellPrice, {
                positionSide,
              }) // 平仓-平多
              if (result.code) {
                notify.notifySellOrderFail(symbol, result.msg)
                await sleep(60 * 1000)
              } else {
                notify.notifySellOrderSuccess(symbol, unRealizedProfit, sellPrice, '做多', '挂单')
                await sleep(10 * 1000)
              }
              log(result)
            }
          }
          if (!buyOrder && sellOrder) {
            // 止损
            if (nowProfit < -loss) {
              const result = await binance.sellMarket(symbol, positionAmt, {
                positionSide,
              })
              if (result.code) {
                // 报错了
                notify.notifySellOrderFail(symbol, result.msg)
                await sleep(60 * 1000)
              } else {
                notify.notifySellOrderSuccess(
                  symbol,
                  unRealizedProfit,
                  entryPrice * (1 + nowProfit / 100 / leverage),
                  '做多',
                  '止损'
                )
                await sleep(3 * 60 * 1000) // 止损后暂停 3 min
              }
              log(result)
            }
          }
        } else {
          if (!buyOrder) {
            // 没有持仓
            // 没有挂买单
            const { buyPrice } = await getPrice(symbol)
            if (buyOrderShort && buyPrice < buyOrderShort.entryPrice) {
              // 如果买单价格低于买空的价格，就不再买入，直到空单平仓
              return
            }
            const quantity = roundOrderQuantity(buyPrice, (usdt / buyPrice) * leverage) // 购买数量
            await binance.leverage(symbol, leverage) // 修改合约倍数
            await binance.marginType(symbol) // 修改为逐仓模式
            const result = await binance.buyMarket(symbol, Number(quantity), {
              positionSide,
            }) // 市价开仓-开多
            // const result = await binance.buyLimit(symbol, Number(quantity), buyPrice, {
            //   positionSide,
            // }) // 开仓-开多
            if (result.code) {
              notify.notifyBuyOrderFail(symbol, result.msg)
              await sleep(60 * 1000)
            } else {
              notify.notifyBuyOrderSuccess(symbol, quantity, buyPrice)
              await sleep(1 * 1000)
            }
            log('开仓-开多:' + symbol + ',quantity' + quantity)
            log(result)
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
                await sleep(10 * 1000)
              }
              log('撤销订单')
              log(result)
            }
          }
        }
      }

      if (positionShort && canShort) {
        const positionAmt = Math.abs(positionShort.positionAmt) // 空单为负数，取绝对值
        if (positionAmt > 0) {
          // 有持仓
          const { unRealizedProfit, entryPrice } = positionShort
          const nowProfit = (unRealizedProfit / (positionAmt * entryPrice)) * leverage * 100
          const sellPrice = roundOrderPrice(entryPrice * (1 - profit / 100 / leverage), symbol)
          if (k3 < k4) {
            log(symbol + ':处于下跌期, 空仓继续等待')
            return
          }
          if (!buyOrderShort && !sellOrderShort) {
            // 不是部分买入持仓且没有挂卖单
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
                notify.notifySellOrderSuccess(symbol, unRealizedProfit, sellPrice, '做空', '止盈')
                await sleep(10 * 1000)
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
                notify.notifySellOrderSuccess(symbol, unRealizedProfit, sellPrice, '做空', '挂单')
                await sleep(10 * 1000)
              }
              log(result)
            }
          }
          if (!buyOrderShort && sellOrderShort) {
            // 止损
            if (nowProfit < -loss) {
              const result = await binance.buyMarket(symbol, positionAmt, {
                positionSide: positionSideShort,
              })
              if (result.code) {
                // 报错了
                notify.notifySellOrderFail(symbol, result.msg)
                await sleep(60 * 1000)
              } else {
                notify.notifySellOrderSuccess(
                  symbol,
                  unRealizedProfit,
                  entryPrice * (1 - nowProfit / 100 / leverage),
                  '做空',
                  '止损'
                )
                await sleep(3 * 60 * 1000)
              }
              log('止损')
              log(result)
            }
          }
        } else {
          // 没有持仓
          if (!buyOrderShort) {
            // 没有挂买单
            const { sellPrice } = await getPrice(symbol)
            if (buyOrder && sellPrice > buyOrder.entryPrice) {
              // 如果空单开除价格高于买多的价格，就不再开空单，直到买多的单平仓
              return
            }
            await binance.leverage(symbol, leverage) // 修改合约倍数
            await binance.marginType(symbol) // 修改为逐仓模式
            const quantity = roundOrderQuantity(sellPrice, (usdt / sellPrice) * leverage) // 购买数量
            const result2 = await binance.sellMarket(symbol, Number(quantity), {
              positionSide: positionSideShort,
            }) // 开仓-开空市价
            // const result2 = await binance.sellLimit(symbol, Number(quantity), sellPrice, {
            //   positionSide: positionSideShort,
            // }) // 开仓-开空
            if (result2.code) {
              notify.notifyBuyOrderFail(symbol, result2.msg)
              await sleep(60 * 1000)
            } else {
              notify.notifyBuyOrderSuccess(symbol, quantity, sellPrice, '做空')
              await sleep(1 * 1000)
            }
            log('开仓-开空:' + symbol + ',quantity' + quantity)
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
                await sleep(10 * 1000)
              }
              log('撤销订单')
              log(result)
            }
          }
        }
      }
    })
  )
  /*************************************************开始交易挂单与平仓 end************************************************************ */
}

;(async () => {
  log('database sync start')
  await sleep(5 * 1000)
  log('database sync success')
  while (true) {
    // binance.resetWeight()
    try {
      await run()
      // log('weight = ' + binance.getWeight())
      await sleep(sleep_time * 1000)
      log(`wait ${sleep_time} second`)
    } catch (e) {
      log('报错了')
      log(e)
      notify.notifyServiceError(e + 'stop 1 min')
      await sleep(1 * 60 * 1000)
    }
  }

  // const result = await getPrice('BTCUSDT') // { buyPrice: 24299.2, sellPrice: 24304.8 }
  // const result = await binance.getMaCompare('FILUSDT', '3m', [2, 20])
  // console.log(result)

  // const result2 = await binance.getMaCompare('FILUSDT', '3m', [2, 20]) // 1min的kline 最近 n 条值
  // console.log(result2)

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
