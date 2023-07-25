const binance = require('../binance')
const { profit, loss = 100} = require('../config')
const { isAsc, isDesc, maN, maNList } = require('../utils')

/**
 * 需要实现 getLongOrShort, canOrderComplete, autoStop 方法
 * 
 * 实现思路为 ma 条形图的转折点
 * 参考 config.js 配置
 * 
 * strategy: 'line5',
 * usdt: 7, // 交易金额 usdt
 * profit: 20, // 止盈率
 * loss: 60, // 止损率
 * leverage: 15, // 合约倍数
 */

/**
 * 是否可以创建订单
 * @param {string} symbol 
 * @returns 
 */
async function getLongOrShort(symbol) {
    let canLong = false
    let canShort = false
    
    const kline_3m = await binance.getKlineOrigin(symbol, '3m', 40)
    const kline_5m = await binance.getKlineOrigin(symbol, '5m', 40)
    const kline_15m = await binance.getKlineOrigin(symbol, '15m', 30)
    
    const line3m_result = normalizationLineData(kline_3m)
    const line5m_result = normalizationLineData(kline_5m)
    const line15m_result = normalizationLineData(kline_15m, 0)
    
    if (
      checkLongLine3m(line3m_result) &&
      checkLongLine5m(line5m_result) &&
      checkLongLine15m(line15m_result)
    ) {
      // 涨的时刻
      canLong = true
      canShort = false
    } else if (
      checkShortLine3m(line3m_result) &&
      checkShortLine5m(line5m_result) &&
      checkShortLine15m(line15m_result)
    ) {
      // 跌的时刻
      canLong = false
      canShort = true
    } else {
      canLong = false
      canShort = false
    }

    return {
      canLong,
      canShort,
      // other: {},
    }
}

/**
 * 是否可以平仓(达到止盈或止损后的判断逻辑)
 * @param {string} symbol 
 * @param {string} side LONG:做多,SHORT:做空
 * @returns Boolean
 */
async function canOrderComplete(symbol, side) {
  const [k1, k2] = await binance.getKline(symbol, '1m', 2) // 1min 线最近2条
  if (side === 'LONG') {
    return k1 < k2  // 价格在下跌中
  } else if (side === 'SHORT') {
    return k1 > k2 // 价格在上涨中
  } else {
    return false;
  }
}

/**
 * 是否发动策略止损或止盈(无视止损点)
 * @param {string} symbol 
 * @param {string} side LONG:做多,SHORT:做空
 * @returns Boolean
 */
async function autoStop(symbol, side, nowProfit) {
  if (nowProfit > -3 && nowProfit < 3) {
    // 如果过少会有交易手续费的磨损
    return false
  }
  if (side === 'LONG') {
    if ((nowProfit < profit * 0.6 && nowProfit > 0) || nowProfit < -profit) {
      const kline_3m = await binance.getKlineOrigin(symbol, '3m', 40)
      const line3m_result = normalizationLineData(kline_3m, 0)
      const { maxIndex, minIndex, line } = line3m_result
      const ma3List = maNList(line.map(item => item.close), 3, 20)
      if (isAsc(ma3List.slice(0, 5)) && maxIndex >= 5) {
        // 连续5次下跌，切最高点在5之前
        return true
      }
    }
  }
  if (side === 'SHORT') {
    if ((nowProfit < profit * 0.6 && nowProfit > 0) || nowProfit < -profit) {
      const kline_3m = await binance.getKlineOrigin(symbol, '3m', 40)
      const line3m_result = normalizationLineData(kline_3m, 0)
      const { maxIndex, minIndex, line } = line3m_result
      const ma3List = maNList(line.map(item => item.close), 3, 20)
      if (isAsc(ma3List.slice(0, 5)) && minIndex >= 5) {
        // 连续5次上涨，切最低点在5之前
        return true
      }
    }
  }
  return false
}

function normalizationLineData(data, slice = 1) {
  let maxIndex = 0
  let maxPrice = 0
  let minIndex = 0
  let minPrice = 0
  const result = data.slice(slice).map((item, key) => {
    const open = Number(item[1])
    const max = Number(item[2])
    const min = Number(item[3])
    const close = Number(item[4])
    const tradeCount = Number(item[5])
    if (key === 0) {
      maxPrice = max
      minPrice = min
    } else {
      if (max > maxPrice) {
        maxPrice = max
        maxIndex = key
      }
      if (min < minPrice) {
        minPrice = min
        minIndex = key
      }
    }
    return {
      position: close >= open ? 'long' : 'short',
      max,
      min,
      close,
      open,
      tradeCount,
    }
  })
  return {
    maxIndex,
    minIndex,
    line: result
  }
}

function checkLongLine3m(data) {
  const { maxIndex, minIndex, line } = data
  if (minIndex >= 2 && maxIndex >= 10) {
    // 最低点在9分前，最高点之前30分
    const ma3List = maNList(line.map(item => item.close), 3, 20) // 3min kline 最近20条，不包含最近3min
    if (
      isDesc(ma3List.slice(0, minIndex)) && // 最近 ma 在上涨
      isAsc(ma3List.slice(minIndex, minIndex + 10)) && // 之前 ma 在下跌
      line.slice(0, minIndex).filter(item => item.position === 'long').length >= minIndex - 1 && //
      true // 占位
    ) {
      return true
    }
  }
  return false
}

function checkShortLine3m(data) {
  const { maxIndex, minIndex, line } = data
  if (maxIndex >= 2 && minIndex <= 10) {
    const ma3List = maNList(line.map(item => item.close), 3, 20) // 3min kline 最近20条，不包含最近3min
    if (
      isAsc(ma3List.slice(0, maxIndex)) &&
      isDesc(ma3List.slice(maxIndex, maxIndex + 10)) && 
      line.slice(0, maxIndex).filter(item => item.position === 'short').length >= maxIndex - 1 &&
      true // 占位
    ) {
      return true
    }
  }
  return false
}

function checkLongLine5m(data) {
  const { maxIndex, minIndex, line } = data
  const maList = maNList(line.map(item => item.close), 5, 20) // 3min kline 最近20条，不包含最近3min
  if (
    isDesc(maList.slice(0, 3)) && // 最近 ma 在上涨
    true
  ) {
    return true
  }
  return false
}

function checkShortLine5m(data) {
  const { maxIndex, minIndex, line } = data
  const maList = maNList(line.map(item => item.close), 5, 20) // 3min kline 最近20条，不包含最近3min
  if (
    isAsc(maList.slice(0, 3)) && 
    true
  ) {
    return true
  }
  return false
}

function checkLongLine15m(data) {
  const { maxIndex, minIndex, line } = data
  const maList = maNList(line.map(item => item.close), 15, 20)
  if (
    isDesc(maList.slice(0, 2)) && // 最近 ma 在上涨
    true
  ) {
    return true
  }
  return false
}

function checkShortLine15m(data) {
  const { maxIndex, minIndex, line } = data
  const maList = maNList(line.map(item => item.close), 15, 20)
  if (
    isAsc(maList.slice(0, 2)) && // 最近 ma 在上涨
    true
  ) {
    return true
  }
  return false
}

module.exports = {
  getLongOrShort,
  canOrderComplete,
  autoStop,
}