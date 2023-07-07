const binance = require('../binance')
const { isAsc, isDesc, maN } = require('../utils')

/**
 * 需要实现 getLongOrShort, canOrderComplete, autoStop 方法
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
    
    const { bids, asks } = await binance.depth(symbol, 50)
    const buyCount = bids.reduce((carry, item) => Number(item[1]) + carry, 0) // 买单数量
    const sellCount = asks.reduce((carry, item) => Number(item[1]) + carry, 0) // 卖单数量

    const kline_1m = await binance.getKline(symbol, '1m', 2)
    const kline_5m = await binance.getKline(symbol, '5m', 41)
    const kline_15m = await binance.getKline(symbol, '15m', 41)
    const kline_30m = await binance.getKline(symbol, '30m', 41)
    
    if (
      isDesc(kline_1m.slice(0, 2)) &&
      maN(kline_5m, 3) > maN(kline_5m, 15) && // 5m kline 的 3ma > 15ma
      maN(kline_15m, 3) > maN(kline_15m, 15) &&
      maN(kline_30m, 3) < maN(kline_30m, 15) &&
      buyCount > sellCount
    ) { // 产生了金叉
      // 涨的时刻
      canLong = true
      canShort = false
    } else if (
      isAsc(kline_1m.slice(0, 2)) &&
      maN(kline_5m, 3) < maN(kline_5m, 15) && // 5m kline 的 3ma > 15ma
      maN(kline_15m, 3) < maN(kline_15m, 15) &&
      maN(kline_30m, 3) > maN(kline_30m, 15) &&
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
async function autoStop(symbol, side) {
  return false
}

module.exports = {
    getLongOrShort,
    canOrderComplete,
    autoStop
}