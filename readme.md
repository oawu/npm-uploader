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

  const destDir = '/.../dir/'

  const s3 = S3(destDir, {
    bucket: '',
    access: '',
    secret: '',
    region: ''
  })

  s3.execute(step, error => {
    // Error or Success
  })
```

> execute 當有帶入 callback 時，會變成同步，反之則會變成非同步(async)

### 共用參數

* `destDir` ─ 上傳的目錄，此為 **必填**
* `prefix` ─ 前綴路徑，此為 `''`
* `ignoreNames` ─ 忽略的檔案名稱(主檔名＋副檔名)，預設 `[]`
* `ignoreExts` ─ 忽略的副檔名，預設 `[]`
* `ignoreDirs` ─ 忽略的目錄名稱，預設 `[]`

### S3 參數

* `bucket` ─ S3 的 **Bucket** 名稱，此為 **必填**
* `access` ─ S3 的 **Access** Key，此為 **必填**
* `secret` ─ S3 的 **Secret** Key，此為 **必填**
* `region` ─ S3 的 **Region** Key，此為 **必填**
* `option` ─ 上傳 S3 時要的參數，可參考 [`aws-sdk`](https://aws.amazon.com/tw/sdk-for-node-js/)，預設 `{}`

### Github 參數

* `account` ─ GitHub 上的帳號，此為 **必填**
* `repository` ─ GitHub 上的倉庫，此為 **必填**
* `branch` ─ GitHub 上的 pages 分支，預設 `gh-pages`
* `message` ─ 紀錄時的文字訊息，預設 `🚀 部署！`

> 使用 Github 時，請先確保您的終端機可以正常 Push Git

以下為 GitHub 範例：

```javascript
  const { GitHub } = require('@oawu/uploader')

  const destDir = '/.../dir/'

  const gitHub = GitHub(destDir, {
    account: '',
    repository: '',
    isDisplay: true
  })

  gitHub.execute(step, error => {
    // Error or Success
  })
```

## step 為每一步驟的 callback，其格式如下：

```
 async function(string, async function(setter));
```

setter 格式如下：

```
{
  total: _ => { }, // 數量
  advance: _ => { }, // 進度
}
```
