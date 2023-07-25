const { round } = require('mathjs')
const config = require('./config')

async function sleep(time) {
  return new Promise(resolve => setTimeout(resolve, time))
}

function dateFormat(format = 'Y-m-d H:i:s') {
  const date = new Date()
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return format
    .replace('Y', year)
    .replace('m', month.toString().padStart(2, 0))
    .replace('d', day.toString().padStart(2, 0))
    .replace('H', hour.toString().padStart(2, 0))
    .replace('i', minute.toString().padStart(2, 0))
    .replace('s', second.toString().padStart(2, 0))
}

function log(text, flag = null) {
  let result = config.log
  if (flag !== null) {
    result = flag
  }
  if (result) {
    if (typeof text === 'object') {
      console.log(`${dateFormat()}: ${JSON.stringify(text)}`)
    } else {
      console.log(`${dateFormat()}: ${text}`)
    }
  }
}

/**
 * 可以正确交易的价格，否则就会返回 400 错误
 * @param {*} price
 * @returns Number
 */
function roundOrderPrice(price, symbol = null) {
  const whiteSymbols = {
    'MKRUSDT': 1,
    'CRVUSDT': 3,
    'XTZUSDT': 3,
  }
  if (whiteSymbols[symbol]) {
    return round(price, whiteSymbols[symbol])
  }
  if (price > 500) {
    return round(price, 1)
  } else if (price > 10) {
    return round(price, 2)
  } else if (price > 1) {
    return round(price, 3)
  } else if (price > 0.1) {
    return round(price, 4)
  } else if (price > 0.01) {
    return round(price, 5)
  } else {
    return round(price, 6)
  }
}

function roundOrderQuantity(price, quantity, symbol = null) {
  const whiteSymbols = {
    'UNIUSDT': 3,
    'AAVEUSDT': 2,
    'SOLUSDT': 3,
    'AXSUSDT': 3,
  }
  if (whiteSymbols[symbol]) {
    return round(quantity, whiteSymbols[symbol])
  }
  if (price > 50) {
    return round(quantity, 2)
  } else if (price > 5) {
    return round(quantity, 1)
  } else if (price > 0.1) {
    return round(quantity, 0)
  } else {
    return round(quantity, 0)
  }
}

/**
 * 尝试执行函数
 * @param () =>{} fn
 * @param number max 最大次数
 * @param number sleepTime 失败时的休眠时间
 * @param bool isThrow 超过最大次数时，是否抛出异常
 * @returns
 */
async function tries(fn, max = 5, sleepTime = 1000, isThrow = false) {
  let num = 0
  let error
  while (num++ < max) {
    try {
      const result = await fn()
      return result
    } catch (e) {
      e = error
      console.log(`exec failed, num is ${num}`)
      await sleep(sleepTime)
    }
  }
  if (isThrow) {
    throw new Error(error)
  }
}

/**
 * 是否是一个升序数组
 * @param []<Number> arr 
 * @returns Boolean
 */
function isAsc(arr) {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i-1] >= arr[i]) {
      return false
    }
  }
  return true
}

/**
 * 是否是一个降序数组
 * @param []<Number> arr 
 * @returns Boolean
 */
function isDesc(arr) {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i-1] <= arr[i]) {
      return false
    }
  }
  return true
}

/**
 * 是否产生金叉
 * @param []<Number> ma1 
 * @param []<Number> ma2 
 * @param string type 
 * @returns Boolean
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
 * ma5 MA(5)=(收盘价1+收盘价2+收盘价3+收盘价4+收盘价5)/5
 * @param []Number klineClose 
 * @param Number n 
 * @returns Number
 */
function maN(klineClose, n) {
  return klineClose.slice(0, n).reduce((carry, item) => carry + item, 0) / n
}

/**
 * ma 的 n 条数据
 * @param {*} klineClose 
 * @param {*} n n kline
 * @param {*} 多条数数据
 * @returns 
 */
function maNList(klineClose, n, count = 20) {
  const result = []
  for (let i = 0; i < count; i++) {
    result.push(maN(klineClose.slice(i), n))
  }
  return result
}

module.exports = {
  sleep,
  dateFormat,
  log,
  roundOrderPrice,
  roundOrderQuantity,
  tries,
  isAsc,
  isDesc,
  kdj,
  maN,
  maNList,
}
