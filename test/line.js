const { strategy } = require('../config')
const { knex } = require('../db')
const { getLongOrShort, canOrderComplete } = require(`../strategy/${strategy}`)

;(async () => {
  const allSymbols = await knex('symbols')
  for ( { symbol } of allSymbols) {
    const { canLong, canShort } = await getLongOrShort(symbol)
    console.log(symbol, canLong, canShort)
  }
})()