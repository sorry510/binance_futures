const { knex, createTableIF } = require('./db')
const { tries, log } = require('./utils')

;(async () => {
  await createTableIF()
  const data = await tries(async () => await knex('symbols'))
  log(data)
})()
