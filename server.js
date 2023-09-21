import express from "express";
import * as dotenv from "dotenv";
import morgan from "morgan";
import cors from "cors";
import { TextLoader } from "langchain/document_loaders/fs/text";

import { queryPineconeVectorStoreAndQueryLLM } from "./utils/pinecone.js";
import { Pinecone } from "@pinecone-database/pinecone";

dotenv.config();

const app = express();
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/", async (req, res) => {
  res.status(200).send({
    message: "hello world",
  });
});

const PORT = 5000 | "https://agile-cardigan-slug.cyclic.cloud/";

app.post("/api/question", async (req, res) => {
  const { question } = req.body;

  const loader = new TextLoader("./data/salestesting.txt");

  const docs = await loader.load();
  const indexName = process.env.PINECONE_INDEX;

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
  });

  try {
    // await updatedPinecone(pinecone, indexName, docs);
    const text = await queryPineconeVectorStoreAndQueryLLM(pinecone, indexName, question);

    res.status(200).json({
      text,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      error,
    });
  }
});

app.listen(5000, () => console.log(`server running in port 5000`));
