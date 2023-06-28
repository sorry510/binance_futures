const { strategyCoin } = require('../config')
const { knex } = require('../db')
const { getCoins } = require(`../strategy/${strategyCoin}`)

;(async () => {
  const allSymbols = await knex('symbols')
  const coins = await getCoins(allSymbols)
  console.log(coins)
})()