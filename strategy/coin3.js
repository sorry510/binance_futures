/**
 * 需要实现 getCoins 方法
 */

/**
 * 获取候选交易的币种
 * @param []<json>(symbol, percentChange, close, lastClose, enable) allSymbols 所有的交易币种
 * @returns []<string>
 */
async function getCoins(allSymbols) {
  let maxChange = 0
  let findKey = 0
  const filterSymbols = allSymbols.filter(item => item.enable == 1) // 查询所有开启的币种
    
  filterSymbols.map((item, key) => {
    if (item.close && item.lastClose && item.updateTime && item.lastUpdateTime) {
      const coinChange = Math.abs((item.close - item.lastClose) / item.close / (item.updateTime - item.lastUpdateTime)) // 单位时间变化率
      if (coinChange > maxChange) {
        maxChange = coinChange
        findKey = key
      }
    }
  })

  const coins = [filterSymbols[findKey]] // 变化最大的1个币
  return coins
}

module.exports = {
  getCoins,
}