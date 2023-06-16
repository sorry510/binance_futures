const binance = require('../binance')
const { isAsc, isDesc } = require('../utils')

/**
 * 需要实现 getLongOrShort 和 canOrderComplete 方法
 * 
 * 参考 config.js 配置
 * 
 * strategy: 'line1',
 * usdt: 10, // 交易金额 usdt
 * profit: 6, // 止盈率
 * loss: 6, // 止损率
 * leverage: 10, // 合约倍数
 */


function kdj(ma1, ma2, type) {
    if (type === 'long') {
      if (ma1[0] < ma2[0]) {
          // 最后的必须是短线在上
          return false
      }
      for(let i = 1; i < ma1.length; i++) {
          if (ma1[i] < ma2[i]) {
              // 发生过短线在下，说明产生过金叉
              return true
          }
      }
      return false
    } else if (type === 'short') {
      if (ma1[0] > ma2[0]) {
          // 最后的必须是短线在上
          return false
      }
      for(let i = 1; i < ma1.length; i++) {
        if (ma1[i] > ma2[i]) {
            // 发生过短线在下，说明产生过金叉
            return true
        }
      }
      return false
    }
}


/**
 * 是否可以创建订单
 * @param {string} symbol 
 * @returns 
 */
async function getLongOrShort(symbol) {
    let canLong = false
    let canShort = false

    const ma1 = await binance.getKline(symbol, '1m', 5) // 1min的kline 最近 n 条值
    const ma2 = await binance.getKline(symbol, '3m', 5) // 3min的kline 最近 n 条值
    if (
      isDesc(ma1.slice(0, 4)) &&
      isDesc(ma2.slice(0, 3)) &&
      kdj(ma1.slice(0, 2), ma2.slice(0, 2), 'long')
    ) { // 产生了金叉
      // 涨的时刻
      canLong = true
      canShort = false
    } else if (
      isAsc(ma1.slice(0, 4)) &&
      isAsc(ma2.slice(0, 3)) &&
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

module.exports = {
    getLongOrShort,
    canOrderComplete,
}