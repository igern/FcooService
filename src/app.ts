import assert = require("assert");
import bodyparser from "body-parser";
import express from "express";
import cors from 'cors'
import { MongoClient } from "mongodb";
import { PolygonalGeofence } from "./geofence";
import { LatLon } from "./latlon";

const dbUrl = process.env.databasePath || "mongodb://localhost:27017";
const dbName = process.env.dbName || "fcoodb";
const client = new MongoClient(dbUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const app = express();
app.use(cors())
app.use(bodyparser.urlencoded({ extended: false }));
app.use(bodyparser.json());

const port = process.env.port || "3001";

app.listen(port, (err) => {
  if (err) {
    return console.error(err);
  }
  return console.log(`server is listening on ${port}`);
});

app.post("/api", (req, res) => {
  const input = req.body;

  const coordinateList = [];
  for (const point of input.geofence.latlonList) {
    coordinateList.push(new LatLon(point.lat, point.lon));
  }

  let geofence;
  switch (input.geofence.type) {
    case "polygon":
      geofence = new PolygonalGeofence(
        input.beginTime,
        input.endTime,
        coordinateList,
      );
      break;
    default:
      res.send("bad geofence type");
      break;
  }

  client.connect(async (err) => {
    assert.equal(null, err);

    const db = client.db(dbName);
    geofence.handle(db).then((result) => {
      client.close();
      if (result.length < 1) {
        res.status(404).send("no data");
      } else {
        res.status(200).send(result);
      }
    });
  });
});
