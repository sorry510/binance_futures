const binance = require('../binance')
const { isAsc, isDesc } = require('../utils')

/**
 * 需要实现 getLongOrShort 和 canOrderComplete 方法
 * 
 * 此策略适合快速交易，极小涨幅就卖出
 * 参考 config.js 配置
 * 
 * strategy: 'line3',
 * usdt: 10, // 交易金额 usdt
 * profit: 2, // 止盈率
 * loss: 20, // 止损率
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

    const [k1] = await binance.getKline(symbol, '1m', 1) // 1min的kline
    const [k2] = await binance.getKline(symbol, '3m', 1) // 3min的kline
    const [k3] = await binance.getKline(symbol, '5m', 1) // 3min的kline
    const [k4] = await binance.getKline(symbol, '15m', 1) // 3min的kline
    if (isDesc([k1, k2, k3, k4])) {
      // 涨的时刻
      canLong = true
      canShort = false
    } else if (isAsc([k1, k2, k3, k4])) {
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