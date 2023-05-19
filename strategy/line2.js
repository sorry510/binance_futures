const binance = require('../binance')
const { isAsc, isDesc } = require('../utils')

/**
 * 需要实现 getLongOrShort 和 canOrderComplete 方法
 * 
 * 此策略适合快速交易，极小涨幅就卖出
 * 参考 config.js 配置
 * 
 * strategy: 'line2',
 * usdt: 10, // 交易金额 usdt
 * profit: 1.5, // 止盈率
 * loss: 10, // 止损率
 * leverage: 10, // 合约倍数
 */

/**
 * 是否可以创建订单
 * @param {string} symbol 
 * @returns 
 */
async function getLongOrShort(symbol) {
    let canLong = false
    let canShort = false

    const arr1 = await binance.getKlineAvg(symbol, '1m', [1, 3, 5]) // 1min的kline 最近 n 条值
    const arr2 = await binance.getKlineAvg(symbol, '3m', [10, 10 * 2, 10 * 3]) // 3min的kline 近2小时
    if (isDesc(arr1) && isDesc(arr2)) {
      // 涨的时刻
      canLong = true
      canShort = false
    } else if (isAsc(arr1) && isAsc(arr2)) {
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
 * 是否可以平仓
 * @param {string} symbol 
 * @param {string} side LONG:做多,SHORT:做空
 * @returns Boolean
 */
async function canOrderComplete(symbol, side) {
   return true
}

module.exports = {
    getLongOrShort,
    canOrderComplete,
}