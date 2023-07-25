const { strategy } = require('../config')
const { knex } = require('../db')
const { getLongOrShort, canOrderComplete, autoStop } = require(`../strategy/${strategy}`)

;(async () => {
  const allSymbols = await knex('symbols')
  for ( { symbol } of allSymbols) {
    // const stop = await autoStop(symbol, 'LONG', -14)
    // console.log(stop)
    const { canLong, canShort } = await getLongOrShort(symbol)
    console.log(symbol, canLong, canShort)
  }
})()