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

const chunkArray = (arr, size) => {
  size = Math.ceil(arr.length / size)
  const newArr = []
  for (let i = 0; i < arr.length; i += size) {
    newArr.push(arr.slice(i, i + size))
  }
  return newArr
}

const S3 = function(option) {
  if (this instanceof S3) {
    return this
  }

  const instance = new S3()

  Upload.instances.S3.set(instance, S3.model)

  Object.entries(option)
    .filter(([key]) => S3.keys.includes(key))
    .forEach(([key, val]) => instance[key] = val)

  return instance
}

S3.prototype.put = function(destDir, prefix, closure) {

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

  display("\n" + ' 【部署至 AWS S3】'.yellow)
  title('檢查上傳 S3 參數')
  total(1)

  Upload.putArgv(destDir, prefix, closure,
    destDir => this.destDir = destDir,
    prefix => this.prefix = prefix,
    done => this.done = done)

  const Mime = require('mime')
  const crypto = require('crypto')

  if (this.bucket === null) {
    return finish(new Error('沒有設定 Bucket', fail()))
  }
  if (this.access === null) {
    return finish(new Error('沒有設定 Access', fail()))
  }
  if (this.secret === null) {
    return finish(new Error('沒有設定 Secret', fail()))
  }
  if (this.region === null) {
    return finish(new Error('沒有設定 Region', fail()))
  }
  if (this.destDir === null) {
    return finish(new Error('沒有指定上傳的目錄', fail()))
  }

  const { S3Client } = require('@aws-sdk/client-s3');

  const instance = new S3Client({
    credentials: {
      accessKeyId: this.access,
      secretAccessKey: this.secret,
    },
    region: this.region,
  })

  if (instance === null) {
    return finish(new Error('S3 初始化失敗'), fail())
  } else {
    done()
  }


  require('@oawu/queue').create()
    .enqueue(next => {
      const { ListBucketsCommand } = require('@aws-sdk/client-s3');
      
      title('檢查 Bucket 權限')
      total(1)

      instance.send(new ListBucketsCommand({})).then(
        data => {
          if (data.Buckets.map(({ Name }) => Name).includes(this.bucket)) {
            next(instance, done())
          } else {
            finish(`沒有 ${this.bucket} 此 Bucket 權限！`, fail())
          }
        },
        error => {
          finish(error, fail())
        }
      )
    })
    .enqueue((next, instance) => {
      title('掃描整理本地檔案')
      
      let files = Upload.scanDir(this.destDir, this.ignoreNames, this.ignoreExts, this.ignoreDirs)

      total(files.length)
        
      files = files.map(({ file }) => new Promise((resolve, reject) => {
        const output = crypto.createHash('md5')
        const input = FileSystem.createReadStream(file)
        input.on('error', reject)
        
        output.once('readable', _ => resolve({
          hash: output.read().toString('hex'),
          Body: FileSystem.createReadStream(file),
          Key: `${this.prefix}${Path.relative(this.destDir, file)}`,
          ContentType: Mime.getType(file) || 'text/plain'
        }, advance()))

        input.pipe(output)
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
          return next(instance, { localFiles: _error })
        }
      }
      _wait()

      Promise.all(files)
        .then(localFiles => _error = localFiles)
        .catch(error => _error = error)
    })
    .enqueue((next, instance, files) => {
      const { ListObjectsV2Command } = require('@aws-sdk/client-s3');

      title('取得 S3 上的檔案')

      const getS3Files = (instance, options, closure, items = []) => instance.send(new ListObjectsV2Command(options)).then(
        data => {

          items = items.concat((data.Contents || []).map(({ Key, ETag }) => ({ Key, hash: ETag.replace(/^('|")(.*)\1/g, '$2') })))

          data.IsTruncated
            ? getS3Files(instance, { ...options, ContinuationToken: data.NextContinuationToken }, closure, items)
            : closure(null, items)
        },
        error => closure(error)
      )

      getS3Files(instance, {
        Bucket: this.bucket,
        Prefix: this.prefix
      }, (error, s3Files) => {
        total(s3Files.length)
        files.s3Files = s3Files
        done()
        next(instance, files)
      })
    })
    .enqueue((next, instance, files) => {
      title('過濾需上傳的檔案')
      
      files.uploadFiles = files.localFiles.filter(localFile => !files.s3Files.filter(s3File => s3File.Key == localFile.Key && s3File.hash == localFile.hash).length)

      total(files.uploadFiles.length)
      done()

      next(instance, files)
    })
    .enqueue((next, instance, files) => {
      title('過濾需刪除的檔案')

      files.deleteFiles = files.s3Files.filter(s3File => !files.localFiles.filter(localFile => localFile.Key == s3File.Key).length && !this.ignoreDirs.filter(dir => Path.normalize(s3File.Key).startsWith(Path.normalize(dir))).length)

      total(files.deleteFiles.length)
      done()

      next(instance, files)
    })

    .enqueue((next, instance, files) => {
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      
      title('將檔案上傳至 S3 ')
      total(files.uploadFiles.length)

      
      const promises = chunkArray(files.uploadFiles, 50).map(files => new Promise((resolve, reject) => {
        let q = require('@oawu/queue').create()
        
        for (let { Body, Key, ContentType } of files) {
          q.enqueue(_next => {
            Body.on('error', error => {
              fail()
              return finish(error)
            })

            instance.send(new PutObjectCommand({ ...this.option, Body, Key, ContentType, Bucket: this.bucket })).then(
              _ => {
                advance()
                _next()
              },
              error => reject(error)
            )
          })
        }

        q.enqueue(_next => resolve(_next()))
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
          return next(instance, files)
        }
      }
      _wait()

      Promise.all(promises)
        .then(_ => _error = [])
        .catch(error => _error = error)
    })

    .enqueue((next, instance, { deleteFiles }) => {
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      
      title('刪除 S3 上的檔案')
      total(deleteFiles.length)

      const promises = chunkArray(deleteFiles, 50).map(files => new Promise((resolve, reject) => {
        let q = require('@oawu/queue').create()
        
        for (let { Key } of files) {
          q.enqueue(_next => instance.send(new DeleteObjectCommand({ Bucket: this.bucket, Key })).then(
            _ => {
              advance()
              _next()
            },
            error => reject(error)
          ))
        }

        q.enqueue(_next => resolve(_next()))
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
          return next(instance)
        }
      }
      _wait()

      Promise.all(promises)
        .then(_ => _error = [])
        .catch(error => _error = error)
    })
    .enqueue(next => finish())
}

S3.option = {
  ...Upload.option,
  bucket: {
    default: null,
    valid (val) {
      return typeof val == 'string' && val !== ''
        ? val
        : this.default
    }
  },
  access: {
    default: null,
    valid (val) {
      return typeof val == 'string' && val !== ''
        ? val
        : this.default
    }
  },
  secret: {
    default: null,
    valid (val) {
      return typeof val == 'string' && val !== ''
        ? val
        : this.default
    }
  },
  region: {
    default: null,
    valid (val) {
      return typeof val == 'string' && val !== ''
        ? val
        : this.default
    }
  },
  option: {
    default: {},
    valid (val) {
      return typeof val == 'object' && val !== null && !Array.isArray(val)
        ? val
        : this.default
    }
  },
}

Object.defineProperty(S3, 'keys', {
  get: _ => Object.entries(S3.option).map(([key]) => key)
})

Object.defineProperty(S3, 'model', {
  get: _ => {
    const tmp = {};

    Object.entries(S3.option)
      .forEach(([key, val]) => tmp[key] = val.default)

    return tmp
  }
})

S3.keys.forEach(key => Object.defineProperty(S3.prototype, key, {
  get () {
    return Upload.instances.S3.get(this)[key]
  },
  set (val) {
    if (S3.option[key]) {
      const model = Upload.instances.S3.get(this) || S3.model
      model[key] = S3.option[key].valid(val)
    }
    return this
  }
}))

module.exports = S3
