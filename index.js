const Binance = require('node-binance-api')
const process = require('process')
const fs = require('fs')
const { round } = require('mathjs')
const { sleep, log, dateFormat } = require('./utils')
const knex = require('./db')
const binance = require('./binance')

async function run() {
  await knex.createTableIF()
  // const account = await binance.getAccount() // 当前账户信息
  // const { availableBalance } = account // 可用余额

  // const result = await binance.getPrices() // 当前所有币种价格

  // const result = await binance.buyLimit('DOTUSDT', 0.5, 12, {
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

  // console.log(JSON.stringify(result))
  process.exit()

  // const ticks = await binance.candlesticks('ADAUSDT', '1m')
  // let last_tick = ticks[ticks.length - 1]
  // let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] =
  //   last_tick
  // console.log(last_tick)
}

;(async () => {
  while (true) {
    await run()
    // log('wait 120 seconds')
    await sleep(120 * 1000) // 有交易成功的时候，暂停交易 2 min
  }
})()
