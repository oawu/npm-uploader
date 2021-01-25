/**
 * @author      OA Wu <comdan66@gmail.com>
 * @copyright   Copyright (c) 2015 - 2021, @oawu/uploader
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

const Path   = require('path')
const Helper = require('./Helper')

const { Typeof } = Helper

const Upload = {
  instances: {
    S3: new WeakMap(),
    GitHub: new WeakMap()
  },
  option: {
    destDir: { default: null, valid (val) { return Typeof.str.notEmpty.do(val, v => val = Path.normalize(v + Path.sep)) && Helper.access(val) && Helper.isDirectory(val) ? val : this.default } },
    prefix: { default: '', valid (val) { return Typeof.str.notEmpty.do(val, v => val = v.split('/').filter(v => v.length)) && val.length ? val.join('/') + '/' : this.default } },
    ignoreNames: { default: ['.DS_Store'], valid (val) { return Typeof.arr.or(val, this.default) } },
    ignoreExts: { default: [], valid (val) { return Typeof.arr.do.or(val, val => val.map(v => v.toLowerCase()), this.default) } },
    ignoreDirs: { default: [], valid (val) { return Typeof.arr.do.or(val, val => val.map(v => v.split('/').filter(v => v.length).join('/')).filter(v => v.length).map(v => v + Path.sep), this.default) } },
    isDisplay: { default: false, valid (val) { return Typeof.bool.or(val, this.default) } },
    done: { default: null, valid (val) { return Typeof.func.or(val, this.default) } },
  },
  putArgv: (destDir, prefix, done, destDirFunc, prefixFunc, doneFunc) => {
    Typeof.func.do(destDir, doneFunc)
    Typeof.func.do(prefix, doneFunc)
    Typeof.func.do(done, doneFunc)
    Typeof.str.notEmpty.do(destDir, destDirFunc)
    Typeof.str.notEmpty.do(prefix, prefixFunc)
  },
  scanDir: (dest, names, exts, dirs) => Helper.scanDir(dest)
    .map(file => ({
      file,
      name: Path.basename(file),
      dir: Path.dirname(file) + Path.sep,
      ext: Path.extname(file).toLowerCase()
    }))
    .filter(
      file => !names.includes(file.name)
           && !exts.includes(file.ext)
           && !dirs.map(dir => this.destDir + dir)
                   .filter(d => Helper.isSubStr(d, file.dir)).length)
}

module.exports = Upload

