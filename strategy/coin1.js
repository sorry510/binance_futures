/**
 * 需要实现 getCoins 方法
 */

/**
 * 获取候选交易的币种
 * @param []<string> allSymbols 所有的交易币种
 * @returns []<string>
 */
async function getCoins(allSymbols) {
  const sortSymbols = getSortSymbols(allSymbols) // 涨幅从低到高排
  
  let maxChaKey = 0
  let tempCha = 0
  sortSymbols.map((item, key) => {
    if (key < sortSymbols.length - 1) {
      const perCha = sortSymbols[key + 1].percentChange - item.percentChange // 2个币种之间的涨幅差
      if (perCha > tempCha) {
        maxChaKey = key
        tempCha = perCha
      }
    }
  })
  
  const coins = sortSymbols.slice(maxChaKey, maxChaKey + 2) // 落差最大的2个币
  return coins
}

function getSortSymbols(allSymbols) {
  return allSymbols
    .filter(item => item.enable == 1) // 查询所有开启的币种
    .map(item => ({ ...item, percentChange: Number(item.percentChange) }))
    .sort((a, b) => (a.percentChange < b.percentChange ? -1 : 1)) // 涨幅从小到大排序
}

module.exports = {
  getCoins,
}