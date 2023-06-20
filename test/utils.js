const { isAsc, isDesc } = require('../utils')

arr1 = [26619.9, 26798.6, 26804.1, 26995.4]
arr2 = [26919.9, 26898.6, 26704.1, 26695.4]
arr3 = [26919.9, 26898.6, 26904.1, 26895.4]

console.log(isAsc(arr1) === true)
console.log(isAsc(arr2) === false)
console.log(isAsc(arr3) === false)

console.log(isDesc(arr1) === false)
console.log(isDesc(arr2) === true)
console.log(isDesc(arr3) === false)