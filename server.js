import express from "express";
import fetch from "node-fetch";

const app = express();

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

app.get("/", (req,res)=>{
  res.send("Naver MCP running");
});

app.get("/sse",(req,res)=>{
  res.send("MCP endpoint");
});

app.get("/search", async (req,res)=>{

  const query = req.query.q;

  const response = await fetch(
    `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}`,
    {
      headers:{
        "X-Naver-Client-Id":NAVER_CLIENT_ID,
        "X-Naver-Client-Secret":NAVER_CLIENT_SECRET
      }
    }
  );

  const data = await response.json();

  res.json(data);

});

app.listen(process.env.PORT || 3000, ()=>{
  console.log("Server running");
});
