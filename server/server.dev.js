const http = require('http');
const fs = require('fs');
const {resolve, join} = require('path');
const openbrowser = require('openbrowser');
const Koa = require('koa2');
const app = new Koa();
const Router = require('koa-router');
const router = new Router();
const webpackMiddleware = require('koa-webpack');
const webpack = require('webpack');
const chokidar = require('chokidar');
const mockServer = require('./common/mockServer');
const {fileContentReplace, replace, appendCss, appendJs, getIp, joinStr} = require('./util/util');
let {
  templatePath, 
  dllPath, 
  dllName,
  cssPath, 
  commonJsName, 
  webpackDllCommonPath, 
  manifestName
} = require('../config/paths');
const dllEntry = require(webpackDllCommonPath).entry;

module.exports = ({port, webpackConfig, inject = {}} = config) => {
  const entry = webpackConfig.entry;
  const outputPath = webpackConfig.output.path;
  const publicPath = webpackConfig.output.publicPath;

  inject.css = inject.css || [];
  inject.js = inject.js || [];

  // 返回静态资源
  router.get('/', cxt => {
    cxt.body = fs.readFileSync(join(outputPath, 'index.html')).toString();
  });
  
  // 引用dll包
  for (let key in dllEntry) {
    inject.js.push(join(dllPath, joinStr(key, '.', dllName)));

    webpackConfig.plugins.push(
      new webpack.DllReferencePlugin({
          manifest: require(join(outputPath, dllPath, joinStr(key, '.', manifestName)))
      })
    );

    router.get(join(dllPath, joinStr(key, '.', dllName)), cxt => {
      cxt.body = fs.readFileSync(join(outputPath, dllPath, joinStr(key, '.', dllName))).toString();
    });
  }

  inject.css.push(cssPath);
  inject.js.push(joinStr(commonJsName, '.js'));
  
  // 编译webpack
  let compiler = webpack(webpackConfig);
  
  let middleware = webpackMiddleware({
    compiler: compiler,
    dev: {
      publicPath: publicPath,
      noInfo: true,
      hot: true
    }
  });
  
  let timer = null;
  chokidar.watch([templatePath]).on('all', (event, path) => {
    clearTimeout(timer);
  
    if (event === 'change') {
      // 延迟刷新
      timer = setTimeout(() => {
        reloadHTML();
        middleware.hot.publish({action: 'reload'});
      }, 10);
    }
  });
  
  let reloadHTML = () => {
    // 模板内容
    let html = fs.readFileSync(templatePath).toString();
    
    // 向模板中注入代码
    for (let key of Object.keys(inject)) {
      let section = inject[key];
      if (section.length > 0) {
        if (key === 'css') {
          html = appendCss(html, section, true);
        }
        else if (key === 'js') {
          html = appendJs(html, section, true);
        }
      }
    }
  
    // 替换模板
    for (let key in entry) {
      html = appendJs(html, [joinStr(key, '.js')], true); 
      fs.writeFileSync(join(outputPath, `${key}.html`), html);
  
      router.get(`/${key}`, cxt => {
        cxt.body = html;
      });
    }
  };
  
  reloadHTML();
  
  app.use(router.routes());
  app.use(middleware);
  
  // 服务
  let server = http.createServer(app.callback());
  
  // 转发请求
  mockServer(app, server);
  
  server.listen(port, () => {
    // 获取局域网ip
    let ip = getIp();
    let url = `http://${ip}:${port}`;

    console.log(`server => ${url}`);
    console.log(`See request info => ${url}/debug`);

    // 打开浏览器
    openbrowser(url);
  });
};
