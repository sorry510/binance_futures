const binance = require('../binance')

/**
 * 是否可以创建订单
 * @param {string} symbol 
 * @returns 
 */
async function getLongOrShort(symbol) {
    let canLong = false
    let canShort = false

    const [k1, k2, k3] = await binance.getMaCompare(symbol, '1m', [1, 3, 6]) // 1min的kline 最近 n 条值
    const [m1, m2, m3] = await binance.getMaCompare(symbol, '3m', [20, 20 * 2, 20 * 4]) // 3min的kline 近1小时和近4小时
    if (m1 > m2 && m2 > m3 && k1 > k2 && k2 > k3) {
      // 涨的时刻
      canLong = true
      canShort = false
    } else if (m1 < m2 && m2 < m3 && k1 < k2 && k2 < k3) {
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
    const [k1, k2, k3] = await binance.getMaCompare(symbol, '1m', [1, 2, 3]) // 1min 线最近3条
    if (side === 'LONG') {
        return k1 < k2 && k2 < k3  // 价格在下跌中
    } else if (side === 'SHORT') {
        return k1 > k2 && k2 > k3 // 价格在上涨中
    } else {
        return false;
    }
}

module.exports = {
    getLongOrShort,
    canOrderComplete,
}