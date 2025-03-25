/**
 * @author      OA Wu <oawu.tw@gmail.com>
 * @copyright   Copyright (c) 2015 - 2025, @oawu/uploader
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

const fs = require('fs/promises')
const Path = require('path')
const { ListObjectsV2Command } = require('@aws-sdk/client-s3')
const { Type: T, tryIgnore } = require('@oawu/helper')

const _commonOptions = {
  destDir: {
    async check(val) {
      if (!T.neStr(val)) {
        throw new Error('必須要有 destDir，並且是非空字串')
      }

      val = Path.normalize(val + Path.sep)

      const access = await tryIgnore(fs.access(val, fs.constants.F_OK))
      if (T.err(access)) {
        throw new Error(`路徑「${val}」沒有訪問權限`, { cause: access })
      }
      const stats = await fs.stat(val)

      if (!stats.isDirectory()) {
        throw new Error(`路徑「${val}」不是目錄類型`)
      }

      return val
    }
  },
  prefix: {
    default: '',
    check(val) {
      if (T.neStr(val)) {
        val = val.split('/').filter(v => v !== '')
      } else {
        val = this.default
      }
      return val.length ? `${val.join('/')}/` : this.default
    }
  },
  ignoreNames: {
    default: ['.DS_Store', 'Thumbs.db', '.gitignore'],
    check(val) {
      return T.arr(val) ? val : this.default
    }
  },
  ignoreExts: {
    default: [],
    check(val) {
      return T.arr(val)
        ? val.map(v => v.toLowerCase())
        : this.default
    }
  },
  ignoreDirs: {
    default: [],
    check(val) {
      return T.arr(val)
        ? val.map(v => v.split('/').filter(v => v !== '').join('/')).filter(v => v !== '').map(v => `${v}${Path.sep}`)
        : this.default
    }
  },
}

const options = {
  s3: {
    bucket: {
      check(val) {
        if (!T.neStr(val)) {
          throw new Error('必須要有 bucket，並且是非空字串')
        }
        return val
      }
    },
    access: {
      check(val) {
        if (!T.neStr(val)) {
          throw new Error('必須要有 access，並且是非空字串')
        }
        return val
      }
    },
    secret: {
      check(val) {
        if (!T.neStr(val)) {
          throw new Error('必須要有 secret，並且是非空字串')
        }
        return val
      }
    },
    region: {
      check(val) {
        if (!T.neStr(val)) {
          throw new Error('必須要有 region，並且是非空字串')
        }
        return val
      }
    },
    option: {
      default: {},
      check(val) {
        return T.obj(val) ? val : this.default
      }
    },
    ..._commonOptions
  },

  github: {
    account: {
      check(val) {
        if (!T.neStr(val)) {
          throw new Error('必須要有 account，並且是非空字串')
        }
        return val
      }
    },
    repository: {
      check(val) {
        if (!T.neStr(val)) {
          throw new Error('必須要有 repository，並且是非空字串')
        }
        return val
      }
    },
    branch: {
      default: 'gh-pages',
      check(val) {
        return T.neStr(val) ? val : this.default
      }
    },
    message: {
      default: '🚀 部署！',
      check(val) {
        return T.neStr(val) ? val : this.default
      }
    },
    ..._commonOptions
  }
}

const inDir = (parent, child) => Path.normalize(child).startsWith(Path.normalize(parent))

const fileExt = path => {
  const idx = path.lastIndexOf('.')
  return idx !== -1 && idx !== path.length - 1 ? path.substring(idx).toLowerCase() : ''
}

const fileName = path => {
  const idx = path.lastIndexOf('.')
  return idx !== -1 && idx !== path.length - 1 ? path.substring(0, idx).toLowerCase() : path
}

const scanLocal = async (path, recursive) => {
  const files = []
  try {
    files.push(...await fs.readdir(path, { encoding: 'utf-8' }))
  } catch (error) {
    return []
  }

  const infos = []
  for (const file of files) {
    const filePath = path + file

    let _infos = []
    try {
      await fs.access(filePath, fs.constants.R_OK)
      const stats = await fs.stat(filePath)

      if (stats.isFile()) {
        _infos = [{
          type: 'file',
          fullpath: filePath,
          fullname: file,
          path: path,
          name: fileName(file),
          ext: fileExt(file),
        }]
      }

      if (stats.isDirectory()) {
        _infos = [
          {
            type: 'dir',
            path: filePath + Path.sep,
            name: file,
          },
          ...recursive ? await scanLocal(filePath + Path.sep, recursive) : []
        ]
      }
    } catch (_) {
      _infos = []
    }

    infos.push(..._infos)
  }

  return infos
}

const scanS3 = async (s3Client, options) => {
  const data = await tryIgnore(s3Client.send(new ListObjectsV2Command(options)))
  if (T.err(data)) {
    throw new Error('無法取得 S3 的 Bucket 內容', { cause: data })
  }

  const _items = T.arr(data.Contents) ? data.Contents : []
  const items = _items.map(({ Key, ETag }) => ({ Key, hash: ETag }))

  return data.IsTruncated
    ? [...items, ...await scanS3(s3Client, { ...options, ContinuationToken: data.NextContinuationToken })]
    : items
}

const chunkArray = (arr, limit) => {
  const newArr = []
  for (let i = 0; i < arr.length; i += limit) {
    newArr.push(arr.slice(i, i + limit))
  }
  return newArr
}

const Step = async (_, func) => {
  const setter = {
    total: _ => { },
    advance: _ => { },
  }

  let result = null
  try {
    if (T.func(func)) {
      result = func(setter)
    } else if (T.asyncFunc(func)) {
      result = await func(setter)
    } else if (T.promise(func)) {
      result = await func
    }
  } catch (e) {
    throw e
  }

  return result
}

const checkDir = async (dir, permission) => {
  if (T.err(await tryIgnore(fs.access(dir)))) {
    await tryIgnore(fs.mkdir(dir, { recursive: false }))
  }

  const access = await tryIgnore(fs.access(dir, permission))
  if (T.err(access)) {
    throw new Error(`路徑「${dir}」沒有訪問權限。`, { cause: access })
  }

  const stats = await fs.stat(dir)

  if (!stats.isDirectory()) {
    throw new Error(`路徑「${dir}」不是目錄類型。`)
  }
  return true
}

const checkDirs = async (base, dirs) => {
  for (let dir of dirs) {
    base = base + dir + Path.sep
    await checkDir(base, fs.constants.R_OK | fs.constants.W_OK, null)
  }
  return true
}

module.exports = {
  options,
  inDir,
  scanLocal,
  scanS3,
  chunkArray,
  Step,
  checkDirs
}
