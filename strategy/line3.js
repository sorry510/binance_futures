const binance = require('../binance')
const { isAsc, isDesc, kdj } = require('../utils')

/**
 * 需要实现 getLongOrShort 和 canOrderComplete 方法
 * 
 * (设计思路:大趋势会影响到小趋势，在 3m 与 5m 线发生金叉时， 1min 线买入)
 * 参考 config.js 配置
 * 
 * strategy: 'line3',
 * usdt: 10, // 交易金额 usdt
 * profit: 6, // 止盈率
 * loss: 15, // 止损率
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

    const ma1 = await binance.getKline(symbol, '1m', 3) // 1min的kline 最近 n 条值
    const ma2 = await binance.getKline(symbol, '3m', 3) // 3min的kline 最近 n 条值
    const ma3 = await binance.getKline(symbol, '5m', 3) // 5min的kline 最近 n 条值
    const ma4 = await binance.getKline(symbol, '15m', 3) // 15min的kline 最近 n 条值
    if (
      isDesc(ma1.slice(0, 2)) &&
      isDesc(ma2.slice(0, 2)) &&
      kdj(ma1.slice(1, 3), ma2.slice(1, 3), 'long') &&
      kdj(ma3.slice(0, 2), ma4.slice(0, 2), 'short')
    ) { // 产生了金叉
      // 涨的时刻
      canLong = true
      canShort = false
    } else if (
      isAsc(ma1.slice(0, 2)) &&
      isAsc(ma2.slice(0, 2)) &&
      kdj(ma1.slice(1, 3), ma2.slice(1, 3), 'short') &&
      kdj(ma3.slice(0, 2), ma4.slice(0, 2), 'long')
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
 * 是否可以平仓
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

module.exports = {
    getLongOrShort,
    canOrderComplete,
}