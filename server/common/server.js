const http = require('http');
const openbrowser = require('openbrowser');
const Koa = require('koa2');
const app = new Koa();
const {getIp} = require('../util/util');
const mockServer = require('../common/mockServer');

module.exports = (port, outputPath, autoOpenBrowser) => {
	// 服务
	let server = http.createServer(app.callback());

	// 转发请求
	mockServer(app, server, outputPath);

	server.listen(port, () => {
		// 获取局域网ip
		let ip = getIp();
		let url = `http://${ip}:${port}`;

		console.log(`server => ${url}`);
		console.log(`See request info => ${url}/debug`);

		// 打开浏览器
		if (autoOpenBrowser) {
			openbrowser(url);
		}
	});
};
