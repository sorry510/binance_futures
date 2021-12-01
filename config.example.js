module.exports = {
  api_key: '',
  api_secret: '',
  coins: [
    {
      symbol: 'DOTUSDT',
      usdt: 20,
      profit: 2, // 止盈率
      leverage: 10, // 10倍
      buyTimeOut: 120, // 超时时间
      canLong: true, // 开启多单
      canShort: true, // 开启空单
    },
  ],
  dingding_token: '',
  dingding_word: '报警',
  sleep_time: 1,
  web: {
    secret: '',
    port: 2222,
    username: 'admin',
    password: 'lb7rCmHQXWDOV',
  },
}
