# gatsby-source-chisel

## Install

- `yarn add gatsby-source-chisel`
- `npm install gatsby-source-chisel`

## Usage

```js
module.exports = {
  plugins: [
    {
      use: 'gatsby-source-chisel',
      options: {
        appId: 'YOUR_CHISEL_APP_ID',
        serverURL: 'YOUR_CHISEL_SERVER_URL',
        masterKey: 'YOUR_CHISEL_MASTER_KEY',
        siteId: 'YOUR_CHISEL_SITE_ID'
        typeName: 'Chisel',
        preview: true,
        cacheResponse: false,
      }
    }
  ]
}
```
