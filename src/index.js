import express from "express";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";
dotenv.config();

const app = express();
app.use(express.json());

const participantsScrhema = joi.object({
  name: joi.string().required().min(3),
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
app.listen(5000, () => console.log("server running in port 5000"));
