module.exports = {
  api_key: '',
  api_secret: '',
  log: true, // 日志输出

  usdt: 10, // 交易金额 usdt
  profit: 10, // 止盈率
  loss: 10, // 止损率
  leverage: 15, // 合约倍数
  buyTimeOut: 120, // 挂单购买的超时时间
  excludeSymbols: ['SANDUSDT'], // 排除自动平仓的币
  cha: [0, 20], // 差值(废弃)
  maxCount: 5, // 同时开仓的最大数量
  allowLong: true, // 允许做多
  allowShort: true, // 允许做空
  holdMaxTime: 60 * 24 * 30, // 持仓的最长时间, 分钟级别, 默认30天

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
