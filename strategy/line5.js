const binance = require('../binance')
const { profit, loss = 100, holdMaxTime } = require('../config')
const { isAsc, isDesc, maN, maNList, log } = require('../utils')

/**
 * 需要实现 getLongOrShort, canOrderComplete, autoStop 方法
 * 
 * 实现思路为 ma 条形图的转折点
 * 参考 config.js 配置
 *
  holdMaxTime: 30, // 持仓的最长时间, 分钟级别 
  usdt: 10, // 交易金额 usdt
  profit: 10, // 止盈率
  loss: 12, // 止损率
  leverage: 15, // 合约倍数
  strategy: 'line5', // 交易策略
  strategyCoin: 'coin5', // 选币策略
 */

/**
 * 是否可以创建订单
 * @param {string} symbol 
 * @returns 
 */
async function getLongOrShort(symbol) {
    let canLong = false
    let canShort = false
    
    const kline_3m = await binance.getKlineOrigin(symbol, '3m', 50)
    // const kline_1m = await binance.getKlineOrigin(symbol, '1m', 10)
    
    const line3m_result = normalizationLineData(kline_3m)
    // const line1m_result = normalizationLineData(kline_1m)
    
    if (
      checkLongLine3m(line3m_result) &&
      true
    ) {
      // 涨的时刻
      canLong = true
      canShort = false
    } else if (
      checkShortLine3m(line3m_result) &&
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
 * @param position @doc file://../doc/position.js
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
  
  if (nowProfit > -2 && nowProfit < 2) {
    // 如果过少会有交易手续费的磨损
    return false
  }
  if (side === 'LONG') {
    if ((nowProfit < profit * 0.6 && nowProfit > 0) || nowProfit < -profit) {
      const kline_3m = await binance.getKlineOrigin(symbol, '3m', 40)
      const line3m_result = normalizationLineData(kline_3m, 0)
      const { maxIndex, minIndex, line } = line3m_result
      const ma3List = maNList(line.map(item => item.close), 3, 20)
      const lineCount = 5
      if (
        isAsc(ma3List.slice(lineCount)) &&
        line.slice(lineCount).filter(item => item.position === 'short').length === lineCount &&
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
      const lineCount = 5
      if (
        isDesc(ma3List.slice(lineCount)) &&
        line.slice(lineCount).filter(item => item.position === 'long').length === lineCount &&
        minIndex >= lineCount
      ) {
        // 连续5次上涨，切最低点在5之前
        return true
      }
    }
  }
  return false
}

/**
 * 归一化处理k线数据
 * @param [] data 原始k线数据，从最新时间到最早时间排序
 * @param Number slice 切片位置
 * @returns []
 */
function normalizationLineData(data, slice = 0) {
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

/**
 * 检查是否可以开多
 * @param {Object} data normalizationLineData 的 return
 * @returns 
 */
function checkLongLine3m(data) {
  const { maxIndex, minIndex, line } = data
  if (minIndex >= 1 && minIndex <= 3 && maxIndex >= 10) {
    // 最低点在3分前，最高点之前30分
    const ma3List = maNList(line.map(item => item.close), 3, 20) // 3min kline 最近20条，时间从最新到最老
    const linePoint = line[minIndex] // 最低的那个line
    const underLength = Math.abs(linePoint.close - linePoint.min) // 下影线长度
    const upperLength = Math.abs(linePoint.max - linePoint.open) // 上影线长度
    const entityLength = Math.abs(linePoint.open - linePoint.close) // 实体长度
    const allLength = Math.abs(linePoint.max - linePoint.min) // 总长度
    if (
      isDesc(ma3List.slice(0, minIndex)) && // 最低点到现在在涨
      // isAsc(ma3List.slice(minIndex, minIndex + 8)) && // 最低点的前8个在跌
      line.slice(minIndex, minIndex + 8).filter(item => item.position === 'short').length >= 7 && // 最低点的line之前的8个中最多有一个line是红线
      linePoint.position === 'short' && // 最低点的line是红线
      underLength > upperLength && // 下影线长度 > 上影线长度
      entityLength / allLength < 0.5 && // 实体长度 < 0.5
      true // 占位
    ) {
      return true
    }
  }
  return false
}

function checkShortLine3m(data) {
  const { maxIndex, minIndex, line } = data
  if (maxIndex >= 1 && maxIndex <= 3 && minIndex <= 10) {
    // 最高点在3分前，最低点之前30分
    const ma3List = maNList(line.map(item => item.close), 3, 20) // 3min kline 最近20条，时间从最新到最老
    const linePoint = line[maxIndex] // 最低的那个line
    const underLength = Math.abs(linePoint.open - linePoint.min) // 下影线长度
    const upperLength = Math.abs(linePoint.max - linePoint.close) // 上影线长度
    const entityLength = Math.abs(linePoint.open - linePoint.close) // 实体长度
    const allLength = Math.abs(linePoint.max - linePoint.min) // 总长度
    if (
      isAsc(ma3List.slice(0, maxIndex)) &&
      // isDesc(ma3List.slice(maxIndex, maxIndex + 8)) &&
      line.slice(maxIndex, maxIndex + 8).filter(item => item.position === 'long').length >= 7 && // 最高点的line之前的8个中最多有一个line是绿线
      linePoint.position === 'long' &&
      underLength < upperLength && // 下影线长度 < 上影线长度
      entityLength / allLength < 0.5 && // 实体长度 < 0.5
      true // 占位
    ) {
      return true
    }
  }
  return false
}

function checkLongLine1m(data) {
  const { maxIndex, minIndex, line } = data
  const maList = maNList(line.map(item => item.close), 5, 20)
  if (
    isAsc(maList.slice(2, 4)) &&
    true
  ) {
    return true
  }
  return false
}

function checkShortLine1m(data) {
  const { maxIndex, minIndex, line } = data
  const maList = maNList(line.map(item => item.close), 5, 20)
  if (
    isDesc(maList.slice(2, 4)) && 
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