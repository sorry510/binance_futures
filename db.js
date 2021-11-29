const fs = require('fs')
const { log } = require('./utils')

const dbFile = './data/data.db'
const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: dbFile,
  },
  useNullAsDefault: true,
})

async function createTableIF() {
  if (!fs.existsSync(dbFile)) {
    await knex.schema
      .createTable('users', table => {
        table.increments('id')
        table.string('username')
        table.string('password')
      })
      .createTable('order', table => {
        table.increments('id')
        table.integer('orderId').unsigned().references('orderId')
        table.string('symbol')
        table.string('status') // 订单状态
        table.string('clientOrderId')
        table.string('price')
        table.string('timeInForce') // 有效方法
        table.string('type') // 订单类型
        table.string('side') // 买卖方向
        table.string('positionSide') // 持仓方向
        table.integer('updateTime')
      })
    // .createTable('order', table => {
    //   table.increments('id')
    //   table.string('account_name')
    //   table.integer('user_id').unsigned().references('users.id')
    // })
    log('create table success', true)
  }
}

module.exports = {
  createTableIF,
}
