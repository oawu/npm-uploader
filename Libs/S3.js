/**
 * @author      OA Wu <oawu.tw@gmail.com>
 * @copyright   Copyright (c) 2015 - 2025, @oawu/uploader
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

const _fs = require('fs')
const Path = require('path')
const crypto = require('crypto')
const mime = require('mime-types')
const { S3Client, ListBucketsCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { NodeHttpHandler } = require('@smithy/node-http-handler')

const { Type: T, tryIgnore, closureOrPromise } = require('@oawu/helper')
const { options: { s3 }, inDir, scanLocal, scanS3, chunkArray, Step } = require('./Helper.js')

const _instanceModel = new Map()

const S3 = function (destDir, options) {
  if (this instanceof S3) {
    return this
  }

  const instance = new S3()
  _instanceModel.set(instance, { ...options, destDir })
  return instance
}

S3.prototype.execute = function (_step = null, done = null) {
  return closureOrPromise(done, async _ => {
    if (!T.asyncFunc(_step)) {
      _step = Step
    }

    const model = await _step('檢查上傳 S3 參數', async setter => {
      setter.total(1)
      const _model = _instanceModel.get(this) || {}

      const model = {}
      for (const key in s3) {
        model[key] = await s3[key].check(_model[key])
      }
      return model
    })

    const s3Client = await _step('初始化 S3 Client', async setter => {
      setter.total(1)

      const s3Client = new S3Client({
        credentials: {
          accessKeyId: model.access,
          secretAccessKey: model.secret,
        },
        region: model.region,

        requestHandler: new NodeHttpHandler({
          connectionTimeout: 3000,
          socketTimeout: 10000,
          httpAgent: new (require('http').Agent)({ maxSockets: 200 }),
          httpsAgent: new (require('https').Agent)({ maxSockets: 200 }),
        }),
      })

      if (s3Client === null) {
        throw new Error('S3 初始化失敗')
      }

      return s3Client
    })

    await _step('檢查 Bucket 權限', async setter => {
      setter.total(1)
      const list = await tryIgnore(s3Client.send(new ListBucketsCommand({})))
      if (T.err(list)) {
        throw new Error('無法取得 S3 的 Bucket 列表', { cause: list })
      }
      if (!list.Buckets.map(({ Name }) => Name).includes(model.bucket)) {
        throw new Error(`沒有 ${model.bucket} 此 Bucket 權限！`)
      }
    })

    const loFiles = await _step('掃描整理本地檔案', async setter => {
      setter.total(1)
      const _files = await scanLocal(model.destDir, true)

      const files = _files.filter(file => {
        if (file.type === 'dir') {
          return false
        }

        if (model.ignoreNames.includes(file.fullname)) {
          return false
        }

        if (model.ignoreExts.includes(file.ext)) {
          return false
        }

        if (model.ignoreDirs.map(dir => model.destDir + dir).filter(dir => inDir(dir, file.path)).length) {
          return false
        }

        return true
      })

      setter.total(files.length)

      return await Promise.all(files.map(({ fullpath }) => new Promise((resolve, reject) => {
        const output = crypto.createHash('md5')
        const input = _fs.createReadStream(fullpath)
        input.on('error', reject)

        const contentType = mime.lookup(fullpath)

        output.once('readable', _ => resolve({
          hash: `"${output.read().toString('hex')}"`,
          Body: _fs.createReadStream(fullpath),
          Key: `${model.prefix}${Path.relative(model.destDir, fullpath)}`,
          ContentType: T.neStr(contentType) ? contentType : 'text/plain'
        }, setter.advance()))

        input.pipe(output)
      })))
    })

    const s3Files = await _step('取得 S3 上的檔案', async setter => {
      setter.total(1)
      const files = await scanS3(s3Client, {
        Bucket: model.bucket,
        Prefix: model.prefix
      })

      setter.total(files.length)
      return files
    })

    const uFiles = await _step('過濾需上傳的檔案', async setter => {
      const files = loFiles.filter(loFile => !s3Files.filter(s3File => s3File.Key == loFile.Key && s3File.hash == loFile.hash).length)
      setter.total(files.length)
      return files
    })

    const dFiles = await _step('過濾需刪除的檔案', async setter => {
      const files = s3Files.filter(s3File => !loFiles.filter(loFile => loFile.Key == s3File.Key).length && !model.ignoreDirs.filter(dir => inDir(dir, s3File.Key)).length)
      setter.total(files.length)
      return files
    })

    await _step('將檔案上傳至 S3 ', async setter => {
      setter.total(uFiles.length)

      const chunks = chunkArray(uFiles, 50)
      for (const files of chunks) {
        await Promise.all(files.map(async ({ Body, Key, ContentType }) => {
          await s3Client.send(new PutObjectCommand({ ...model.option, Body, Key, ContentType, Bucket: model.bucket }))
          setter.advance()
        }))
      }
    })

    await _step('刪除 S3 上的檔案', async setter => {
      setter.total(dFiles.length)
      const chunks = chunkArray(dFiles, 50)
      for (const files of chunks) {
        await Promise.all(files.map(async ({ Key }) => {
          await s3Client.send(new DeleteObjectCommand({ Key, Bucket: model.bucket }))
          setter.advance()
        }))
      }
    })
  })
}

module.exports = S3