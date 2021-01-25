/**
 * @author      OA Wu <comdan66@gmail.com>
 * @copyright   Copyright (c) 2015 - 2021, @oawu/uploader
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

const Typeof = function() {

}
Typeof.func = val => typeof val == 'function'
Typeof.bool = val => typeof val == 'boolean'
Typeof.object = val => typeof val == 'object'

Typeof.str = val => typeof val == 'string'
Typeof.arr = val => Typeof.object(val) && Array.isArray(val)

Typeof.str.notEmpty = val => Typeof.str(val) && val !== ''
Typeof.arr.notEmpty = val => Typeof.arr(val) && val.length

Typeof.func.or = (val, d4) => Typeof.func(val) ? val : d4
Typeof.bool.or = (val, d4) => Typeof.bool(val) ? val : d4
Typeof.object.or = (val, d4) => Typeof.object(val) ? val : d4

Typeof.str.or = (val, d4) => Typeof.str(val) ? val : d4
Typeof.arr.or = (val, d4) => Typeof.arr(val) ? val : d4

Typeof.str.notEmpty.or = (val, d4) => Typeof.str.notEmpty(val) ? val : d4
Typeof.arr.notEmpty.or = (val, d4) => Typeof.arr.notEmpty(val) ? val : d4

Typeof.func.do = (val, func) => Typeof.func(val) && Typeof.func(func) && func(val)
Typeof.bool.do = (val, func) => Typeof.bool(val) && Typeof.func(func) && func(val)
Typeof.object.do = (val, func) => Typeof.object(val) && Typeof.func(func) && func(val)

Typeof.str.do = (val, func) => Typeof.str(val) && Typeof.func(func) && func(val)
Typeof.arr.do = (val, func) => Typeof.arr(val) && Typeof.func(func) && func(val)
Typeof.str.notEmpty.do = (val, func) => Typeof.str.notEmpty(val) && Typeof.func(func) && func(val)
Typeof.arr.notEmpty.do = (val, func) => Typeof.arr.notEmpty(val) && Typeof.func(func) && func(val)

Typeof.func.do.or = (val, func, d4) => Typeof.func(val = Typeof.func.do(val, func)) ? val : d4
Typeof.bool.do.or = (val, func, d4) => Typeof.bool(val = Typeof.bool.do(val, func)) ? val : d4
Typeof.object.do.or = (val, func, d4) => Typeof.object(val = Typeof.object.do(val, func)) ? val : d4

Typeof.str.do.or = (val, func, d4) => Typeof.str(Typeof.str.do(val, func)) ? val : d4
Typeof.arr.do.or = (val, func, d4) => Typeof.arr(val = Typeof.arr.do(val, func)) ? val : d4

Typeof.str.notEmpty.do.or = (val, func, d4) => Typeof.str.notEmpty(Typeof.str.notEmpty.do(val, func)) ? val : d4
Typeof.arr.notEmpty.do.or = (val, func, d4) => Typeof.arr.notEmpty(Typeof.arr.notEmpty.do(val, func)) ? val : d4

module.exports = Typeof
