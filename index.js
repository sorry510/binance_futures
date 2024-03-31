const { exit } = require('process')
const fs = require('fs')
const { round } = require('mathjs')
const { sleep, log, roundOrderPrice, roundOrderQuantity, tries } = require('./utils')
const { knex } = require('./db')
const { usdt, profit = 10, loss = 100, leverage, buyTimeOut, sleep_time, excludeSymbols = [], strategy, strategyCoin, maxCount = 10, orderType = 'MARKET', allowLong = true, allowShort = true } = require('./config')
const notify = require('./notify')
const binance = require('./binance')
const { getLongOrShort, canOrderComplete, autoStop } = require(`./strategy/${strategy}`)
const { getCoins } = require(`./strategy/${strategyCoin}`)
const excludeOrderSymbols = new Set(excludeSymbols) // 手动交易的白名单

/**
 * 根据深度获取合适的买卖价格
 * @param string symbol 
 * @returns {Promise<{buyPrice: number, sellPrice: number}>}
 */
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
  /**
   * @type {Array<import('./type').Symbol>}
   */
  const coins = await getCoins(allSymbols)
  /************************************************寻找交易币种 end******************************************************************* */

  /************************************************获取账户信息 start******************************************************************* */

  /**
   * @type {import('./type').Position[]}
   */
  const positions = await binance.getPosition() // 获取当前持有仓位
  if (!Array.isArray(positions)) {
    notify.notifyServiceError(JSON.stringify(positions))
    await sleep(300 * 1000)
    return
  }
  /**
   * @type {import('./type').Order[]}
   */
  const allOpenOrders = await binance.getOpenOrder() // 当前开仓的所有订单
  if (!Array.isArray(allOpenOrders)) {
    notify.notifyServiceError(JSON.stringify(allOpenOrders))
    await sleep(300 * 1000)
    return
  }
  
  /************************************************获取账户信息 end******************************************************************* */

  /*************************************************挂单已经超过设置的超时时间，撤销挂单 start************************************************************ */
  await cancelTimeOutOrder(coins, allOpenOrders)
  /*************************************************挂单已经超过设置的超时时间，撤销挂单 end************************************************************ */

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

        const isStop = await autoStop(posi, nowProfit)
        if (isStop) {
          log(`${posi.symbol}:auto_stop_start`)
          if (posi.positionSide === 'LONG') {
            const result = await binance.sellMarket(posi.symbol, positionAmt, {
              positionSide: posi.positionSide,
            })
            const price = result ? result.avgPrice : 0
            await tries(async () => await knex('order').insert({
              symbol: posi.symbol,
              amount: positionAmt,
              avg_price: price,
              inexact_profit: unRealizedProfit,
              positionSide: posi.positionSide,
              side: 'close',
              updateTime: +new Date(),
            }))
            notify.notifySellOrderSuccess(posi.symbol, unRealizedProfit, price, '平仓', '风向改变,自动平仓')
            log(`${posi.symbol}:auto_stop_success`)
          }
          // 做空时, 价格持续上涨中
          if (posi.positionSide === 'SHORT') {
            const result = await binance.buyMarket(posi.symbol, positionAmt, {
              positionSide: posi.positionSide,
            })
            const price = result ? result.avgPrice : 0
            await tries(async () => await knex('order').insert({
              symbol: posi.symbol,
              amount: positionAmt,
              avg_price: price,
              inexact_profit: unRealizedProfit,
              positionSide: posi.positionSide,
              side: 'close',
              updateTime: +new Date(),
            }))
            notify.notifySellOrderSuccess(posi.symbol, unRealizedProfit, price, '平仓', '风向改变,自动平仓')
            log(`${posi.symbol}:auto_stop_success`)
          }
        }
        // 平仓(止损)
        else if (nowProfit <= -loss) {
          // 做多时，价格持续下跌中
          if (posi.positionSide === 'LONG') {
            const canOrder = await canOrderComplete(posi.symbol, 'LONG')
            if (canOrder) {
              const result = await binance.sellMarket(posi.symbol, positionAmt, {
                positionSide: posi.positionSide,
              })
              const price = result ? result.avgPrice : 0
              await tries(async () => await knex('order').insert({
                symbol: posi.symbol,
                amount: positionAmt,
                avg_price: price,
                inexact_profit: unRealizedProfit,
                positionSide: posi.positionSide,
                side: 'close',
                updateTime: +new Date(),
              }))
              notify.notifySellOrderSuccess(posi.symbol, unRealizedProfit, price, '平仓', '止损,自动平仓')
            }
          }
          // 做空时, 价格持续上涨中
          if (posi.positionSide === 'SHORT') {
            const canOrder = await canOrderComplete(posi.symbol, 'SHORT')
            if (canOrder) {
              const result = await binance.buyMarket(posi.symbol, positionAmt, {
                positionSide: posi.positionSide,
              })
              const price = result ? result.avgPrice : 0
              await tries(async () => await knex('order').insert({
                symbol: posi.symbol,
                amount: positionAmt,
                avg_price: price,
                inexact_profit: unRealizedProfit,
                positionSide: posi.positionSide,
                side: 'close',
                updateTime: +new Date(),
              }))
              notify.notifySellOrderSuccess(posi.symbol, unRealizedProfit, price, '平仓', '止损,自动平仓')
            }
          }
        }
        // 平仓(止盈)
        else if (nowProfit >= profit) {
          // 做多时，价格下跌中
          if (posi.positionSide === 'LONG') {
            const canOrder = await canOrderComplete(posi.symbol, 'LONG')
            if (canOrder) {
              const result = await binance.sellMarket(posi.symbol, positionAmt, {
                positionSide: posi.positionSide,
              })
              const price = result ? result.avgPrice : 0
              await tries(async () => await knex('order').insert({
                symbol: posi.symbol,
                amount: positionAmt,
                avg_price: price,
                inexact_profit: unRealizedProfit,
                positionSide: posi.positionSide,
                side: 'close',
                updateTime: +new Date(),
              }))
              notify.notifySellOrderSuccess(posi.symbol, unRealizedProfit, price, '平仓', '止盈,自动平仓')
            }
          }
          // 做空时, 价格上涨中
          if (posi.positionSide === 'SHORT') {
            const canOrder = await canOrderComplete(posi.symbol, 'SHORT')
            if (canOrder) {
              const result = await binance.buyMarket(posi.symbol, positionAmt, {
                positionSide: posi.positionSide,
              })
              const price = result ? result.avgPrice : 0
              await tries(async () => await knex('order').insert({
                symbol: posi.symbol,
                amount: positionAmt,
                avg_price: price,
                inexact_profit: unRealizedProfit,
                positionSide: posi.positionSide,
                side: 'close',
                updateTime: +new Date(),
              }))
              notify.notifySellOrderSuccess(posi.symbol, unRealizedProfit, price, '平仓', '止盈,自动平仓')
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

  /*************************************************开仓(根据选币策略选中的币) start************************************************************ */
  await Promise.all(
    coins.map(async coin => {
      const positionSide = 'LONG'
      const positionSideShort = 'SHORT'
      let { symbol } = coin
      if (excludeOrderSymbols.has(symbol)) {
        // 白名单内不开仓
        return;
      }

      const { canLong, canShort } = await getLongOrShort(symbol)

      if (!canLong && !canShort) {
        log(symbol + ':没有达到条件不可开仓')
        return;
      }

      const buyOrder = allOpenOrders.find(
        item => item.symbol === symbol && item.side === 'BUY' && item.positionSide === positionSide
      ) // 查询开多的单
      const positionLong = positions.find(item => item.symbol === symbol && item.positionSide === positionSide) // 此币种的多仓

      const buyOrderShort = allOpenOrders.find(
        item => item.symbol === symbol && item.side === 'SELL' && item.positionSide === positionSideShort
      ) // 查询开空的单
      const positionShort = positions.find(item => item.symbol === symbol && item.positionSide === positionSideShort) // 此币种的空仓

      if (
        allowLong && // 配置允许做多
        positionLong && positionLong.positionAmt <= 0 && // 没有此币种的多仓
        !buyOrder && // 没有此币种开多的订单
        canLong // 策略结果是可以做多
      ) {
        const { buyPrice } = await getPrice(symbol) // 根据深度获取到的合适价格
        if (buyOrderShort && buyPrice < buyOrderShort.avgPrice) {
          // 如果买单价格低于买空的价格，就不再买入，直到空单平仓
          return
        }
        const quantity = roundOrderQuantity(buyPrice, (usdt / buyPrice) * leverage, symbol) // 购买数量
        await binance.leverage(symbol, leverage) // 修改合约倍数
        await binance.marginType(symbol) // 修改为逐仓模式
        let result = {}
        if (orderType === 'MARKET') {
          result = await binance.buyMarket(symbol, Number(quantity), {
            positionSide,
          }) // 市价开仓-开多
        } else if (orderType === 'LIMIT') {
          result = await binance.buyLimit(symbol, Number(quantity), buyPrice, {
            positionSide,
          }) // 限价开仓-开多
        }
        if (result.code) {
          notify.notifyBuyOrderFail(symbol, result.msg)
          await sleep(20 * 1000)
        } else {
          const price = result ? result.avgPrice : 0
          await tries(async () => await knex('order').insert({
            symbol: symbol,
            amount: quantity,
            avg_price: price,
            // inexact_profit: 0,
            positionSide: positionSide,
            side: 'open',
            updateTime: +new Date(),
          }))
          notify.notifyBuyOrderSuccess(symbol, quantity, buyPrice)
          await sleep(20 * 1000)
        }
        log(`开仓-开多:${symbol},quantity:${quantity},price:${buyPrice}`)
        log(result)
      }

      if (
        allowShort && // 配置允许做空
        positionShort && Math.abs(positionShort.positionAmt) <= 0 && // 没有此币种的空仓
        !buyOrderShort && // 没有此币种开空的订单
        canShort // 策略结果是可以做空
      ) {
        const { sellPrice } = await getPrice(symbol)
        if (buyOrder && sellPrice > buyOrder.avgPrice) {
          // 如果空单开除价格高于买多的价格，就不再开空单，直到买多的单平仓
          return
        }
        await binance.leverage(symbol, leverage) // 修改合约倍数
        await binance.marginType(symbol) // 修改为逐仓模式
        const quantity = roundOrderQuantity(sellPrice, (usdt / sellPrice) * leverage, symbol) // 购买数量
        let result2 = {}
        if (orderType === 'MARKET') {
          result2 = await binance.sellMarket(symbol, Number(quantity), {
            positionSide: positionSideShort,
          }) // 开仓-开空市价
        } else if (orderType === 'LIMIT') {
          result2 = await binance.sellLimit(symbol, Number(quantity), sellPrice, {
            positionSide: positionSideShort,
          }) // 开仓-开空
        }
        if (result2.code) {
          notify.notifyBuyOrderFail(symbol, result2.msg)
          await sleep(20 * 1000)
        } else {
          const price = result2 ? result2.avgPrice : 0
          await tries(async () => await knex('order').insert({
            symbol: symbol,
            amount: quantity,
            avg_price: price,
            // inexact_profit: 0,
            positionSide: positionSideShort,
            side: 'open',
            updateTime: +new Date(),
          }))
          notify.notifyBuyOrderSuccess(symbol, quantity, sellPrice, '做空')
          await sleep(20 * 1000) // 开单成功后，暂停30秒中
          log(`开仓-开空:${symbol},quantity:${quantity},price:${sellPrice}`)
        }
        log(result2)
      }
    })
  )
  /*************************************************开仓 end************************************************************ */
}


/**
 * 挂单已经超过设置的超时时间，撤销挂单
 * @param {import('./type').Symbol[]} coins
 * @param {import('./type').Order[]} allOpenOrders
 */
async function cancelTimeOutOrder(coins, allOpenOrders) {
  const currentSymbols = new Set(coins.map(item => item.symbol)) // 选币策略获取的交易的币种
  const openOrderFilter = allOpenOrders.filter(
    item =>
      !currentSymbols.has(item.symbol) && // 非选币策略获取的交易的币种
      !excludeOrderSymbols.has(item.symbol) // 非手动交易的白名单
  )
  await Promise.all(
    openOrderFilter.map(async buyOrder => {
      // 有挂单，检查是否超时，超时取消挂单
      const nowTime = +new Date()
      if (nowTime > Number(buyOrder.updateTime) + buyTimeOut * 1000) {
        const result = await binance.cancelOrder(buyOrder.symbol, buyOrder.orderId) // 撤销订单
        if (result.code) {
          notify.notifyCancelOrderFail(buyOrder.symbol, result.msg)
        } else {
          notify.notifyCancelOrderSuccess(buyOrder.symbol)
        }
        log('撤销超时的开仓订单')
        log(result)
      }
    })
  )
}

function checkDb() {
  const dbFile = './data/data.db'
  if (!fs.existsSync(dbFile)) {
    console.log(`
not found db in ${dbFile}, 
please run command 'cp data/data.db.example data/data.db'
    `)
    process.exit()
  }
}


;(async () => {
  checkDb()
  
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
