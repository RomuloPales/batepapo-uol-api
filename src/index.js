import express from "express";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";
import cors from "cors";
dotenv.config();

const app = express();

app.use(express.json());
app.use(cors())

const participantsScrhema = joi.object({
  name: joi.string().required().min(3),
});

const messagSchema = joi.object({
  from: joi.string().required(),
  to: joi.string().required().min(3),
  text: joi.string().required().min(3),
  type: joi.string().required().valid("message", "private_message"),
  time: joi.string(),
});

const mongoClient = new MongoClient(process.env.MONGO_URI);

try {
  await mongoClient.connect();
  console.log("mongo conected!");
} catch (err) {
  console.log(err);
}

const db = mongoClient.db("batepapoUol");
const participantsCollection = db.collection("participants");
const messageCollection = db.collection("message");

app.post("/participants", async (req, res) => {
  const { name } = req.body;
  const { error } = participantsScrhema.validate(
    { name },
    { abortEarly: false }
  );
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  }

  try {
    const partipantsExist = await participantsCollection.findOne({ name });
    if (partipantsExist) {
      return res.sendStatus(409);
    }
    await participantsCollection.insertOne({ name, laststatus: Date.now() });
    await messageCollection.insertOne({
      from: name,
      to: "todos",
      text: "Entrou na sala",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    return res.sendStatus(201);
  } catch (err) {
    console.log(err);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await participantsCollection.find().toArray();
    if (!participants) {
      return res.sendStatus(404);
    }
    res.send(participants);
  } catch (err) {
    console.log(err);
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const { user } = req.headers;

  const message = {
    from: user,
    to,
    text,
    type,
    time: dayjs().format("HH:mm:ss"),
  };

  try {
    const { error } = messagSchema.validate(message, { abortEarly: false });
    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return res.status(422).send(errors);
    }
    await messageCollection.insertOne(message);
    res.sendStatus(201);
  } catch (err) {
    console.log(err);
  }
});

app.get("/messages", async (req, res) => {
  const limit = Number(req.query.limit);
  const { user } = req.headers;
  try {
    const messages = await messageCollection
      .find({
        $or: [
          { from: user },
          { to: { $in: [user, "todos"] } },
          { type: "message" },
        ],
      })
      .limit(limit)
      .toArray();
    if (!messages) {
      return res.sendStatus(404);
    }
    res.send(messages);
  } catch (err) {
    console.log(err);
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;

  try {
    const participantExist = await participantsCollection.findOne({
      name: user,
    });
    if (!participantExist) {
      return res.sendStatus(404);
    }
    await participantsCollection.updateOne(
      { name: user },
      { $set: { laststatus: Date.now() } }
    );
    res.sendStatus(200);
  } catch (err) {
    console.log(err);
  }
});

setInterval(async () => {
  const dateTenSecondAgo = Date.now() - 10000;
  try {
    const participantsInactive = await participantsCollection
      .find({
        laststatus: { $lte: dateTenSecondAgo },
      })
      .toArray();

    if (participantsInactive.length > 0) {
      const inactiveMessage = participantsInactive.map((participant) => {
        return {
          from: participant.name,
          to: "todos",
          text: "sai da sala",
          type: "status",
          time: dayjs().format("HH:mm:ss"),
        };
      });
      console.log(inactiveMessage)
       await messageCollection.insertMany(inactiveMessage);
      await participantsCollection.deleteMany({
        laststatus: { $lte: dateTenSecondAgo },
      });
    }
  } catch (err) {
    console.log(err);
  }
}, 15000);
app.listen(5000, () => console.log("server running in port 5000"));
