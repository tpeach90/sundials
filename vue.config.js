const { templateCompilerOptions } = require('@tresjs/core')
const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  publicPath: "/sundials/",
  transpileDependencies: true,
  chainWebpack: config => {

    // disable "Failed resolve component: TresComponent..." warnings
    config.module
      .rule("vue")
      .use('vue-loader')
      .tap((options) => ({
        ...options,
        ...templateCompilerOptions.template,
      }))

    config.plugin('html')
      .tap(args => {
        args[0].minify = false  
        return args
      })
  },
})
