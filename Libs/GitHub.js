/**
 * @author      OA Wu <oawu.tw@gmail.com>
 * @copyright   Copyright (c) 2015 - 2025, @oawu/uploader
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

const os = require('os')
const _fs = require('fs')
const Path = require('path')
const fs = require('fs/promises')

const exec = require('child_process').exec
const { Type: T, tryIgnore, closureOrPromise } = require('@oawu/helper')
const { Step, options: { github }, scanLocal, inDir, checkDirs } = require('./Helper.js')

const _instanceModel = new Map()

const GitHub = function (destDir, options) {
  if (this instanceof GitHub) {
    return this
  }

  const instance = new GitHub()
  _instanceModel.set(instance, { ...options, destDir })
  return instance
}
GitHub.prototype.execute = async function (_step = null, done = null) {
  return closureOrPromise(done, async _ => {
    if (!T.asyncFunc(_step)) {
      _step = Step
    }
    const model = await _step('檢查 GitHub 的參數', async setter => {
      setter.total(1)
      const _model = _instanceModel.get(this) || {}

      const model = {}
      for (const key in github) {
        model[key] = await github[key].check(_model[key])
      }
      return model
    })

    const tmpDir = await _step('建立暫存使用的目錄', async setter => {
      setter.total(1)
      return Path.normalize(await fs.mkdtemp(os.tmpdir() + Path.sep + 'lalilo-github-', { recursive: true }) + Path.sep)
    })
    await _step('清空暫存使用的目錄', async setter => {
      setter.total(1)
      await new Promise((resolve, reject) => exec('rm -rf ' + tmpDir + '*', (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr })))
    })
    const files = await _step('掃描本地的檔案結構', async setter => {
      setter.total(1)
      const _files = await scanLocal(model.destDir, true)

      const files = _files.filter(file => {
        if (file.type === 'dir') {
          return false
        }

        if ([...model.ignoreNames, '.gitignore'].includes(file.fullname)) {
          return false
        }

        if (model.ignoreExts.includes(file.ext)) {
          return false
        }

        if ([...model.ignoreDirs, '.git'].map(dir => model.destDir + dir).filter(dir => inDir(dir, file.path)).length) {
          return false
        }

        return true
      })

      setter.total(files.length)

      return files.map(({ fullpath: src, path }) => ({
        src,
        dist: `${tmpDir}${model.prefix}${Path.relative(model.destDir, src)}`,
        dirs: `${model.prefix}${Path.relative(model.destDir, path)}`
          .split(Path.sep)
          .filter(t => t.length)
      }))
    })

    await _step('複製檔案至暫存目錄', async setter => {
      setter.total(files.length)

      await Promise.all(files.map(async ({ src, dist, dirs }) => {
        const dir = await tryIgnore(checkDirs(tmpDir, dirs))
        if (T.err(dir)) {
          throw new Error(`無法建立目錄「${dirs.join(Path.sep)}」。`, { cause: dir })
        }

        await new Promise((resolve, reject) => {
          const r = _fs.createReadStream(src)
          const w = _fs.createWriteStream(dist)

          w.on('error', reject)
          w.on('close', resolve)
          r.on('error', reject)
          r.pipe(w)
        })

        setter.advance()
      }))
    })

    await _step('暫存目錄內初始 Git', async setter => {
      setter.total(1)
      await new Promise((resolve, reject) => exec(`cd ${tmpDir} && git init`, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr })))
    })

    const branch = await _step('Git 取得目前的分支', async setter => {
      setter.total(1)
      const { stdout } = await new Promise((resolve, reject) => exec(`cd ${tmpDir} && git branch --show-current`, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr })))
      return stdout.trim()
    })

    await _step('Git 將所有檔案紀錄', async setter => {
      setter.total(1)

      if (!files.length) {
        return
      }
      await new Promise((resolve, reject) => exec(`cd ${tmpDir} && git add --all`, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr })))
    })

    await _step('Git 建立起修改紀錄', async setter => {
      setter.total(1)
      await new Promise((resolve, reject) => exec(`cd ${tmpDir} && git commit --message "${model.message}"${files.length ? '' : ' --allow-empty'}`, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr })))
    })

    await _step('將 Git 上傳 GitHub', async setter => {
      setter.total(1)
      await new Promise((resolve, reject) => exec(`cd ${tmpDir} && git push --force git@github.com:${model.account}/${model.repository}.git ${branch}:${model.branch}`, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr })))
    })

    await _step('移除暫存使用的目錄', async setter => {
      setter.total(1)
      await new Promise((resolve, reject) => exec(`rm -rf ${tmpDir}`, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr })))
    })
  })
}

module.exports = GitHub
