# OA's Upload

上傳無上限，不管是 S3 或 GitHub ☁️


## 說明
針對指定的目錄，將內容上傳至 [AWS S3](https://aws.amazon.com/tw/s3/) 或 [GitHub Pages](https://pages.github.com/)

## 安裝

```shell
npm install @oawu/uploader
```


## 使用

引入 `require('@oawu/uploader')` 並選擇要上的平台，如下 S3 範例：

```javascript

  const { S3 } = require('@oawu/uploader')
  
  const s3 = S3({
    bucket: '',
    access: '',
    secret: '',
    region: ''
  })

  s3.destDir = '/.../dir/'

  s3.put(error => {
    // Error or Success
  })

```

可用參數有：

* `destDir` ─ 上傳的目錄，此為 **必填**
* `prefix` ─ 前綴路徑，此為 `''`
* `ignoreNames` ─ 忽略的檔案名稱(主檔名＋副檔名)，預設 `[]`
* `ignoreExts` ─ 忽略的副檔名，預設 `[]`
* `ignoreDirs` ─ 忽略的目錄名稱，預設 `[]`
* `isDisplay` ─ 是否步驟提示，預設 `false`
* `done` ─ put 完成後要呼叫的 func

S3 參數有：

* `bucket` ─ 要上傳的 **Bucket** 名稱，此為 **必填**
* `access` ─ AWS 權限的 **Access** Key，此為 **必填**
* `secret` ─ AWS 權限的 **Secret** Key，此為 **必填**
* `option` ─ 上傳 S3 時要帶的參數，可參考 [`aws-sdk`](https://aws.amazon.com/tw/sdk-for-node-js/)，預設 `{}`

Github 參數有：

* `account` ─ GitHub 上的帳號，此為 **必填**
* `repository` ─ GitHub 上的倉庫，此為 **必填**
* `branch` ─ GitHub 上的 pages 分支，預設 `gh-pages`
* `message` ─ 紀錄時的文字訊息，預設 `🚀 部署！`

> 使用 Github 時，請先確保您的終端機可以正常 Push Git

以下為 GitHub 範例：

```javascript

  const { GitHub } = require('@oawu/uploader')
  
  const gitHub = GitHub({
    account: '',
    repository: '',
    isDisplay: true
  })

  gitHub.destDir = 

  gitHub.put('/.../dir/', error => {
    // Error or Success
  })

```

**`put`** 函式可以有 **3** 種類型，分別為：

  * `put(error => {})` ─ 第一參數為完成後的 callback
  * `put(destDir, error => {})` ─ 第一個參數為上傳目錄，第二參數為完成後的 callback
  * `put(destDir, prefix, error => {})` ─ 第一個參數為上傳目錄，第二參數為前綴路徑，第三參數為完成後的 callback
