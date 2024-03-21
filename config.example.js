module.exports = {
  api_key: '',
  api_secret: '',
  log: true, // 日志输出

  usdt: 10, // 交易金额 usdt
  profit: 10, // 止盈率
  loss: 10, // 止损率
  leverage: 15, // 合约倍数
  buyTimeOut: 60 * 5, // 挂单购买的超时时间, 秒级别, 默认5分钟
  excludeSymbols: ['SANDUSDT'], // 排除使用本程序自动交易的币种
  cha: [0, 20], // 差值(废弃)
  maxCount: 5, // 同时开仓的最大数量
  allowLong: true, // 允许做多
  allowShort: true, // 允许做空
  buyType: 'MARKET', // 下单类型, MARKET 市价, LIMIT: 限价(根据价格深度取平均价挂单，有可能无法买入)
  holdMaxTime: 60 * 24, // 持仓的最长时间, 分钟级别, 默认24小时

  dingding_token: '',
  dingding_word: '报警',

  sleep_time: 1, // 轮训时间
  websocket: true, // 自动更新币种信息, 使用时必须为 true
  strategy: 'line5', // 交易策略
  strategyCoin: 'coin5', // 选币策略

  web: {
    secret: 'mdzxy2139527',
    port: 2222,
    username: 'admin',
    password: 'admin',
    enterPoint: '/',
    command: {
      start: 'pm2 start xxx',
      stop: 'pm2 stop xxx',
      log: 'pm2 log xxx',
    },
  },
}
