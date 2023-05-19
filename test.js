const { knex, createTableIF } = require('./db')
const { tries, log, isAsc, isDesc } = require('./utils')
const { usdt, profit, loss, leverage, buyTimeOut, sleep_time, excludeSymbols, cha, strategy } = require('./config')
const binance = require('./binance')

// ;(async () => {
//   await createTableIF()
//   const data = await tries(async () => await knex('symbols'))
//   log(data)
// })()

;(async () => {
  const symbol = 'OPUSDT'
  const [k1, k2, k3] = await binance.getKlineAvg(symbol, '1m', [1, 3, 6]) // 1min的kline 最近 n 条值
  console.log(k1, k2, k3)
  const [m1, m2, m3] = await binance.getKlineAvg(symbol, '3m', [20, 20 * 2, 20 * 4]) // 3min的kline 近1小时和近4小时
  console.log(m1, m2, m3)
})()