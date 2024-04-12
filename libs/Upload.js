/**
 * @author      OA Wu <oawu.tw@gmail.com>
 * @copyright   Copyright (c) 2015 - 2024, @oawu/uploader
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

const Path   = require('path')
const FileSystem = require('fs')

const access = (path, permission = FileSystem.constants.R_OK) => {
  let bool = false
  try {
    FileSystem.accessSync(path, permission)
    bool = true
  } catch (_) {
    bool = false
  }
  return bool
}

const isDirectory = path => !!FileSystem.statSync(path).isDirectory()

const exists = dir => {
  let bool = false
  try { 
    bool = FileSystem.existsSync(dir)
  } catch (_) {
    bool = false
  }
  return bool
}

const scanDirSync = (dir, recursive = true) => {
  arr = []

  try {
    if (!exists(dir)) {
      arr = []
    } else {
      arr = FileSystem.readdirSync(dir)
        .map(file => !['.', '..'].includes(file)
          ? recursive && access(dir + file) && isDirectory(dir + file)
            ? scanDirSync(`${dir}${file}${Path.sep}`, recursive)
            : [`${dir}${file}`]
          : null)
        .filter(t => t !== null)
        .reduce((a, b) => a.concat(b), [])
    }
  } catch (_) {
    arr = []
  }

  return arr
}
const mkdir = (dir, recursive = false) => {
  let bool = false
  try {
    let bool = FileSystem.mkdirSync(dir, { recursive })
  } catch (_) {
    bool = false
  }
  return bool
}
const deSlash = path => path.split(Path.sep).filter(t => t !== '')

const dirOrEmpty = path => {
  path = deSlash(path)
  return path.length
    ? `${path.join(Path.sep)}${Path.sep}`
    : ''
}


const Upload = {
  instances: {
    S3: new WeakMap(),
    GitHub: new WeakMap()
  },
  option: {
    destDir: {
      default: null,
      valid (val) {
        if (typeof val == 'string' && val !== '') {
          val = Path.normalize(`${val}${Path.sep}`)
        }

        return access(val) && isDirectory(val)
          ? val
          : this.default
      }
    },
    prefix: {
      default: '',
      valid (val) {
        if (typeof val == 'string' && val !== '') {
          val = val.split('/').filter(v => v.length)
        }

        return val.length ? `${val.join('/')}/` : this.default
      }
    },
    ignoreNames: {
      default: ['.DS_Store'],
      valid (val) {
        return Array.isArray(val) ? val : this.default
      }
    },
    ignoreExts: {
      default: [],
      valid (val) {
        return Array.isArray(val)
          ? val.map(v => v.toLowerCase())
          : this.default
      }
    },
    ignoreDirs: {
      default: [],
      valid (val) {
        return Array.isArray(val)
          ? val.map(v => v.split('/')
                 .filter(v => v.length)
                 .join('/'))
               .filter(v => v.length)
               .map(v => `${v}${Path.sep}`)
          : this.default
      }
    },
    isDisplay: {
      default: false,
      valid (val) {
        return typeof val == 'boolean'
          ? val
          : this.default
      }
    },
    done: {
      default: null,
      valid (val) {
        return typeof val == 'function'
          ? val
          : this.default
      }
    },
  },
  putArgv: (destDir, prefix, done, destDirFunc, prefixFunc, doneFunc) => {
    if (typeof destDir == 'function') {
      doneFunc(destDir)
    }
    if (typeof prefix == 'function') {
      doneFunc(prefix)
    }
    if (typeof done == 'function') {
      doneFunc(done)
    }
    if (typeof destDir == 'string' && destDir !== '') {
      destDirFunc(destDir)
    }
    if (typeof prefix == 'string' && prefix !== '') {
      prefixFunc(prefix)
    }
  },
  scanDir: (dest, names, exts, dirs) => scanDirSync(dest)
    .map(file => ({
      file,
      name: Path.basename(file),
      dir: `${Path.dirname(file)}${Path.sep}`,
      ext: Path.extname(file).toLowerCase()
    }))
    .filter(file => {
      if (names.includes(file.name)) {
        return false
      }
      if (exts.includes(file.ext)) {
        return false
      }
      
      if (dirs.map(dir => dest + dir).filter(dir => Path.normalize(file.dir).startsWith(Path.normalize(dir))).length) {
        return false
      }

      return true
    }
  ),
  checkDirsExist: (base, dirs) => {
    dirs = dirs.reduce((a, b) => {
      const last = a.pop()

      if (last === undefined) {
        return [[b]]
      }

      return [...a, last, last.concat(b)]
    }, []).map(dirs => dirOrEmpty(dirs.join(Path.sep))).filter(t => t !== '')

    for (let dir of dirs) {
      dir = `${base}${dir}`

      if (access(dir) && isDirectory(dir)) {
        continue
      }

      mkdir(dir)
    
      if (access(dir) && isDirectory(dir)) {
        continue
      }
      
      return false
    }

    return true
  }
}

module.exports = Upload
