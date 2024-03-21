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
 * 策略: 随机选取 6 个币种
 * 获取候选交易的币种
 * @param {Array<import('../type').Symbol>} allSymbols 所有的交易币种
 * @returns {Promise<Array<import('../type').Symbol>>}
 */
async function getCoins(allSymbols) {
  let filterSymbols = await commonFilter(allSymbols) // 查询所有可用的币种
  
  filterSymbols = shuffle(filterSymbols) // 洗牌
  
  return filterSymbols.slice(0, 6) // 完全随机取 6 个
}

function shuffle(arr) {
    let len = arr.length;
    while (len) {
        let randomIndex = Math.floor(Math.random() * len--);
        [arr[randomIndex], arr[len]] = [arr[len], arr[randomIndex]];
    }
    return arr;
}

module.exports = {
  getCoins,
}
