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

module.exports = {
  sleep,
  dateFormat,
  log,
  roundOrderPrice,
  tries,
}
