const http = require("http");
const https = require("https");
const fs = require("fs");
const url = require("url");

// 声明常量
const KNOWLEDGE_ID = "1838122505378893824"; // 替换为你的知识库ID
const TOKEN = "0877fb580b95408cff15cb4f0d8fe9c3.YtadDoSShTOoEZb4"; // 替换为你的 Bearer token
const PORT = 5500;

// 输入解析函数
function parseInput(message) {
  return JSON.stringify({
    model: "glm-4-long",
    stream: true,
    temperature: 0.5,
    top_P: 0.5,
    tools: [{ type: "retrieval", retrieval: { knowledge_id: KNOWLEDGE_ID } }],
    messages: [
      {
        role: "system",
        content:
          "你叫小艺，是建造施工人员的老师，能够帮助施工人员成长，擅长分析建造行业的问题，回答问题生动形象且认真仔细。",
      },
      { role: "user", content: message },
    ],
  });
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 处理根路径请求
  if (pathname === "/") {
    fs.readFile("index.html", (err, data) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("服务器内部错误");
      } else {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data);
      }
    });
    return;
  }

  // 处理发送消息请求
  if (pathname === "/send") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString(); // 将数据块拼接成完整的字符串
    });

    req.on("end", () => {
      const { message } = JSON.parse(body);
      if (!message) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("缺少message参数");
        return;
      }

      // 设置响应头
      res.writeHead(200, { "Content-Type": "text/event-stream" });

      // 初始化HTTPS请求到外部API
      const options = {
        hostname: "open.bigmodel.cn",
        path: "/api/paas/v4/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: TOKEN,
        },
      };

      const apiReq = https.request(options, (apiRes) => {
        apiRes.on("data", (chunk) => {
          const data = chunk
            .toString()
            .replace(/^data: /, "")
            .trim(); // 处理数据
          try {
            const parsedData = JSON.parse(data);
            if (parsedData.choices && parsedData.choices[0].delta) {
              const content = parsedData.choices[0].delta.content;
              if (content) {
                res.write(content); // 发送内容到前端
              }
            }
          } catch (e) {
            // 不处理错误
          }
        });

        apiRes.on("end", () => {
          res.end(); // 完成响应
        });
      });

      apiReq.on("error", (err) => {
        console.error("请求失败:", err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("服务器错误");
      });

      // 发送请求数据
      apiReq.write(parseInput(message));
      apiReq.end();
    });

    return;
  }

  // 处理404错误
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("未找到请求的资源");
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`服务器已启动，监听端口 ${PORT}`);
});
