const { exit } = require('process')
const { round } = require('mathjs')
const { sleep, log, roundOrderPrice, roundOrderQuantity, tries } = require('./utils')
const { knex } = require('./db')
const { usdt, profit, loss = 100, leverage, buyTimeOut, sleep_time, excludeSymbols, cha, strategy, strategyCoin, maxCount = 10 } = require('./config')
const notify = require('./notify')
const binance = require('./binance')
const { getLongOrShort, canOrderComplete, autoStop } = require(`./strategy/${strategy}`)
const { getCoins } = require(`./strategy/${strategyCoin}`)

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
  const coins = await getCoins(allSymbols)
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
  // const currentSymbols = new Set(coins.map(item => item.symbol)) // 当前要交易的币种
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

  /*************************************************平仓(止盈或止损)已经有持仓的币(排除手动交易白名单) start************************************************************ */
  const positionFilter = positions.filter(
    item =>
      Number(item.positionAmt) != 0 && // 有持仓的
      // !currentSymbols.has(item.symbol) && // 非当前选定的币种(这种在下面处理，否则可能造成数据没有再次查询的缓存错误)
      !excludeOrderSymbols.has(item.symbol) // 非手动交易的白名单
  )
  if (positionFilter.length > 0) {
    await Promise.all(
      positionFilter.map(async posi => {
        const positionAmt = Math.abs(posi.positionAmt) // 空单为负数
        const { unRealizedProfit, entryPrice } = posi
        const nowProfit = (unRealizedProfit / (positionAmt * entryPrice)) * leverage * 100 // 当前收益率(正为盈利，负为亏损)

        // const isStop = await autoStop(posi.symbol, posi.positionSide, nowProfit)
        const isStop = false
        if (isStop) {
          if (posi.positionSide === 'LONG') {
            await binance.sellMarket(posi.symbol, positionAmt, {
              positionSide: posi.positionSide,
            })
          }
          // 做空时, 价格持续上涨中
          if (posi.positionSide === 'SHORT') {
            await binance.buyMarket(posi.symbol, positionAmt, {
              positionSide: posi.positionSide,
            })
          }
        }
        // 平仓(止损)
        else if (nowProfit <= -loss) {
          // 做多时，价格持续下跌中
          if (posi.positionSide === 'LONG') {
            const canOrder = await canOrderComplete(posi.symbol, 'LONG')
            if (canOrder) {
              await binance.sellMarket(posi.symbol, positionAmt, {
                positionSide: posi.positionSide,
              })
            }
          }
          // 做空时, 价格持续上涨中
          if (posi.positionSide === 'SHORT') {
            const canOrder = await canOrderComplete(posi.symbol, 'SHORT')
            if (canOrder) {
              await binance.buyMarket(posi.symbol, positionAmt, {
                positionSide: posi.positionSide,
              })
            }
          }
        }
        // 平仓(止盈)
        else if (nowProfit >= profit) {
          // 做多时，价格下跌中
          if (posi.positionSide === 'LONG') {
            const canOrder = await canOrderComplete(posi.symbol, 'LONG')
            if (canOrder) {
              await binance.sellMarket(posi.symbol, positionAmt, {
                positionSide: posi.positionSide,
              })
            }
          }
          // 做空时, 价格上涨中
          if (posi.positionSide === 'SHORT') {
            const canOrder = await canOrderComplete(posi.symbol, 'SHORT')
            if (canOrder) {
              await binance.buyMarket(posi.symbol, positionAmt, {
                positionSide: posi.positionSide,
              })
            }
          }
        }
      })
    )
    if (positionFilter.length >= maxCount) {
      log(`当前仓位数量为${positionFilter.length}达到当前仓位最大数量${maxCount}，暂时无法开启新的仓位`)
      return
    }
  }
  /*************************************************平仓 end************************************************************ */

  /*************************************************开始交易挂单与平仓 start************************************************************ */
  await Promise.all(
    coins.map(async coin => {
      const positionSide = 'LONG'
      const positionSideShort = 'SHORT'
      let { symbol } = coin

      const { canLong, canShort } = await getLongOrShort(symbol)

      if (!canLong && !canShort) {
        log(symbol + ':没有达到条件不可开仓')
      }

      const buyOrder = allOpenOrders.find(
        item => item.symbol === symbol && item.side === 'BUY' && item.positionSide === positionSide
      ) // 查询开多的单
      // const sellOrder = allOpenOrders.find(
      //   item => item.symbol === symbol && item.side === 'SELL' && item.positionSide === positionSide
      // ) // 查询平多的单
      const positionLong = positions.find(item => item.symbol === symbol && item.positionSide === positionSide) // 是否有多头当前的持仓

      const buyOrderShort = allOpenOrders.find(
        item => item.symbol === symbol && item.side === 'SELL' && item.positionSide === positionSideShort
      ) // 查询开空的单
      // const sellOrderShort = allOpenOrders.find(
      //   item => item.symbol === symbol && item.side === 'BUY' && item.positionSide === positionSideShort
      // ) // 查询平空的单
      const positionShort = positions.find(item => item.symbol === symbol && item.positionSide === positionSideShort) // 是否有空头当前的持仓

      if (positionLong) {
        if (positionLong.positionAmt > 0) {
          // 有持仓(不进行挂单处理，直接通过上面平仓逻辑处理)
          // 有多单的持仓(不在考虑部分买入的情况)
          // const { unRealizedProfit, entryPrice, positionAmt } = positionLong
          // const nowProfit = (unRealizedProfit / (positionAmt * entryPrice)) * leverage * 100 // 当前收益率
          // const sellPrice = roundOrderPrice(entryPrice * (1 + profit / 100 / leverage), symbol) // 准备卖的挂单价格
          // const canOrder = await canOrderComplete(symbol, positionSide)
          // if (nowProfit >= profit && canOrder) {
          //   // 达到止盈点，价格在下跌中，按市价卖出
          //   const result = await binance.sellMarket(symbol, positionAmt, {
          //     positionSide,
          //   })
          //   if (result.code) {
          //     // 报错了
          //     notify.notifySellOrderFail(symbol, result.msg)
          //     await sleep(60 * 1000)
          //   } else {
          //     notify.notifySellOrderSuccess(symbol, unRealizedProfit, sellPrice, '做多', '止赢')
          //     await sleep(60 * 1000) // 止盈后暂停 1min
          //   }
          //   log(result)
          // } else if (nowProfit <= -loss && canOrder) {
          //   // 到达止损点，价格在上涨中
          //   const result = await binance.sellMarket(symbol, positionAmt, {
          //     positionSide,
          //   })
          //   if (result.code) {
          //     // 报错了
          //     notify.notifySellOrderFail(symbol, result.msg)
          //     await sleep(60 * 1000)
          //   } else {
          //     notify.notifySellOrderSuccess(
          //       symbol,
          //       unRealizedProfit,
          //       entryPrice * (1 + nowProfit / 100 / leverage),
          //       '做多',
          //       '止损'
          //     )
          //     await sleep(60 * 1000) // 止损后暂停 1min
          //   }
          //   log(result)
          // } else if (nowProfit <= profit && nowProfit >= -loss) {
          //   // 不再挂单，止盈全部走市价平仓
          //   // 挂止盈平仓的单
          //   // const result = await binance.sellLimit(symbol, positionAmt, sellPrice, {
          //   //   positionSide,
          //   // }) // 平仓-平多
          //   // if (result.code) {
          //   //   notify.notifySellOrderFail(symbol, result.msg)
          //   //   await sleep(60 * 1000)
          //   // } else {
          //   //   notify.notifySellOrderSuccess(symbol, unRealizedProfit, sellPrice, '做多', '挂单')
          //   //   await sleep(10 * 1000)
          //   // }
          //   // log(result)
          // }
        } else {
          // 没有持仓，没有挂买单
          if (!buyOrder) {
            // 允许做多
            if (canLong) {
              // 准备做多单时，此时有当前币种的空方向持仓
              if (positionShort) {
                const { unRealizedProfit, entryPrice } = positionShort
                const positionAmt = Math.abs(positionShort.positionAmt) // 空单为负数，取绝对值
                const nowProfit = (unRealizedProfit / (positionAmt * entryPrice)) * leverage * 100
                if (nowProfit < (-loss / 3)) { // 如果空单的收益，已经达到止损的 1/3 了，就立刻平仓，因为此时风向一变
                  const resultBuy = await binance.buyMarket(symbol, positionAmt, {
                    positionSide: positionSideShort,
                  })
                  if (resultBuy.code) {
                    // 报错了
                    notify.notifySellOrderFail(symbol, resultBuy.msg)
                  } else {
                    notify.notifySellOrderSuccess(
                      symbol,
                      unRealizedProfit,
                      entryPrice * (1 - nowProfit / 100 / leverage),
                      '平空',
                      '反向做多单，空单止损'
                    )
                  }
                  log('反向做多单，空单止损')
                  log(resultBuy)
                }
              }
              
              const { buyPrice } = await getPrice(symbol)
              if (buyOrderShort && buyPrice < buyOrderShort.entryPrice) {
                // 如果买单价格低于买空的价格，就不再买入，直到空单平仓
                return
              }
              const quantity = roundOrderQuantity(buyPrice, (usdt / buyPrice) * leverage, symbol) // 购买数量
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
                await sleep(30 * 1000)
              }
              log(`开仓-开多:${symbol},quantity:${quantity},price:${buyPrice}`)
              log(result)
            }
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

      if (positionShort) {
        const positionAmt = Math.abs(positionShort.positionAmt) // 空单为负数，取绝对值
        if (positionAmt > 0) {
          // 有持仓(不进行挂单处理，直接通过上面平仓逻辑处理)
          // const { unRealizedProfit, entryPrice } = positionShort
          // const nowProfit = (unRealizedProfit / (positionAmt * entryPrice)) * leverage * 100
          // const sellPrice = roundOrderPrice(entryPrice * (1 - profit / 100 / leverage), symbol)
          // const canOrder = await canOrderComplete(symbol, positionSideShort)
          // if (nowProfit >= profit && canOrder) {
          //   // 达到止盈点，价格在上涨中，按市价卖出
          //   const result = await binance.buyMarket(symbol, positionAmt, {
          //     positionSide: positionSideShort,
          //   })
          //   if (result.code) {
          //     // 报错了
          //     notify.notifySellOrderFail(symbol, result.msg)
          //     await sleep(60 * 1000)
          //   } else {
          //     notify.notifySellOrderSuccess(symbol, unRealizedProfit, sellPrice, '做空', '止盈')
          //     await sleep(60 * 1000)
          //   }
          //   log(result)
          // } else if (nowProfit < -loss && canOrder) {
          //   // 达到止损点，价格在上涨中
          //   const result = await binance.buyMarket(symbol, positionAmt, {
          //     positionSide: positionSideShort,
          //   })
          //   if (result.code) {
          //     // 报错了
          //     notify.notifySellOrderFail(symbol, result.msg)
          //     await sleep(60 * 1000)
          //   } else {
          //     notify.notifySellOrderSuccess(
          //       symbol,
          //       unRealizedProfit,
          //       entryPrice * (1 - nowProfit / 100 / leverage),
          //       '做空',
          //       '止损'
          //     )
          //     await sleep(60 * 1000)
          //   }
          //   log('止损')
          //   log(result)
          // } else if (nowProfit <= profit && nowProfit >= -loss) {
          //   // 挂平仓的单
          //   // const result = await binance.buyLimit(symbol, positionAmt, sellPrice, {
          //   //   positionSide: positionSideShort,
          //   // }) // 平仓-平空
          //   // if (result.code) {
          //   //   notify.notifySellOrderFail(symbol, result.msg)
          //   //   await sleep(60 * 1000)
          //   // } else {
          //   //   notify.notifySellOrderSuccess(symbol, unRealizedProfit, sellPrice, '做空', '挂单')
          //   //   await sleep(10 * 1000)
          //   // }
          //   // log(result)
          // }
        } else {
          // 没有持仓,没有挂买单
          if (!buyOrderShort) {
            // 允许做空
            if (canShort) {
              // 准备做多空时，此时有当前币种的多方向持仓
              if (positionLong) {
                const { unRealizedProfit, entryPrice, positionAmt } = positionLong
                const nowProfit = (unRealizedProfit / (positionAmt * entryPrice)) * leverage * 100 // 当前收益率
                if (nowProfit < (-loss / 3)) { // 多单的收益，已经达到止损的 1/3 了，就立刻平仓，因为此时风向一变
                  const resultSell = await binance.sellMarket(symbol, positionAmt, {
                    positionSide: positionSide,
                  })
                  if (resultSell.code) {
                    // 报错了
                    notify.notifySellOrderFail(symbol, resultSell.msg)
                  } else {
                    notify.notifySellOrderSuccess(
                      symbol,
                      unRealizedProfit,
                      entryPrice * (1 + nowProfit / 100 / leverage),
                      '平多',
                      '反向做空单，多单止损'
                    )
                  }
                  log('反向做空单，多单止损')
                  log(resultSell)
                }
              }
              
              const { sellPrice } = await getPrice(symbol)
              if (buyOrder && sellPrice > buyOrder.entryPrice) {
                // 如果空单开除价格高于买多的价格，就不再开空单，直到买多的单平仓
                return
              }
              await binance.leverage(symbol, leverage) // 修改合约倍数
              await binance.marginType(symbol) // 修改为逐仓模式
              const quantity = roundOrderQuantity(sellPrice, (usdt / sellPrice) * leverage, symbol) // 购买数量
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
                await sleep(30 * 1000) // 开单成功后，暂停30秒中
                log(`开仓-开空:${symbol},quantity:${quantity},price:${sellPrice}`)
              }
              log(result2)
            }
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
