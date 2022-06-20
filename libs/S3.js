/**
 * @author      OA Wu <oawu.tw@gmail.com>
 * @copyright   Copyright (c) 2015 - 2022, @oawu/uploader
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

const Path       = require('path')
const FileSystem = require('fs')
const Progress   = require('@oawu/cli-progress')
const Upload     = require('./Upload')
const { Typeof, isSub, println } = require('@oawu/helper')

const getS3Files = (instance, options, closure, items = []) => instance.listObjectsV2(options, (error, data) => {
  if (error) return closure(error)
  else items = items.concat(data.Contents.map(({ Key, ETag }) => ({ Key, hash: ETag.replace(/^('|")(.*)\1/g, '$2') })))
  data.IsTruncated ? getS3Files(instance, { ...options, ContinuationToken: data.NextContinuationToken }, closure, items) : closure(null, items)
})

const S3 = function(option) {
  if (this instanceof S3) return this
  const instance = new S3()
  return Upload.instances.S3.set(instance, S3.model), Object.entries(option).filter(([key]) => S3.keys.includes(key)).forEach(([key, val]) => instance[key] = val), instance
}

S3.prototype.put = function(destDir, prefix, closure) {

  const display = (...argvs) => (this.isDisplay && argvs.forEach(argv => (Typeof.str.do(argv, println), Typeof.func.do(argv, argv))), true)

  const title   = (...t) => display(_ => Progress.title(...t))
  const total   = t => display(_ => Progress.total(t))
  const advance = _ => display(_ => Progress.advance)
  const fail    = _ => display(_ => Progress.fail())
  const done    = _ => display(_ => Progress.done())

  display("\n" + ' 【部署至 AWS S3】'.yellow)
  title('檢查上傳 S3 參數')
  total(1)

  Upload.putArgv(destDir, prefix, closure,
    destDir => this.destDir = destDir,
    prefix => this.prefix = prefix,
    done => this.done = done)

  const finish = (...vals) => this.done && this.done(...vals)

  const Mime = require('mime')
  const crypto = require('crypto')

  if (this.bucket === null)  return finish(new Error('沒有設定 Bucket', fail()))
  if (this.access === null)  return finish(new Error('沒有設定 Access', fail()))
  if (this.secret === null)  return finish(new Error('沒有設定 Secret', fail()))
  if (this.destDir === null) return finish(new Error('沒有指定上傳的目錄', fail()))

  const instance = new (require('aws-sdk/clients/s3'))({ accessKeyId: this.access, secretAccessKey: this.secret })

  if (instance === null) return finish(new Error('S3 初始化失敗'), fail())
  else done()

  require('@oawu/queue').create()

    .enqueue(next => title('檢查 Bucket 權限') && total(1) &&
      instance.listBuckets((error, data) => error
        ? finish(error, fail())
        : data.Buckets.map(({ Name }) => Name).includes(this.bucket)
          ? next(instance, done())
          : finish('這組 access、secret 沒有 ' + this.bucket + ' 此 Bucket 權限！', fail())))

    .enqueue((next, instance) => {
      title('掃描整理本地檔案')
      const files = Upload.scanDir(this.destDir, this.ignoreNames, this.ignoreExts, this.ignoreDirs).map(({ file }) => new Promise((resolve, reject) => { const output = crypto.createHash('md5'), input = FileSystem.createReadStream(file); input.on('error', reject), output.once('readable', _ => resolve({ hash: output.read().toString('hex'), Body: FileSystem.createReadStream(file), Key: this.prefix + Path.relative(this.destDir, file), ContentType: Mime.getType(file) || 'text/plain' }, advance())), input.pipe(output) }))
      Promise.all(files).then(localFiles => next(instance, { localFiles }, total(files.length), done())).catch(error => finish(error, fail()))
    })

    .enqueue((next, instance, files) => title('取得 S3 上的檔案') &&
      getS3Files(instance, { Bucket: this.bucket, Prefix: this.prefix }, (error, s3Files) => next(instance, files, files.s3Files = s3Files, total(s3Files.length), done())))

    .enqueue((next, instance, files) => title('過濾需上傳的檔案') &&
      next(instance, files, files.uploadFiles = files.localFiles.filter(localFile => !files.s3Files.filter(s3File => s3File.Key == localFile.Key && s3File.hash == localFile.hash).length), total(files.uploadFiles.length), done()))

    .enqueue((next, instance, files) => title('過濾需刪除的檔案') &&
      next(instance, files, files.deleteFiles = files.s3Files.filter(s3File => !files.localFiles.filter(localFile => localFile.Key == s3File.Key).length && !this.ignoreDirs.filter(dir => isSub(dir, s3File.Key)).length), total(files.deleteFiles.length), done()))

    .enqueue((next, instance, files) => title('將檔案上傳至 S3 ') && total(files.uploadFiles.length) &&
      Promise.all(files.uploadFiles.map(({ Body, Key, ContentType }) => new Promise((resolve, reject) => (Body.on('error', reject), instance.putObject({ ...this.option, Body, Key, ContentType, Bucket: this.bucket }, (error, data) => error ? reject(error) : resolve(advance())))))).then(_ => next(instance, files, done())).catch(error => finish(error, fail())))

    .enqueue((next, instance, { deleteFiles }) => title('刪除 S3 上的檔案') && total(deleteFiles.length) &&
      Promise.all(deleteFiles.map(({ Key }) => new Promise((resolve, reject) => instance.deleteObject({ Bucket: this.bucket, Key }, (error, data) => error ? reject(error) : resolve(advance()))))).then(_ => next(done())).catch(error => finish(error, fail())))

    .enqueue(next => finish())
}

S3.option = {
  ...Upload.option,

  bucket: { default: null, valid (val) { return Typeof.str.notEmpty.or(val, this.default) } },
  access: { default: null, valid (val) { return Typeof.str.notEmpty.or(val, this.default) } },
  secret: { default: null, valid (val) { return Typeof.str.notEmpty.or(val, this.default) } },
  option: { default: {}, valid (val) { return Typeof.object.or(val, this.default) } },
}

Object.defineProperty(S3, 'keys', { get: _ => Object.entries(S3.option).map(([key]) => key) })
Object.defineProperty(S3, 'model', { get: _ => { const tmp = {}; return Object.entries(S3.option).forEach(([key, val]) => tmp[key] = val.default), tmp } })
S3.keys.forEach(key => Object.defineProperty(S3.prototype, key, { get () { return Upload.instances.S3.get(this)[key] }, set (val) { return S3.option[key] && ((Upload.instances.S3.get(this) || S3.model)[key] = S3.option[key].valid(val)), this } }))

module.exports = S3
