const http = require('http');
const fs = require('fs');
const {resolve, join} = require('path');
const {fileContentReplace, replace, appendCss, appendJs} = require('./util/util');
let {devHtmlPath, injectPath, webpackDevPath, devPath} = require('../config/config');
const Koa = require('koa2');
const app = new Koa();
const route = require('koa-route');
const webpackMiddleware = require('koa-webpack');
const webpack = require('webpack');
const chokidar = require('chokidar');
const mockServer = require('./common/mockServer');

const webpackConfig = require(webpackDevPath);
const entry = webpackConfig.entry;
const dev = require(injectPath).dev;
const port = process.argv[2];
const devContext = process.argv[3];

// 编译webpack
let compiler = webpack(webpackConfig);

let middleware = webpackMiddleware({
  compiler: compiler,
  dev: {
    publicPath: webpackConfig.output.publicPath,
    noInfo: true,
    hot: true
  },
  hot: {
    publicPath: webpackConfig.output.publicPath,
    hot: true
  }
});

let timer = null;
chokidar.watch(devHtmlPath).on('all', (event, path) => {
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
  let html = fs.readFileSync(devHtmlPath).toString();

  // 向模板中注入代码
  for (let key of Object.keys(dev)) {
    let section = dev[key];
    if (section.length > 0) {
      if (key === 'css') {
        html = appendCss(html, section);
      }
      else if (key === 'js') {
        html = appendJs(html, section, devContext);
      }
    }
  }

  // 替换模板
  for (let key in entry) {
    let curHtml = '';
    fs.writeFileSync(join(devPath, `${key}.html`), curHtml = replace(html, {
      entryName: key,
      dateTime: Date.now()
    }));

    app.use(route.get(`/${key}`, cxt => {
        cxt.body = curHtml;
    }));
  }
};

reloadHTML();

app.use(route.get('/', cxt => {
	cxt.body = fs.readFileSync(join(devPath, 'index.html')).toString();
}));

// 返回静态资源
app.use(route.get('/dll/vendor.dll.js', cxt => {
    cxt.body = fs.readFileSync(join(devPath, 'js/dll/vendor.dll.js')).toString();
}));

app.use(middleware);

// 服务
let server = http.createServer(app.callback());

mockServer(app, server);

server.listen(port, () => {
    console.log(`server => http://localhost:${port}`);
    console.log(`See request info => http://localhost:${port}/debug`);
});
