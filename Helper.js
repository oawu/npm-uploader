/**
 * @author      OA Wu <comdan66@gmail.com>
 * @copyright   Copyright (c) 2015 - 2021, @oawu/uploader
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

const Path = require('path')
const FileSystem = require('fs')
const Progress = require('@oawu/cli-progress')

module.exports = {
  println: text => process.stdout.write('' + text + "\n"),

  scanDir (dir, recursive = true) {
    try { return this.exists(dir) ? FileSystem.readdirSync(dir).map(file => !['.', '..'].includes(file) ? recursive && this.access(dir + file) && this.isDirectory(dir + file) ? this.scanDir(dir + file + Path.sep, recursive) : [dir + file] : null).filter(t => t !== null).reduce((a, b) => a.concat(b), []) : [] }
    catch (_) { return [] }
  },

  access (path, permission = FileSystem.constants.R_OK) {
    try { return FileSystem.accessSync(path, permission), true }
    catch (error) { return false }
  },

  isDirectory: (dir, permission = FileSystem.constants.R_OK) => !!FileSystem.statSync(dir).isDirectory(),

  isSub: (sub, main) => {
    return sub = sub.split('').map(s => s.charCodeAt(0)), main = main.split('').map(s => s.charCodeAt(0)).slice(0, sub.length), main !== false && sub.join('') === main.join('')
  },

  exists: dir => {
    try { return FileSystem.existsSync(dir) }
    catch (e) { return false }
  },

  mkdir: (dir, recursive = false) => {
    try { return FileSystem.mkdirSync(dir, { recursive }), true }
    catch (e) { return false }
  },

  verifyDirs (base, dirs) {
    for (let dir of dirs.reduce((a, b) => { const last = a.pop(); return last === undefined ? [[b]] : [...a, last, last.concat(b)] }, []).map(dirs => dirs.length ? dirs.join(Path.sep) + Path.sep : ''))
      if (!(this.access(base + dir) && this.isDirectory(base + dir)))
        if (this.mkdir(base + dir), !(this.access(base + dir) && this.isDirectory(base + dir)))
          return false
    return true
  }
}
