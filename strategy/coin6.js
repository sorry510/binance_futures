const binance = require('../binance')

/**
 * 需要实现 getCoins 方法
 */

/**
 * 获取候选交易的币种
 * @param []<json>(symbol, percentChange, close, lastClose, enable) allSymbols 所有的交易币种
 * @returns []<string>
 */
async function getCoins(allSymbols) {
  const nowTime = +new Date() // 当前时间(毫秒)
  const recentOrders = await binance.getOrders(null, { startTime: nowTime - 5 * 60 * 1000 }) // 最近 5 min 交易过的产品，不再进行交易
  const recentSymbolsMap = new Set(recentOrders.map(item => item.symbol))
  
  let filterSymbols = allSymbols.filter(item => item.enable == 1 && !recentSymbolsMap.has(item.symbol)) // 查询所有开启的币种
  
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
