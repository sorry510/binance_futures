const binance = require('../binance')
const { isAsc, isDesc, maN } = require('../utils')

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

    const kline1m = await binance.getKline(symbol, '1m', 20) // 1min的kline 最近 n 条值
    const kline15m = await binance.getKline(symbol, '15m', 41) // 3min的kline 最近 n 条值
    const { bids, asks } = await binance.depth(symbol, 50)
    const buyCount = bids.reduce((carry, item) => Number(item[1]) + carry, 0) // 买单数量
    const sellCount = asks.reduce((carry, item) => Number(item[1]) + carry, 0) // 卖单数量
    const ma0 = maN(kline15m, 2)
    const ma1 = maN(kline15m, 20)
    const ma2 = maN(kline15m, 40)
    if (
      isDesc(kline1m.slice(0, 2)) &&
      isDesc(kline15m.slice(0, 2)) &&
      ma0 > ma1 &&
      ma1 > ma2 &&
      buyCount > sellCount
    ) { // 产生了金叉
      // 涨的时刻
      canLong = true
      canShort = false
    } else if (
      isAsc(kline1m.slice(0, 2)) &&
      isAsc(kline15m.slice(0, 2)) &&
      ma0 < ma1 &&
      ma1 < ma2 &&
      buyCount < sellCount
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