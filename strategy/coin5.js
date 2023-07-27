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
  
  const randIntStart = getRndInteger(0, Math.min(5, sortSymbols.length))
  const midInt = parseInt(sortSymbols.length/ 2)
  const randIntEnd = getRndInteger(Math.max(sortSymbols.length - 5, 0), sortSymbols.length)
  
  const set = new Set()
  set.add(randIntStart)
  set.add(midInt)
  set.add(randIntEnd)
  
  const coins = [] // 变化最大的1个币
  set.forEach(item => {
    coins.push(sortSymbols[item])
  })
  return coins
}

module.exports = {
  getCoins,
}