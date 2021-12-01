const axios = require('axios')
const { round } = require('mathjs')
const config = require('./config')
const { dateFormat } = require('./utils')
const author = '<sorry510sf@gmail.com>'

async function dingding(text) {
  const data = {
    msgtype: 'markdown',
    markdown: {
      title: `${config.dingding_word}`, // 首屏会话透出的展示内容
      text: text,
    },
    at: {
      atMobiles: ['1'],
    },
  }

  if (config.dingding_token == '') {
    return '尚未开启钉钉推送'
  }
  try {
    const result = await axios.post(`https://oapi.dingtalk.com/robot/send?access_token=${config.dingding_token}`, data)
    return result.data
  } catch (e) {
    console.log(e)
  }
}

async function notify(text, type = 'dingding') {
  let data
  switch (type) {
    case 'dingding':
      data = await dingding(text)
      break
    default:
      data = await dingding(text)
  }
  return data
}

async function notifySymbolChange(trade) {
  const { symbol, quantity, buy_price, sell_price, rate } = trade
  const text = `## ${symbol}交易通知
  #### **币种**：${symbol}
  #### **类型**：<font color="#ff0000">价格变更</font>
  #### **买单价格**：<font color="#008000">${round(buy_price, 6)}</font>
  #### **卖单价格**：<font color="#008000">${round(sell_price, 6)}</font>
  #### **交易数量**：<font color="#008000">${round(quantity, 6)}</font>
  #### **止盈率**：<font color="#008000">${round(rate, 2)}%</font>
  #### **时间**：${dateFormat()}

  > author ${author}`
  await notify(text)
}

async function notifyBuyOrderSuccess(symbol, quantity, price, side = '做多') {
  const text = `## ${symbol}交易通知
  #### **币种**：${symbol}
  #### **类型**：<font color="#008000">买单</font>
  #### **挂买单价格**：<font color="#008000">${round(price, 6)}</font>
  #### **方向**：<font color="#008000">${side}</font>
  #### **买单数量**：<font color="#008000">${round(quantity, 6)}</font>
  #### **时间**：${dateFormat()}

  > author ${author}`
  await notify(text)
}

async function notifyBuyOrderFail(symbol, info) {
  const text = `## ${symbol}交易通知
  #### **币种**：${symbol}
  #### **类型**：<font color="#ff0000">挂买单失败</font>
  >${info}
  
  #### **时间**：${dateFormat()}

  > author ${author}`
  await notify(text)
}

async function notifySellOrderSuccess(symbol, quantity, price, side = '做多') {
  const text = `## ${symbol}交易通知
  #### **币种**：${symbol}
  #### **类型**：<font color="#ff0000">卖单</font>
  #### **挂卖单价格**：<font color="#008000">${round(price, 6)}</font>
  #### **方向**：<font color="#008000">${side}</font>
  #### **卖单数量**：<font color="#008000">${round(quantity, 6)}</font>
  #### **时间**：${dateFormat()}

  > author ${author}`
  await notify(text)
}

async function notifySellOrderFail(symbol, info) {
  const text = `## ${symbol}交易通知
  #### **币种**：${symbol}
  #### **类型**：<font color="#ff0000">卖单失败</font>
  >${info}
  
  #### **时间**：${dateFormat()}

  > author ${author}`
  await notify(text)
}

async function notifyCancelOrderSuccess(symbol) {
  const text = `## ${symbol}交易通知
  #### **币种**：${symbol}
  #### **类型**：<font color="#008000">撤销订单</font>
  #### **时间**：${dateFormat()}

  > author ${author}`
  await notify(text)
}

async function notifyCancelOrderFail(symbol, info) {
  const text = `## ${symbol}交易通知
  #### **币种**：${symbol}
  #### **类型**：<font color="#008000">成功撤销订单</font>
  >${info}
  
  #### **时间**：${dateFormat()}

  > author ${author}`
  await notify(text)
}

async function notifyServiceStop() {
  const text = `## 交易通知
  #### **类型**：<font color="#ff0000">交易服务停止 24 小时</font>
  #### **时间**：${dateFormat()}

  > author ${author}`
  await notify(text)
}

async function notifyServiceError(info) {
  const text = `## 交易通知
  #### **类型**：<font color="#ff0000">交易服务异常</font>
  >${info}
  
  #### **时间**：${dateFormat()}

  > author ${author}`
  await notify(text)
}

module.exports = {
  notify,
  notifySymbolChange,

  notifyBuyOrderSuccess,
  notifyBuyOrderFail,

  notifySellOrderSuccess,
  notifySellOrderFail,

  notifyCancelOrderSuccess,
  notifyCancelOrderFail,

  notifyServiceError,
  notifyServiceStop,
}
