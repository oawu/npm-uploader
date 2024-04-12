/**
 * @author      OA Wu <oawu.tw@gmail.com>
 * @copyright   Copyright (c) 2015 - 2024, @oawu/uploader
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

const Path       = require('path')
const FileSystem = require('fs')
const Progress   = require('@oawu/cli-progress')
const Upload     = require('./Upload')

const GitHub = function(option) {
  if (this instanceof GitHub) {
    return this
  }

  const instance = new GitHub()

  Upload.instances.GitHub.set(instance, GitHub.model)

  Object.entries(option)
    .filter(([key]) => GitHub.keys.includes(key))
    .forEach(([key, val]) => instance[key] = val)

  return instance
}

GitHub.prototype.put = function(destDir, prefix, closure) {

  const display = (...argvs) => {
    if (this.isDisplay) {
      for (const argv of argvs) {
        if (typeof argv == 'string') {
          process.stdout.write(`${argv}\n`)
        }
        if (typeof argv == 'function') {
          argv()
        }
      }
    }
    return true
  }

  const title   = (...t) => display(_ => Progress.title(...t))
  const total   = t => display(_ => Progress.total(t))
  const advance = _ => display(_ => Progress.advance)
  const fail    = _ => display(_ => Progress.fail())
  const done    = _ => display(_ => Progress.done())
  const finish  = (...vals) => this.done && this.done(...vals)

  display("\n" + ' 【部署至 Github Page】'.yellow)
  title('檢查 GitHub 的參數')
  total(1)

  Upload.putArgv(destDir, prefix, closure,
    destDir => this.destDir = destDir,
    prefix => this.prefix = prefix,
    done => this.done = done)

  const Exec = require('child_process').exec

  if (this.account === null) {
    return finish(new Error('沒有設定 Account', fail()))
  }
  if (this.repository === null) {
    return finish(new Error('沒有設定 Repository', fail()))
  }
  if (this.destDir === null) {
    return finish(new Error('沒有指定上傳的目錄', fail()))
  }

  done()

  require('@oawu/queue').create()
    .enqueue(next => {
      title('建立暫存使用的目錄')
      total(1)

      FileSystem.mkdtemp(require('os').tmpdir() + Path.sep, (error, folder) => error
        ? finish(error, fail())
        : next(folder + Path.sep, done()))
    })
    .enqueue((next, folder) => {
      title('清空暫存使用的目錄')
      total(1)

      Exec('rm -rf ' + folder + '*', error => error
        ? finish(error, fail())
        : next(folder, done()))
    })
    .enqueue((next, folder) => {
      title('掃描本地的檔案結構')

      let files = Upload.scanDir(this.destDir, [...this.ignoreNames, '.DS_Store', '.gitignore', '.gitkeep'], this.ignoreExts, [...this.ignoreDirs, '.git'])

      total(files.length)

      files = files
        .map(({ file: src, dist, dirs }) => ({
          src,
          dist: `${folder}${this.prefix}${Path.relative(this.destDir, src)}`,
          dirs: `${this.prefix}${Path.relative(this.destDir, Path.dirname(src))}`
            .split(Path.sep)
            .filter(t => t.length)
        }))

      done()

      next(folder, files)
    })
    .enqueue((next, folder, files) => {
      title('複製檔案至暫存目錄')
      total(files.length)

      const promises = files.map(({ src, dirs, dist }) => new Promise((resolve, reject) => {

        if (!Upload.checkDirsExist(folder, dirs)) {
          return reject(new Error('無法建立目錄「' + dirs.join(Path.sep) + '」！'))
        }

        const r = FileSystem.createReadStream(src)
        const w = FileSystem.createWriteStream(dist)

        w.on('error', reject)
        w.on('close', _ => resolve(advance()))

        r.on('error', reject)
        r.pipe(w)
      }))

      let _error = null
      const _wait = _ => {
        if (_error === null) {
          return setTimeout(_wait, 100)
        }
        
        if (_error instanceof Error) {
          fail()
          return finish(_error)
        }

        if (Array.isArray(_error)) {
          done()
          return next(folder, files, _error)
        }
      }
      _wait()

      Promise.all(promises)
        .then(files => _error = files)
        .catch(error => _error = error)
    })
    .enqueue((next, folder, files) => {
      title('暫存目錄內初始 Git')
      total(1)

      Exec(`cd ${folder} && git init`, error => error
        ? finish(error, fail())
        : next(folder, files, done()))
    })
    .enqueue((next, folder, files) =>  {
      title('取得目前 Git 分支')
      total(1)

      Exec(`cd ${folder} && git branch --show-current`, (error, data) => error
        ? finish(error, fail())
        : next(folder, files, data.trim(), done()))
    })
    .enqueue((next, folder, files, branch) => {
      title('Git 將所有檔案紀錄')
      total(1)


      if (!files.length) {
        return next(folder, files, branch, done())
      }

      Exec(`cd ${folder} && git add --all`, error => error
        ? finish(error, fail())
        : next(folder, files, branch, done()))
    })
    .enqueue((next, folder, files, branch) => {
      title('Git 建立起修改紀錄')
      total(1)

      Exec(`cd ${folder} && git commit --message "${this.message}"${files.length ? '' : ' --allow-empty'}`, error => error
        ? finish(error, fail())
        : next(folder, branch, done()))
    })
    .enqueue((next, folder, branch) => {
      title('將 Git 上傳 GitHub')
      total(1)

      Exec(`cd ${folder} && git push --force git@github.com:${this.account}/${this.repository}.git ${branch}:${this.branch}`, error => error
        ? finish(error, fail())
        : next(folder, done()))
    })
    .enqueue((next, folder) => {

      title('移除暫存使用的目錄')
      total(1)

      Exec(`rm -rf ${folder}`, error => error
        ? finish(error, fail())
        : next(folder, done()))
    })
    .enqueue(next => finish())
}

GitHub.option = {
  ...Upload.option,

  account: {
    default: null,
    valid (val) {
      return typeof val == 'string' && val !== ''
        ? val
        : this.default
    }
  },
  repository: {
    default: null,
    valid (val) {
      return typeof val == 'string' && val !== ''
        ? val
        : this.default
    }
  },
  branch: {
    default: 'gh-pages',
    valid (val) {
      return typeof val == 'string' && val !== ''
        ? val
        : this.default
    }
  },
  message: {
    default: '🚀 部署！',
    valid (val) {
      return typeof val == 'string' && val !== ''
        ? val
        : this.default
    }
  },
}

Object.defineProperty(GitHub, 'keys', {
  get: _ => Object.entries(GitHub.option).map(([key]) => key)
})

Object.defineProperty(GitHub, 'model', {
  get: _ => {
    const tmp = {}
    
    Object.entries(GitHub.option)
      .forEach(([key, val]) => tmp[key] = val.default)
    
    return tmp
  }
})

GitHub.keys.forEach(key => Object.defineProperty(GitHub.prototype, key, {
  get () {
    return Upload.instances.GitHub.get(this)[key]
  },
  set (val) {
    if (GitHub.option[key]) {
      let model = Upload.instances.GitHub.get(this) || GitHub.model
      model[key] = GitHub.option[key].valid(val)
    }
    return this
  }
}))

module.exports = GitHub
