const binance = require('../binance')
const { isAsc, isDesc, maN, kdj } = require('../utils')

/**
 * 需要实现 getLongOrShort, canOrderComplete, autoStop 方法
 * 
 * 看小时长线，降低交易频率，提高止盈率
 * 参考 config.js 配置
 * 
 * strategy: 'line5',
 * usdt: 10, // 交易金额 usdt
 * profit: 20, // 止盈率
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
    
    const { buyPrice } = await binance.getPrice(symbol)
    const kline_1m = await binance.getKline(symbol, '1m', 40)
    const kline_5m = await binance.getKline(symbol, '5m', 40)
    const kline_15m = await binance.getKline(symbol, '15m', 40)
    const kline_30m = await binance.getKline(symbol, '30m', 40)
    const kline_1d = await binance.getKline(symbol, '1d', 40) 
    
    if (
      isDesc(kline_1m.slice(0, 2)) &&
      
      maN(kline_1m, 3) > maN(kline_1m, 15) &&
      maN(kline_1m.slice(1), 3) < maN(kline_1m.slice(1), 15) && // 一次 3 和 15 的金叉
      
      maN(kline_1m, 3) > maN(kline_1m, 30) &&
      maN(kline_1m, 15) < maN(kline_1m, 30) && // 大跌的转折，刚开始上涨，所以 15 < 30
      
      isDesc(kline_5m.slice(0, 2)) &&
      ( // 大于其中一个
        (maN(kline_5m, 3) > maN(kline_5m, 15) && maN(kline_5m, 3) < maN(kline_5m, 30))
        ||
        (maN(kline_5m, 3) < maN(kline_5m, 15) && maN(kline_5m, 3) > maN(kline_5m, 30))
      ) &&
      
      isDesc(kline_15m.slice(0, 2)) &&
      maN(kline_15m, 3) > maN(kline_15m, 20) &&
      
      isAsc(kline_30m.slice(0, 2)) &&
      maN(kline_30m, 3) < maN(kline_30m, 20) &&
      
      maN(kline_1d, 3) > buyPrice // 支撑位
    ) { // 产生了金叉
      // 涨的时刻
      canLong = true
      canShort = false
    } else if (
      isAsc(kline_1m.slice(0, 2)) &&
      
      maN(kline_1m, 3) < maN(kline_1m, 15) &&
      maN(kline_1m.slice(1), 3) > maN(kline_1m.slice(1), 15) && // 一次 3 和 15 的死叉
      
      maN(kline_1m, 3) < maN(kline_1m, 30) &&
      maN(kline_1m, 15) > maN(kline_1m, 30) &&
      
      isAsc(kline_5m.slice(0, 3)) &&
      ( // 大于其中一个
        (maN(kline_5m, 3) < maN(kline_5m, 15) && maN(kline_5m, 3) > maN(kline_5m, 30))
        ||
        (maN(kline_5m, 3) > maN(kline_5m, 15) && maN(kline_5m, 3) < maN(kline_5m, 30))
      ) &&
      
      isAsc(kline_15m.slice(0, 2)) &&
      maN(kline_15m, 3) < maN(kline_15m, 20) &&
      
      isDesc(kline_30m.slice(0, 2)) &&
      maN(kline_30m, 3) > maN(kline_30m, 20) &&
      
      maN(kline_1d, 3) < buyPrice // 支撑位
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
  if (nowProfit > -2 && nowProfit < 2) {
    // 如果过少会有交易手续费的磨损
    return false
  }
  return false
}

module.exports = {
    getLongOrShort,
    canOrderComplete,
    autoStop,
}