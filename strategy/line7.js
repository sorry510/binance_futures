const binance = require('../binance')
const { profit, loss = 100, holdMaxTime } = require('../config')
const { isAsc, isDesc, maN, maNList, log } = require('../utils')

/**
 * 需要实现 getLongOrShort, canOrderComplete, autoStop 方法
 * 
 * 在牛市中，涨的概率>跌的概率的，所以检查 3min 线出现3次上涨就买入
 * 参考 config.js 配置
 * 
 * holdMaxTime: 30, // 持仓的最长时间, 分钟级别 
 * strategy: 'line6',
 * usdt: 10, // 交易金额 usdt
 * profit: 10, // 止盈率
 * loss: 10, // 止损率
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
    
    const [k1, k2] = await binance.getKline(symbol, '1m', 2) // 1min 线最近2条
    
    const kline_3m = await binance.getKlineOrigin(symbol, '3m', 40)
    const line3m_result = normalizationLineData(kline_3m) // 不包含最新的3m

    if (
      checkLongLine3m(line3m_result) &&
      k1 > k2 &&
      true
    ) {
      // 涨的时刻
      canLong = true
      canShort = false
    } else if (
      checkShortLine3m(line3m_result) &&
      k1 < k2 &&
      true
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
 * @param position @doc file://./doc/position.js
 * @returns Boolean
 */
async function autoStop(position, nowProfit) {
  const symbol = position.symbol
  const side = position.positionSide
  
  if (holdMaxTime) {
    // 最大持仓时间
    const updateTime = position.updateTime // 交易成功时的时间(毫秒)
    const nowTime = +new Date() // 当前时间(毫秒)
    const millisecond = holdMaxTime * 60 * 1000
    if (updateTime + millisecond < nowTime) {
      log(`${symbol}: 持仓时间超过最大设置，将进行卖出操作`)
      return true
    }
  }
  
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
      const lineCount = 6
      if (
        isAsc(ma3List.slice(1, lineCount)) &&
        line.slice(1, lineCount).filter(item => item.position === 'short').length === lineCount - 1 &&
        maxIndex > lineCount
      ) {
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
      const lineCount = 6
      if (
        isDesc(ma3List.slice(1, lineCount)) &&
        line.slice(1, lineCount).filter(item => item.position === 'long').length === lineCount - 1 &&
        minIndex >= lineCount
      ) {
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
  const { line } = data
  const ma3List = maNList(line.map(item => item.close), 3, 20) // 3min kline 最近20条，不包含最近3min
  if (
    line.slice(0, 3).filter(item => item.position === 'long').length === 3 && // 最近3条 line 都是绿的
    isDesc(ma3List.slice(0, 3)) // 最近3 ma 在上涨
  ) {
    return true;
  }
  return false; 
}

function checkShortLine3m(data) {
  const { line } = data
  const ma3List = maNList(line.map(item => item.close), 3, 20) // 3min kline 最近20条，不包含最近3min
  if (
    line.slice(0, 3).filter(item => item.position === 'short').length === 3 && // 最近3条 line 都是红的
    isAsc(ma3List.slice(0, 3)) // 最近3 ma 在下跌
  ) {
    return true;
  }
  return false; 
}

module.exports = {
  getLongOrShort,
  canOrderComplete,
  autoStop,
}