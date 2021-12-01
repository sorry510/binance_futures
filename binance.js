const Binance = require('node-binance-api')
const process = require('process')
const { round } = require('mathjs')
const config = require('./config')
const { sleep, log, dateFormat } = require('./utils')

const binance = new Binance().options({
  APIKEY: config.api_key,
  APISECRET: config.api_secret,
})

/**
 * 当前账户信息
 * @document ./doc/futuresAccount.js
 * @returns
 */
async function getAccount() {
  const account = await binance.futuresAccount()
  // const { availableBalance } = account // 可用余额
  return account
}

/**
 * @document ./doc/futuresAccount.js
 * @returns
 */
async function getPosition() {
  const result = await binance.futuresPositionRisk()
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
 * 限价买入
 * @param string symbol
 * @param Number quantity
 * @param number price
 * @param {} otherOptions https://binance-docs.github.io/apidocs/futures/cn/#trade-3
 */
async function buyLimit(symbol, quantity, price, otherOptions) {
  const result = await binance.futuresBuy(symbol, quantity, price, otherOptions) // 限定价格买入
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
  return result
}

/**
 * 撤销订单
 * @param string symbol
 * @param Number orderId
 * @param {} otherOptions https://binance-docs.github.io/apidocs/futures/cn/#trade-6
 */
async function cancelOrder(symbol, orderId) {
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
  const result = await binance.futuresDepth(symbol, { limit })
  return result
}

/**
 * 交易合约倍数
 * @param string symbol
 * @param Number 1-125
 * @doc https://binance-docs.github.io/apidocs/futures/cn/#trade-10
 */
async function leverage(symbol, number) {
  const result = await binance.futuresLeverage(symbol, number)
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
  const result = await binance.futuresOpenOrders(symbol, params)
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

module.exports = {
  getAccount,
  getPosition,
  getPrices,
  buyLimit,
  sellLimit,
  buyMarket,
  sellMarket,
  cancelOrder,
  orderStatus,
  depth,
  leverage,
  getOrder,
  getOpenOrder,
  getExchangeInfo,
}
