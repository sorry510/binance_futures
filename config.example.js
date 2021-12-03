module.exports = {
  api_key: '',
  api_secret: '',
  log: true,
  usdt: 20,
  profit: 10,
  leverage: 10, // 10倍
  buyTimeOut: 120, // 超时时间
  excludeSymbols: ['SANDUSDT', 'MASKUSDT', 'LUNAUSDT', 'AVAXUSDT', 'IOTXUSDT'], // 排除自动平仓的币
  dingding_token: '78e5c7c7f760235894ed34f05afe5bb5451aea5e6727eaf5c3343635d801ad5e',
  dingding_word: '报警',
  sleep_time: 1,
  websocket: true,
  web: {
    secret: '',
    port: 2222,
    username: 'admin',
    password: 'lb7rCmHQXWDOV',
  },
}
