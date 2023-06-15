const express = require('express')
const shell = require('shelljs')
const cors = require('cors-express')
const jwt = require('express-jwt')
const jwtToken = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')
const { exit } = require('process')

const { knex } = require('../db')
const { web } = require('../config.js')
const { resJson } = require('./utils')
const { tries } = require('../utils')
const currentDir = path.dirname(__filename)
const webIndex = web.enterPoint || '/'

const app = express()
const port = web.port || 2222
const secret = web.secret || '12321'
const user = {
  name: web.username || 'admin',
  password: web.password || 'admin',
}

const options = {
  allow: {
    origin: '*',
    methods: 'GET,PATCH,PUT,POST,DELETE,HEAD,OPTIONS',
    headers: 'Content-Type, Authorization, Content-Length, X-Requested-With, X-HTTP-Method-Override',
  },
  options: function (req, res, next) {
    if (req.method == 'OPTIONS') {
      res.status(204).end()
    } else {
      next()
    }
  },
}

// 静态资源
app.use(express.static(path.join(currentDir, 'dist'), { index: false }))

// 跨域配置
app.use(cors(options))

// jwt token 设置
app.use(
  jwt({
    secret, // 签名的密钥 或 PublicKey
    algorithms: ['HS256'],
  }).unless({
    path: ['/login', '/pull', '/pm2-log', webIndex], // 指定路径不经过 Token 解析
  })
)

app.use(function (err, req, res, next) {
  if (req.path.includes('static') && !req.path.includes('index.html')) {
    // 避免静态资源被jwt校验
    next()
  } else if (err.name === 'UnauthorizedError') {
    // res.status(401).send('invalid token...')
    // res.status(404).end()
    res.redirect(webIndex);
  }
})
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

// 登录
app.post('/login', (req, res) => {
  const { body } = req
  const { username, password } = body
  if (username === user.name && password === user.password) {
    const token =
      'Bearer ' +
      jwtToken.sign(
        {
          name: username, // 自定义区域
        },
        secret,
        {
          expiresIn: 3600 * 24 * 7, // 过期时间
        }
      )
    res.json(
      resJson(200, {
        token,
      })
    )
  } else {
    res.json(resJson(101, '账号或密码错误'))
  }
})

// 当前合约交易对信息
app.get('/features', async (req, res) => {
  const {
    query: { sort = '+' },
  } = req
  const allSymbols = await tries(async () => await knex('symbols').orderBy('enable', 'desc').orderBy('percentChange', sort === '-' ? 'desc' : 'asc'))
  const sortAllSymbols = allSymbols
    .map(item => ({ ...item, percentChange: Number(item.percentChange) }))
    // .sort((a, b) => {
    //   if (sort === '-') {
    //     return a.percentChange < b.percentChange ? -1 : 1
    //   }
    //   return a.percentChange < b.percentChange ? 1 : -1
    // }) // 涨幅从小到大排序
  res.json(resJson(200, sortAllSymbols))
})

// 修改合约交易对信息
app.put('/features/:id', async (req, res) => {
  const {
    body,
    params: { id },
  } = req
  const result = await tries(async () => await knex('symbols').where('id', id).update(body))
  res.json(resJson(200))
})

// 修改合约交易对开启关闭
app.put('/features/enable/:flag', async (req, res) => {
  const {
    params: { flag },
  } = req
  const result = await tries(async () => await knex('symbols').update({ enable: flag }))
  res.json(resJson(200))
})

// 新增合约交易对信息
app.post('/features', async (req, res) => {
  const { body } = req
  const result = await tries(async () => await knex('symbols').insert(body))
  console.log(result)
  res.json(resJson(200, body))
})

// 修改合约交易对信息
app.delete('/features/:id', async (req, res) => {
  const {
    body,
    params: { id },
  } = req
  const result = await tries(async () => await knex('symbols').where('id', id).delete())
  res.json(resJson(200))
})

// 读取配置文件
app.get('/config', (req, res) => {
  const configText = fs.readFileSync(path.resolve(currentDir, '../config.js'), {
    encoding: 'utf8',
  })
  res.json(
    resJson(200, {
      content: configText,
    })
  )
})

// 修改配置
app.put('/config', (req, res) => {
  const {
    body: { code },
  } = req
  fs.writeFileSync(path.resolve(currentDir, '../config.js'), code)
  const result = shell.exec(web.command.start) // 重启服务
  res.json(resJson(200, result))
})

// 开启
app.post('/start', (req, res) => {
  const result = shell.exec(web.command.start)
  res.json(resJson(200, result))
})

// 退出
app.post('/stop', (req, res) => {
  const result = shell.exec(web.command.stop)
  res.json(resJson(200, result))
})

// git hook 拉代码
app.post('/pull', (req, res) => {
  const result = shell.exec('git pull')
  res.json(resJson(200, result))
})

// git log 
app.get('/pm2-log', (req, res) => {
  const { key } = req.query
  if (key === 'sorry510') {
    const result = shell.exec('pm2 log --lines 30 --nostream bian_futurees')
    res.send(result).end()
  } else {
    res.status(404).end()
  }
})

// 查看前台页面
app.get(webIndex, (req, res) => {
  res.sendFile(path.resolve(currentDir, './dist/index.html'), { maxAge: 0 })
})

app.listen(port, () => {
  console.log(`app listening at http://localhost:${port}`)
})
