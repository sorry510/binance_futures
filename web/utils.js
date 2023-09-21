function resJson(code = 200, msg, data) {
  if (typeof msg === 'object') {
    data = msg
    msg = 'success'
  }
  return {
    code,
    msg,
    data,
  }
}

function dateFormat(time = null, format = 'Y-m-d H:i:s') {
  const date = time ? new Date(time) : new Date()
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return format
    .replace('Y', year)
    .replace('m', month.toString().padStart(2, 0))
    .replace('d', day.toString().padStart(2, 0))
    .replace('H', hour.toString().padStart(2, 0))
    .replace('i', minute.toString().padStart(2, 0))
    .replace('s', second.toString().padStart(2, 0))
}

module.exports = {
  resJson,
  dateFormat,
}
