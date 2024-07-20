const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  // chainWebpack: config => {
  //   config.module
  //     .rule('vue')
  //     .use('vue-loader')
  //     .tap(options => ({
  //       ...options,
  //       compilerOptions: {
  //         // treat any tag that starts with Tres as custom elements
  //         // prevent warnings in the browser console in development mode
  //         // isCustomElement: tag => tag.startsWith('Tres')
  //       }
  //     }))
  // }
  // chainWebpack: config => {
  //   config.plugin('html')
  //     .tap(args => {
  //       args[0].minify = false
  //       return args
  //     })
  // }
})
