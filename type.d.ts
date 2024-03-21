export type Symbol = {
  id: number,
  symbol: string,
  quantity: string,
  percentChange: string,
  close: string,
  open: string,
  low: string,
  enable: number,
  updateTime: number,
  lastClose: string,
  lastUpdateTime: number
}

export type Position = {
  symbol: string, // 交易对
  initialMargin: string, // 当前所需起始保证金(基于最新标记价格)
  maintMargin: string, //维持保证金
  unrealizedProfit: string, // 持仓未实现盈亏
  positionInitialMargin: string, // 持仓所需起始保证金(基于最新标记价格)
  openOrderInitialMargin: string, // 当前挂单所需起始保证金(基于最新标记价格)
  leverage: string, // 杠杆倍率
  isolated: boolean, // 是否是逐仓模式
  entryPrice: string, // 持仓成本价
  maxNotional: string, // 当前杠杆下用户可用的最大名义价值
  positionSide: string, // 持仓方向
  positionAmt: string, // 持仓数量
  updateTime: number, // 更新时间(订单交易成功时的时间，毫秒时间戳)
}

export type Order = {
  clientOrderId: string, // 用户自定义的订单号
  cumQty: string,
  cumQuote: string, // 成交金额
  executedQty: string, // 成交量
  orderId: number, // 系统订单号
  avgPrice: string, // 平均成交价
  origQty: string, // 原始委托数量
  price: string, // 委托价格
  reduceOnly: boolean, // 仅减仓
  side: 'BUY'|'SELL', // 买卖方向
  positionSide: 'LONG'|'SHORT', // 持仓方向
  status: 'NEW', // 订单状态
  stopPrice: string, // 触发价，对`TRAILING_STOP_MARKET`无效
  closePosition: boolean, // 是否条件全平仓
  symbol: string, // 交易对
  timeInForce: 'GTC', // 有效方法
  type: 'TRAILING_STOP_MARKET', // 订单类型
  origType: 'TRAILING_STOP_MARKET', // 触发前订单类型
  activatePrice: string, // 跟踪止损激活价格, 仅`TRAILING_STOP_MARKET` 订单返回此字段
  priceRate: string, // 跟踪止损回调比例, 仅`TRAILING_STOP_MARKET` 订单返回此字段
  updateTime: number, // 更新时间
  workingType: 'CONTRACT_PRICE', // 条件价格触发类型
  priceProtect: boolean, // 是否开启条件单触发保护
}