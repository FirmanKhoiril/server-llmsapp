import express from "express";
import * as dotenv from "dotenv";
import morgan from "morgan";
import cors from "cors";
import http from "http";
import mongoose from "mongoose";
import Name from "./models/name.js";
import Transcript from "./models/transcript.js";
import { queryPineconeVectorStoreAndQueryLLM } from "./utils/pinecone.js";
import { Pinecone } from "@pinecone-database/pinecone";
import { Server } from "socket.io";
import { GENERATE_CONTEXTUAL_RECOMMENDATIONS_PROMPT, LIVE_CHAT_PROMPT } from "./utils/Constant.js";
import { generateRandomId } from "./utils/randomId.js";

dotenv.config({
  path: "./.env",
});

const MONGO_URI = "mongodb+srv://firmankhoiril:RUlHaCe3UBTv7ybj@cluster0.wggmcnp.mongodb.net/?retryWrites=true&w=majority";

const app = express();
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

const server = http.createServer(app);

const SOCKET_HOSTNAME = "https://growthspark.vercel.app";

const io = new Server(server, {
  cors: {
    origin: SOCKET_HOSTNAME || "http://localhost:3001",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

io.on("connection", (socket) => {
  console.log(`a user connected: ${socket.id}`);

  socket.on("join_room", (data) => {
    socket.join(data);
    console.log(`user ${socket.id} joining room ${data}`);
  });

  socket.on("disconnect", () => {
    console.log("User Connected", socket.id);
  });

  socket.on("send_message", async (data) => {
    const dataContent = data.content;
    socket.to(data.room).emit("receive_message", dataContent);
  });

  socket.on("error", (err) => {
    console.error("Socket error:", err);
  });
});

app.get("/", (req, res) => {
  res.status(200).send("<h1>Hello Welcome back King Crimson</h1>");
});

app.post("/api/save/transcript", async (req, res) => {
  const { data, chatId } = req.body;
  try {
    const checkIsTitleAlreadyExist = await Transcript.findOne({
      chatId,
    });

    if (!checkIsTitleAlreadyExist) {
      const newTranscript = new Transcript({
        chatId,
        transcript: data,
      });

      await newTranscript.save();
    } else {
      checkIsTitleAlreadyExist.transcript = data;
      await checkIsTitleAlreadyExist.save();
      res.status(200).json("Data Updated Successfully");
    }
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/api/transcript/id", async (req, res) => {
  const { id } = req.body;
  try {
    const data = await Transcript.findById(id);
    res.status(200).json({
      data,
    });
  } catch (error) {
    res.status(400).json({
      err: error,
    });
  }
});

app.get("/api/transcript", async (req, res) => {
  try {
    const getTranscript = await Transcript.find();

    res.status(200).json(getTranscript);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

app.post("/api/question", async (req, res) => {
  const { question } = req.body;

  const indexName = process.env.PINECONE_INDEX;

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
  });

  try {
    const text = await queryPineconeVectorStoreAndQueryLLM(pinecone, indexName, question, LIVE_CHAT_PROMPT);

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

app.post("/api/question/recomended", async (req, res) => {
  const { question, title } = req.body;

  const indexName = process.env.PINECONE_INDEX;

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
  });

  const randomId = generateRandomId();

  try {
    const text = await queryPineconeVectorStoreAndQueryLLM(pinecone, indexName, question, GENERATE_CONTEXTUAL_RECOMMENDATIONS_PROMPT);
    const createName = new Name({
      content: {
        title,
        role: "You",
        content: question,
        _id: randomId,
        contentBot: {
          title,
          _id: randomId,
          role: "Leadership Copilot",
          content: text.bot,
        },
      },
    });
    await createName.save();
    res.status(200).json({
      createName,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      error,
    });
  }
});

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server Listening to ${PORT}`);
  });
});
