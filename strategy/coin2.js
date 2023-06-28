/**
 * 需要实现 getCoins 方法
 */

const cha = [2, 12]
const threshold = 0.75

/**
 * 获取候选交易的币种
 * @param []<json>(symbol, percentChange, close, lastClose, enable) allSymbols 所有的交易币种
 * @returns []<string>
 */
async function getCoins(allSymbols) {
  const coins = []
  const sortSymbols = getSortSymbols(allSymbols) // 涨幅从低到高排
  const posiSymbols = sortSymbols.filter(item => item.percentChange > 0) // 涨的币
  const negaSymbols = sortSymbols.filter(item => item.percentChange <= 0) // 跌的币

  const posiSymbolsReverse = posiSymbols.reverse()
  const posiSymbolFilter = posiSymbolsReverse // 涨的币从涨幅最高>>涨幅最低
    .filter((item, key) => {
      if (key < posiSymbolsReverse.length - 1) {
        const perCha = item.percentChange - posiSymbolsReverse[key + 1].percentChange // 2个币种之间的涨幅差
        return perCha > cha[0] && perCha < cha[1]
      }
      return false
    }) // 2个币涨幅相差在范围内的币

  const negaSymbolFilter = negaSymbols // 跌的币从跌幅最大>>跌幅最小
    .filter((item, key) => {
      if (key < negaSymbols.length - 1) {
        const perCha = negaSymbols[key + 1].percentChange - item.percentChange // 2个币种之间的涨幅差
        return perCha > cha[0] && perCha < cha[1]
      }
      return false
    }) // 2个币跌幅相差在范围内的币

  if (posiSymbols.length / sortSymbols.length > threshold) {
    // 开启的币种，75%的币都在涨,可以在多种选2个
    posiSymbolFilter.slice(0, 2).map(function(item) {
      coins.push({
        symbol: item.symbol,
      })
    })
  } else if (negaSymbols.length / sortSymbols.length > threshold) {
    // 开启的币种，75%的币都在跌,可以买空2个
    negaSymbolFilter.slice(0, 2).map(function(item) {
      coins.push({
        symbol: item.symbol,
      })
    })
  } else {
    posiSymbolFilter.slice(0, 1).map(function(item) {
      coins.push({
        symbol: item.symbol,
      })
    })
    negaSymbolFilter.slice(0, 1).map(function(item) {
      coins.push({
        symbol: item.symbol,
      })
    })
  }
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