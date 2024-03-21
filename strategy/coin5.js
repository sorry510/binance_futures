const { getRndInteger } = require('../utils')
const binance = require('../binance')

/**
 * 需要实现 getCoins 方法
 */

/**
 * 统一的过滤条件
 * 1. 排除没有开启权限的币种
 * 2. 排除最近 5 min内交易过的币种
 * @param {Array<import('../type').Symbol>} allSymbols 所有的交易币种
 * @returns {Promise<Array<import('../type').Symbol>>}
 */
async function commonFilter(allSymbols) {
  const nowTime = +new Date() // 当前时间(毫秒)
  const recentOrders = await binance.getOrders(null, { startTime: nowTime - 5 * 60 * 1000 }) // 最近 5 min 交易过的产品，不再进行交易
  const recentSymbolsMap = new Set(recentOrders.map(item => item.symbol))
  
  let filterSymbols = allSymbols.filter(item => item.enable == 1 && !recentSymbolsMap.has(item.symbol)) // 查询所有开启的币种
  return filterSymbols
}

/**
 * 获取候选交易的币种
 * 策略: 从涨幅榜中前6个里面随机选取2个，从跌幅榜中的前6个里面随机选取2个
 * @param {Array<import('../type').Symbol>} allSymbols 所有的交易币种
 * @returns {Promise<Array<import('../type').Symbol>>}
 */
async function getCoins(allSymbols) {
  const filterSymbols = await commonFilter(allSymbols)
  const sortSymbols = filterSymbols
    .map(item => ({ ...item, percentChange: Number(item.percentChange) }))
    .sort((a, b) => (a.percentChange < b.percentChange ? -1 : 1)) // 涨幅从小到大排序
    
  const rand1 = getRndInteger(0, Math.min(6, sortSymbols.length))
  const rand2 = getRndInteger(0, Math.min(6, sortSymbols.length))
  const rand3 = getRndInteger(Math.max(sortSymbols.length - 6, 0), sortSymbols.length)
  const rand4 = getRndInteger(Math.max(sortSymbols.length - 6, 0), sortSymbols.length)
  
  const midInt = parseInt(sortSymbols.length/ 2)
  
  const set = new Set()
  set.add(rand1)
  set.add(rand2)
  set.add(rand3)
  set.add(rand4)
  set.add(midInt)
  
  const coins = []
  set.forEach(item => {
    coins.push(sortSymbols[item])
  })
  return coins
}

module.exports = {
  getCoins,
}