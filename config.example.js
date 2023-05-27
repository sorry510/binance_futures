module.exports = {
  api_key: '',
  api_secret: '',
  log: true, // 日志输出

  usdt: 20, // 交易金额 usdt
  profit: 3, // 止盈率
  loss: 6, // 止损率
  leverage: 10, // 合约倍数
  buyTimeOut: 120, // 挂单购买的超时时间
  excludeSymbols: ['SANDUSDT', 'MASKUSDT', 'LUNAUSDT', 'AVAXUSDT', 'IOTXUSDT'], // 排除自动平仓的币
  cha: [0, 20], // 差值

  dingding_token: '78e5c7c7f760235894ed34f05afe5bb5451aea5e6727eaf5c3343635d801ad5e',
  dingding_word: '报警',

  sleep_time: 1, // 轮训时间
  websocket: true, // 更新币种信息
  strategy: 'line1', // 交易策略
  strategyCoin: 'coin1', // 选币策略

  web: {
    secret: '323',
    port: 2222,
    username: 'admin',
    password: '',
    enterPoint: '/',
    command: {
      start: 'pm2 start all',
      stop: 'pm2 stop all',
    },
  },
}
