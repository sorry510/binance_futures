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
      .createTable('symbols', table => {
        table.increments('id')
        table.string('symbol')
        table.string('quantity')
        table.string('percentChange')
        table.string('close')
        table.string('open')
        table.string('low')
        table.integer('enable')
        table.integer('updateTime')
      })
    // .createTable('currentOrder', table => {
    //   table.increments('id')
    //   table.string('symbol')
    // })
    // .createTable('currentOrder', table => {
    //   table.increments('id')
    //   table.string('orderId')
    // }) // 未交割的订单
    // .createTable('order', table => {
    //   table.increments('id')
    //   table.integer('orderId').unsigned().references('orderId')
    //   table.string('symbol')
    //   table.string('status') // 订单状态
    //   table.string('clientOrderId')
    //   table.string('price')
    //   table.string('avgPrice')
    //   table.string('origQty')
    //   table.string('executedQty')
    //   table.string('cumQty')
    //   table.string('cumQuote')
    //   table.string('timeInForce') // 有效方法
    //   table.string('type') // 订单类型

    //   table.integer('reduceOnly')
    //   table.integer('closePosition')

    //   table.string('side') // 买卖方向
    //   table.string('positionSide') // 持仓方向
    //   table.string('stopPrice')
    //   table.string('workingType')
    //   table.string('priceProtect')
    //   table.string('origType')
    //   table.integer('updateTime')
    // })
    log('create table success', true)
  } else {
    log(`database has exist: ${dbFile}`)
  }
}

module.exports = {
  knex,
  createTableIF,
}
