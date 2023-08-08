const { getRndInteger } = require('../utils')

/**
 * 需要实现 getCoins 方法
 */

/**
 * 获取候选交易的币种
 * @param []<json>(symbol, percentChange, close, lastClose, enable) allSymbols 所有的交易币种
 * @returns []<string>
 */
async function getCoins(allSymbols) {
  const filterSymbols = allSymbols.filter(item => item.enable == 1) // 查询所有开启的币种
  const sortSymbols = filterSymbols
    .map(item => ({ ...item, percentChange: Number(item.percentChange) }))
    .sort((a, b) => (a.percentChange < b.percentChange ? -1 : 1)) // 涨幅从小到大排序
  
  const rand1 = getRndInteger(0, Math.min(8, sortSymbols.length))
  const rand2 = getRndInteger(0, Math.min(8, sortSymbols.length))
  const rand3 = getRndInteger(Math.max(sortSymbols.length - 8, 0), sortSymbols.length)
  const rand4 = getRndInteger(Math.max(sortSymbols.length - 8, 0), sortSymbols.length)
  
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