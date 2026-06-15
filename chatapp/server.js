const http = require('http');
const fs = require('fs');
const path = require('path');
const port = process.env.PORT || 3000;
const host = '127.0.0.1';
const root = process.cwd();
const mime = {
  '.html':'text/html', '.css':'text/css', '.js':'application/javascript',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif',
  '.webm':'audio/webm', '.svg':'image/svg+xml', '.json':'application/json'
};
const server = http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  fs.stat(file, (err,st)=>{
    if (err || !st.isFile()) { res.statusCode=404; res.end('Not found'); return; }
    const ext = path.extname(file).toLowerCase();
    res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
});
server.listen(port, host, ()=> console.log(`Server running at http://${host}:${port}/`));
