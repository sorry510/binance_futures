const process = require('process')
const fs = require('fs')
const Binance = require('node-binance-api')
const { round } = require('mathjs')
const config = require('./config')
const { sleep, log, dateFormat, tries } = require('./utils')
const { knex, createTableIF } = require('./db')

Object.defineProperty(global, '__stack', {
  get: function () {
    var orig = Error.prepareStackTrace
    Error.prepareStackTrace = function (_, stack) {
      return stack
    }
    var err = new Error()
    Error.captureStackTrace(err, arguments.callee)
    var stack = err.stack
    Error.prepareStackTrace = orig
    return stack
  },
})

Object.defineProperty(global, '__line', {
  get: function () {
    return __stack[1].getLineNumber()
  },
})

Object.defineProperty(global, '__function', {
  get: function () {
    return __stack[1].getFunctionName()
  },
})

const binance = new Binance().options({
  APIKEY: config.api_key,
  APISECRET: config.api_secret,
})

let weight = 0
const flag = false

function resetWeight() {
  log(`${__function}: ${weight}`, flag)
  weight = 0
}

function getWeight() {
  return weight
}

/**
 * 当前账户信息
 * @document ./doc/futuresAccount.js
 * @returns
 */
async function getAccount() {
  const account = await binance.futuresAccount()
  weight += 5
  log(`${__function}: ${weight}`, flag)
  // const { availableBalance } = account // 可用余额
  return account
}

/**
 * @document ./doc/futuresAccount.js
 * @returns
 */
async function getPosition() {
  const result = await binance.futuresPositionRisk()
  weight += 5
  log(`${__function}: ${weight}`, flag)
  return result
}

/**
 * 当前所有币种价格
 * @document ./doc/futuresPrices.js
 * @returns
 */
async function getPrices() {
  const result = await binance.futuresPrices()
  return result
}

/**
 * 比较2个MA
 * @param string symbol
 * @param string type
 * @param number keys
 */
async function getMaCompare(symbol, type, keys) {
  const limit = Math.max(...keys) + 1
  let result = await binance.futuresCandles(symbol, type, { limit })
  result = result.map(item => Number(item[4])).reverse() // 获取最新到以前的收盘价

  function avg(arr, key) {
    return arr.slice(0, key).reduce((carry, item) => carry + item, 0) / key
  }
  return keys.map(key => avg(result, key))
}

/**
 * 限价买入
 * @param string symbol
 * @param Number quantity
 * @param number price
 * @param {} otherOptions https://binance-docs.github.io/apidocs/futures/cn/#trade-3
 */
async function buyLimit(symbol, quantity, price, otherOptions) {
  const result = await binance.futuresBuy(symbol, quantity, price, otherOptions) // 限定价格买入
  weight += 1
  log(`${__function}: ${weight}`, flag)
  return result
}

/**
 * 限价卖出
 * @param string symbol
 * @param Number quantity
 * @param number price
 * @param {} otherOptions https://binance-docs.github.io/apidocs/futures/cn/#trade-3
 */
async function sellLimit(symbol, quantity, price, otherOptions) {
  const result = await binance.futuresSell(symbol, quantity, price, otherOptions) // 限定价格卖出
  weight += 1
  log(`${__function}: ${weight}`, flag)
  return result
}

/**
 * 市价买入
 * @param string symbol
 * @param Number quantity
 * @param number price
 * @param {} otherOptions https://binance-docs.github.io/apidocs/futures/cn/#trade-3
 */
async function buyMarket(symbol, quantity, otherOptions) {
  const result = await binance.futuresMarketBuy(symbol, quantity, otherOptions) // 市价买入
  weight += 1
  log(`${__function}: ${weight}`, flag)
  return result
}

/**
 * 市价卖出
 * @param string symbol
 * @param Number quantity
 * @param number price
 * @param {} otherOptions https://binance-docs.github.io/apidocs/futures/cn/#trade-3
 */
async function sellMarket(symbol, quantity, otherOptions) {
  const result = await binance.futuresMarketSell(symbol, quantity, otherOptions) // 市价卖出
  weight += 1
  log(`${__function}: ${weight}`, flag)
  return result
}

/**
 * 撤销订单
 * @param string symbol
 * @param Number orderId
 * @param {} otherOptions https://binance-docs.github.io/apidocs/futures/cn/#trade-6
 */
async function cancelOrder(symbol, orderId) {
  weight += 1
  log(`${__function}: ${weight}`, flag)
  if (orderId) {
    const result = await binance.futuresCancel(symbol, { orderId })
    return result
  }
  const result = await binance.futuresCancelAll(symbol)
  return result
}

/**
 * 订单状态
 * @param string symbol
 * @param Number orderId
 * @param {} otherOptions https://binance-docs.github.io/apidocs/futures/cn/#trade-6
 */
async function orderStatus(symbol, orderId) {
  const result = await binance.futuresOrderStatus(symbol, { orderId })
  return result
}

/**
 * 交易深度
 * @param string symbol
 * @param Number orderId
 * @param {} otherOptions https://binance-docs.github.io/apidocs/futures/cn/#trade-6
 */
async function depth(symbol, limit = 20) {
  weight += 2
  const result = await binance.futuresDepth(symbol, { limit })
  log(`${__function}: ${weight}`, flag)
  return result
}

/**
 * 交易合约倍数
 * @param string symbol
 * @param Number 1-125
 * @doc https://binance-docs.github.io/apidocs/futures/cn/#trade-10
 */
async function leverage(symbol, number) {
  weight += 1
  const result = await binance.futuresLeverage(symbol, number)
  log(`${__function}: ${weight}`, flag)
  return result
}

/**
 * 合约模式 全仓与 逐仓
 * @param string symbol
 * @param string marginType	ENUM	YES	保证金模式 ISOLATED(逐仓), CROSSED(全仓)
 * @doc https://binance-docs.github.io/apidocs/futures/cn/#trade-10
 */
async function marginType(symbol, marginType = 'ISOLATED') {
  weight += 1
  const result = await binance.futuresMarginType(symbol, marginType)
  log(`${__function}: ${weight}`, flag)
  return result
}

/**
 * 获取order
 * @param string symbol
 * @doc https://binance-docs.github.io/apidocs/futures/cn/#trade-10
 */
async function getOrder(symbol, params = {}) {
  const result = await binance.futuresAllOrders(symbol, params)
  return result
}

/**
 * 获取当前挂单
 * @param string symbol
 * @doc https://binance-docs.github.io/apidocs/futures/cn/#user_data-4
 */
async function getOpenOrder(symbol, params = {}) {
  if (symbol) {
    weight += 1
    log(`${__function}: ${weight}`, flag)
    const result = await binance.futuresOpenOrders(symbol, params)
    return result
  }
  weight += 40
  log(`${__function}: ${weight}`, flag)
  const result = await binance.futuresOpenOrders()
  return result
}

/**
 * 获取交易信息
 * @param string symbol
 * @doc https://binance-docs.github.io/apidocs/futures/cn/#user_data-4
 */
async function getExchangeInfo() {
  const result = await binance.futuresExchangeInfo()
  return result
}

/**
 * 账户成交历史
 * @param string symbol
 * @param {startTime: number(13), endTime: number(13), limit: number} // startTime 和 endTime 的最大间隔为7天, limit 	返回的结果集数量 默认值:500 最大值:1000
 * @doc https://binance-docs.github.io/apidocs/futures/cn/#user_data-7
 * @example doc/userTrades.js
 */
async function getTrades(symbol, params = {}) {
  const result = await binance.futuresUserTrades(symbol, params)
  return result
}

let lock = false

if (config.websocket) {
  const dbFile = './data/data.db'
  if (!fs.existsSync(dbFile)) {
    fs.copyFileSync(dbFile + '.example', dbFile)
  }
  /**
   * 更新数据库的币种数据信息 websocket 推送
   */
  binance.futuresTickerStream(false, async prevDay => {
    if (!lock) {
      lock = true
      for (let obj of prevDay) {
        await tries(async () => {
          await knex('symbols').where('symbol', obj.symbol).update({
            percentChange: obj.percentChange,
            close: obj.close,
            open: obj.open,
            low: obj.low,
            updateTime: obj.eventTime,
          })
        })
        log(`${obj.symbol}:${obj.percentChange}`, false)
      }
      lock = false
    }
  })
}

module.exports = {
  resetWeight,
  getWeight,
  getAccount,
  getPosition,
  // getPrices,
  getMaCompare,
  buyLimit,
  sellLimit,
  buyMarket,
  sellMarket,
  cancelOrder,
  // orderStatus,
  depth,
  leverage,
  marginType,
  // getOrder,
  getOpenOrder,
  // getExchangeInfo,
  // getTrades,
}
