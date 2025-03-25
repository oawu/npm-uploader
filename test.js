/**
 * @author      OA Wu <oawu.tw@gmail.com>
 * @copyright   Copyright (c) 2015 - 2025, @oawu/uploader
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

const { Type: T } = require('@oawu/helper')
const Uploader = require('./index.js')
const destDir = __dirname + '/Dist'

const bucket = ''
const access = ''
const secret = ''
const region = ''

const account = ''
const repository = ''
const branch = ''
const message = ''

let step = async (name, func) => {
  process.stdout.write(name)

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
    process.stdout.write('失敗')
    process.stdout.write('\n')
    throw e
  }

  if (T.err(result)) {
    process.stdout.write('失敗')
    process.stdout.write('\n')
  } else {
    process.stdout.write('完成')
    process.stdout.write('\n')
  }

  return result
}

;(async destDir => {
  process.stdout.write('顯示 - async')
  process.stdout.write('\n')

  process.stdout.write('S3')
  process.stdout.write('\n')
  await Uploader.S3(destDir, {
    bucket,
    access,
    secret,
    region,

    prefix: '',

    ignoreNames: ['.DS_Store', 'Thumbs.db', '.gitignore', '.gitkeep'],
    ignoreExts: [],
    ignoreDirs: []
  }).execute(step)


  process.stdout.write('\n')
  process.stdout.write('GitHub')
  process.stdout.write('\n')
  await Uploader.GitHub(destDir, {
    account,
    repository,
    branch,
    message,

    prefix: '',

    ignoreNames: ['.DS_Store', 'Thumbs.db', '.gitignore', '.gitkeep'],
    ignoreExts: [],
    ignoreDirs: []
  }).execute(step)


  await new Promise((resolve, reject) => {
    process.stdout.write('\n')
    process.stdout.write('\n')
    process.stdout.write('顯示 - callback')
    process.stdout.write('\n')

    process.stdout.write('S3')
    process.stdout.write('\n')

    Uploader.S3(destDir, {
      bucket,
      access,
      secret,
      region,

      prefix: '',

      ignoreNames: ['.DS_Store', 'Thumbs.db', '.gitignore', '.gitkeep'],
      ignoreExts: [],
      ignoreDirs: []
    }).execute(step, error => error ? reject(error) : resolve())
  })
  await new Promise((resolve, reject) => {
    process.stdout.write('\n')
    process.stdout.write('GitHub')
    process.stdout.write('\n')
    Uploader.GitHub(destDir, {
      account,
      repository,
      branch,
      message,

      prefix: '',

      ignoreNames: ['.DS_Store', 'Thumbs.db', '.gitignore', '.gitkeep'],
      ignoreExts: [],
      ignoreDirs: []
    }).execute(step, error => error ? reject(error) : resolve())
  })

  step = null
  process.stdout.write('\n')
  process.stdout.write('\n')
  process.stdout.write('安靜 - async')
  process.stdout.write('\n')

  process.stdout.write('S3')
  process.stdout.write('\n')
  await Uploader.S3(destDir, {
    bucket,
    access,
    secret,
    region,

    prefix: '',

    ignoreNames: ['.DS_Store', 'Thumbs.db', '.gitignore', '.gitkeep'],
    ignoreExts: [],
    ignoreDirs: []
  }).execute(step)

  process.stdout.write('GitHub')
  process.stdout.write('\n')
  await Uploader.GitHub(destDir, {
    account,
    repository,
    branch,
    message,

    prefix: '',

    ignoreNames: ['.DS_Store', 'Thumbs.db', '.gitignore', '.gitkeep'],
    ignoreExts: [],
    ignoreDirs: []
  }).execute(step)

  await new Promise((resolve, reject) => {
    process.stdout.write('\n')
    process.stdout.write('\n')
    process.stdout.write('安靜 - callback')
    process.stdout.write('\n')

    process.stdout.write('S3')
    process.stdout.write('\n')

    Uploader.S3(destDir, {
      bucket,
      access,
      secret,
      region,

      prefix: '',

      ignoreNames: ['.DS_Store', 'Thumbs.db', '.gitignore', '.gitkeep'],
      ignoreExts: [],
      ignoreDirs: []
    }).execute(step, error => error ? reject(error) : resolve())
  })
  await new Promise((resolve, reject) => {
    process.stdout.write('GitHub')
    process.stdout.write('\n')
    Uploader.GitHub(destDir, {
      account,
      repository,
      branch,
      message,

      prefix: '',

      ignoreNames: ['.DS_Store', 'Thumbs.db', '.gitignore', '.gitkeep'],
      ignoreExts: [],
      ignoreDirs: []
    }).execute(step, error => error ? reject(error) : resolve())
  })

})(destDir).catch(console.error)