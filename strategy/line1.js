const binance = require('../binance')
const { isAsc, isDesc, kdj } = require('../utils')

/**
 * 需要实现 getLongOrShort, canOrderComplete, autoStop 方法
 * 
 * 参考 config.js 配置
 * 
 * strategy: 'line1',
 * usdt: 10, // 交易金额 usdt
 * profit: 6, // 止盈率
 * loss: 6, // 止损率
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

    const ma0 = await binance.getKline(symbol, '1m', 2)
    const ma1 = await binance.getKline(symbol, '3m', 3) // 3min的kline 最近 n 条值
    const ma2 = await binance.getKline(symbol, '5m', 3) // 5min的kline 最近 n 条值
    // const ma3 = await binance.getKline(symbol, '10m', 3) // 30min的kline 最近 n 条值
    if (
      isDesc(ma0) &&
      isDesc(ma1) &&
      isDesc(ma2) &&
      kdj(ma1.slice(0, 2), ma2.slice(0, 2), 'long')
    ) { // 产生了金叉
      // 涨的时刻
      canLong = true
      canShort = false
    } else if (
      isAsc(ma0) &&
      isAsc(ma1) &&
      isAsc(ma2) &&
      kdj(ma1.slice(0, 2), ma2.slice(0, 2), 'short')
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

/**
 * 是否发动策略止损或止盈(无视止损点)
 * @param position @doc file://./doc/position.js
 * @returns Boolean
 */
async function autoStop(position, nowProfit) {
  return false
}

module.exports = {
    getLongOrShort,
    canOrderComplete,
    autoStop,
}