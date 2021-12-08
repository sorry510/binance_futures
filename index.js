const { exit } = require('process')
const { round } = require('mathjs')
const { sleep, log, roundOrderPrice, tries } = require('./utils')
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
    buyPrice: roundOrderPrice(avg(result.bids)),
    sellPrice: roundOrderPrice(avg(result.asks)),
  }
}

async function run() {
  // await createTableIF() // 创建数据库

  /************************************************寻找交易币种 start******************************************************************* */
  const allSymbols = await tries(async () => await knex('symbols').where('enable', '1')) // 查询所有开启的币种
  if (!Array.isArray(allSymbols)) {
    notify.notifyServiceError(JSON.stringify(allSymbols))
    exit()
  }
  const sortAllSymbols = allSymbols
    .map(item => ({ ...item, percentChange: Number(item.percentChange) }))
    .sort((a, b) => (a.percentChange < b.percentChange ? -1 : 1)) // 涨幅从小到大排序

  const posiSymbols = sortAllSymbols.filter(item => item.percentChange > 0) // 涨的币
  const negaSymbols = sortAllSymbols.filter(item => item.percentChange <= 0) // 跌的币

  const posiSymbolsReverse = posiSymbols.reverse() // 从高到低排
  const posiSymbol = posiSymbolsReverse.find((item, key) => {
    if (key < posiSymbolsReverse.length - 1) {
      const perCha = item.percentChange - posiSymbolsReverse[key + 1].percentChange // 2个币种之间的涨幅差
      return perCha > cha[0] && perCha < cha[1]
    }
  }) // 买多币种

  const negaSymbol = negaSymbols.find((item, key) => {
    if (key < negaSymbols.length - 1) {
      const perCha = negaSymbols[key + 1].percentChange - item.percentChange // 2个币种之间的涨幅差
      return perCha > cha[0] && perCha < cha[1]
    }
  }) // 买空币种

  let coins = []
  if (posiSymbols.length <= 4) {
    // 判定所有币都在跌,只买空
    if (negaSymbol) {
      coins.push({
        symbol: negaSymbol.symbol,
        canLong: false, // 开启多单
        canShort: true, // 开启空单
      })
    }
  } else if (negaSymbols.length <= 4) {
    // 判定所有币都在涨,只买多
    if (posiSymbol) {
      coins.push({
        symbol: posiSymbol.symbol,
        canLong: true, // 开启多单
        canShort: false, // 开启空单
      })
    }
  } else {
    // 在最低的开启空单，最高的开启多单
    if (negaSymbol) {
      coins.push({
        symbol: negaSymbol.symbol,
        canLong: false, // 开启多单
        canShort: true, // 开启空单
      })
    }
    if (posiSymbol) {
      coins.push({
        symbol: posiSymbol.symbol,
        canLong: true, // 开启多单
        canShort: false, // 开启空单
      })
    }
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
  // if (openOrderFilter.length > 0) {
  //   // 撤销挂单
  //   await Promise.all(
  //     openOrderFilter.map(async order => {
  //       await binance.cancelOrder(order.symbol, order.orderId) // 撤销挂单
  //     })
  //   )
  // }
  /*************************************************撤销挂单 end************************************************************ */

  /*************************************************强制平仓 start************************************************************ */
  const positionFilter = positions.filter(
    item =>
      Number(item.positionAmt) != 0 && // 有持仓的
      !currentSymbols.has(item.symbol) && // 非当前要挂单的币种
      !excludeOrderSymbols.has(item.symbol) // 非手动交易的白名单
  )
  if (positionFilter.length > 0) {
    // 强制平仓
    await Promise.all(
      positionFilter.map(async posi => {
        const positionAmt = Math.abs(posi.positionAmt) // 空单为负数
        const { unRealizedProfit, entryPrice } = posi
        const nowProfit = (unRealizedProfit / (positionAmt * entryPrice)) * leverage * 100
        if (nowProfit <= -profit || nowProfit >= profit) {
          // 收益在止盈之外的
          if (posi.positionSide === 'LONG') {
            // 存在多头,平多

            await binance.sellMarket(posi.symbol, positionAmt, {
              positionSide: posi.positionSide,
            })
          } else if (posi.positionSide === 'SHORT') {
            // 存在空头,平空
            await binance.buyMarket(posi.symbol, positionAmt, {
              positionSide: posi.positionSide,
            })
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
      const { symbol, canLong, canShort } = coin

      if (!canLong && !canShort) {
        return
      }

      // const allOpenOrders = await binance.getOpenOrder(symbol) // 当前币种的订单
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

      // console.log(JSON.stringify(positionShort))
      // process.exit()

      if (positionLong && canLong) {
        if (positionLong.positionAmt > 0) {
          // 有持仓
          const { unRealizedProfit, entryPrice, positionAmt } = positionLong
          const nowProfit = (unRealizedProfit / (positionAmt * entryPrice)) * leverage * 100
          const sellPrice = roundOrderPrice(entryPrice * (1 + profit / 100 / leverage))
          if (!buyOrder && !sellOrder) {
            // 不是部分买入持仓且没有挂卖单
            if (nowProfit > profit) {
              // 当前价格高于止盈率
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
          // 没有持仓
          if (!buyOrder) {
            // 没有挂买单
            const { buyPrice } = await getPrice(symbol)
            if (buyOrderShort && buyPrice < buyOrderShort.entryPrice) {
              // 如果买单价格低于买空的价格，就不再买入，直到空单平仓
              return
            }
            const quantity = round((usdt / buyPrice) * leverage, 0) // 购买数量
            await binance.leverage(symbol, leverage) // 修改合约倍数
            await binance.marginType(symbol) // 修改为逐仓模式
            const result = await binance.buyLimit(symbol, Number(quantity), buyPrice, {
              positionSide,
            }) // 开仓-开多
            if (result.code) {
              notify.notifyBuyOrderFail(symbol, result.msg)
              await sleep(60 * 1000)
            } else {
              notify.notifyBuyOrderSuccess(symbol, quantity, buyPrice)
              await sleep(1 * 1000)
            }
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
          const sellPrice = roundOrderPrice(entryPrice * (1 - profit / 100 / leverage))
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
            const quantity = round((usdt / sellPrice) * leverage, 0) // 购买数量
            const result2 = await binance.sellLimit(symbol, Number(quantity), sellPrice, {
              positionSide: positionSideShort,
            }) // 开仓-开空
            if (result2.code) {
              notify.notifyBuyOrderFail(symbol, result2.msg)
              await sleep(60 * 1000)
            } else {
              notify.notifyBuyOrderSuccess(symbol, quantity, sellPrice, '做空')
              await sleep(1 * 1000)
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
                await sleep(10 * 1000)
              }
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
    binance.resetWeight()
    try {
      await run()
      log('weight = ' + binance.getWeight())
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
