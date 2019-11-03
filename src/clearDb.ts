import { MongoClient, Db } from "mongodb";

const dbUrl = "mongodb://localhost:27017";
const dbName = "fcoodb";
const client = new MongoClient(dbUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

client.connect(async () => {
  const db: Db = client.db(dbName);
  await db.collections().then(async collections => {
    for (const collection of collections) {
      db.dropCollection(collection.collectionName);
      console.log(collection.collectionName);
    }
  });
  client.close();
});
